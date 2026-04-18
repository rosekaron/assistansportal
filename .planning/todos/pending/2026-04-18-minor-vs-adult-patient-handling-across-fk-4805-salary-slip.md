---
created: 2026-04-18T23:30:00Z
title: Minor vs adult patient handling across FK 3057, SKV 4805, and salary slip
area: api
priority: correctness
planned_milestone: v1.0.1 (ships with salary slip)
files:
  - server/src/lib/form4805-utils.ts:91
  - server/src/lib/form4805-utils.ts:120
  - server/src/routes/pdf.ts:140
  - server/src/routes/pdf.ts:141
  - server/src/routes/pdf.ts:147
  - server/src/routes/pdf.ts:303
  - server/src/routes/pdf.ts:373
  - server/src/db/schema.ts:20
---

## Problem

Guardian flagged 2026-04-18: "if the patient is a minor, we should reflect the name of the guardian". While implementing this for the upcoming salary slip (v1.0.1), a related issue was found in **existing v1.0 code**: the FK 3057, FK 3059, and SKV 4805 form renderers already use `profile.guardianName` in fields that semantically belong to the brukare (the care recipient / legal employer).

**Swedish legal structure for personal assistance employment:**
- The **brukare** (care recipient) is the legal **arbetsgivare** (employer) for their personal assistants
- If the brukare is an **adult with capacity**, they act as their own employer; the guardian (if any) is administrative help, not the legal arbetsgivare
- If the brukare is a **minor** (<18), the **vårdnadshavare / förmyndare** (legal guardian) acts as **företrädare** (legal representative) on behalf of the minor — the brukare is still the legal arbetsgivare, the guardian signs on their behalf
- If the brukare is an **adult without capacity**, a **god man / förvaltare** acts as representative — same principle

In all three cases the brukare's pno is the employer's pno on official documents. The guardian's name appears as "företrädare" ONLY when the brukare isn't capable of acting personally (minor or adult without capacity).

## Current code behaviour

### [server/src/lib/form4805-utils.ts:91](server/src/lib/form4805-utils.ts#L91)
```ts
fields["__employer__txtNamn[0]"] = profile.guardianName;
```
- SKV 4805 "arbetsgivare" name field is set to guardian's name.
- **Correct if** patient is a minor (guardian acts as företrädare).
- **Wrong if** patient is an adult (should be patient's own name; guardian isn't the employer).

### [server/src/lib/form4805-utils.ts:120](server/src/lib/form4805-utils.ts#L120)
```ts
fields["txtNamnfortydl[0]"] = profile.guardianName;
```
- Signature name-clarification field. Same issue: currently always guardian.

### [server/src/routes/pdf.ts:140–147, :303, :373](server/src/routes/pdf.ts)
- FK 3057 and FK 3059 header fields (`flt_txtNamnAnordnaren`, `flt_txtKontaktperson`, `flt_txtNamnteckning`, `flt_txtNamnteckning2`) all read `profile.guardianName`.
- Same issue.

### Why it's "currently working"

The typical use case for Kalinga — and the only real data exercising these paths — is anhörigassistans with the patient being a minor child cared for by parents. In that case `guardianName` IS the correct företrädare name, and forms render OK. The code was written for the minor case and the adult case was never tested or flagged.

If the platform ever onboards an adult brukare self-managing their assistants (the stated core value does include this), the FK + 4805 filings will have wrong employer identification.

## Solution

Introduce a single helper that answers "who is the employer representative for documents dated X?" and have all form renderers use it:

### New helper in server

`server/src/lib/employerRepresentative.ts` (new pure-function module):

```ts
export type EmployerRepresentation = {
  arbetsgivareName: string;    // brukare name — always
  arbetsgivarePno:  string;    // brukare pno — always
  företrädareName:  string | null;  // guardian name — only if minor or explicitly flagged
  företrädarePno:   string | null;  // guardian pno — same condition
  isMinor:          boolean;
};

export function resolveEmployerRepresentation(
  profile: Profile,
  asOfDate: Date
): EmployerRepresentation {
  const minor = isMinor(profile.patientPno, asOfDate) || profile.patient_requires_representative === true;
  return {
    arbetsgivareName: profile.patientName,
    arbetsgivarePno:  profile.patientPno,
    företrädareName:  minor ? profile.guardianName : null,
    företrädarePno:   minor ? profile.guardianPno  : null,
    isMinor:          minor,
  };
}

function isMinor(pno: string, asOf: Date): boolean {
  const birthYear = birthYearFromPno(pno);  // already exists in form4805-utils
  const yearDelta = asOf.getFullYear() - birthYear;
  // Conservative: treat under 19 as minor to cover "turns 18 mid-month"
  return yearDelta < 18 || (yearDelta === 18 && !birthdayPassedInYear(pno, asOf));
}
```

Plus a `profile.patient_requires_representative` boolean for non-minor cases (god man / förvaltare for adult without capacity). Defaults to false; derived from `isMinor(patientPno)` when unset.

### Refactors

Apply across all three renderers:

**SKV 4805** — `form4805-utils.ts`:
```ts
const rep = resolveEmployerRepresentation(profile, new Date(`${yearMonth}-15`));
fields["__employer__txtNamn[0]"] = rep.arbetsgivareName;       // brukare
fields["__employer__txtPersNr[0]"] = rep.arbetsgivarePno;      // brukare pno
if (rep.företrädareName) {
  fields["txtForetradare[0]"] = rep.företrädareName;           // if field exists on 4805
}
fields["txtNamnfortydl[0]"] = rep.företrädareName ?? rep.arbetsgivareName;  // signatory
```

**FK 3057 / FK 3059** — `pdf.ts`:
```ts
const rep = resolveEmployerRepresentation(prof, new Date(`${year}-${month}-15`));
fields["form1[0].#subform[0].flt_txtNamnAnordnaren[0]"] = rep.arbetsgivareName;
fields["form1[0].#subform[0].flt_txtKontaktperson[0]"]  = rep.företrädareName ?? rep.arbetsgivareName;
fields["form1[0].#subform[0].flt_txtNamnteckning[0]"]   = rep.företrädareName ?? rep.arbetsgivareName;
fields["form1[0].#subform[0].flt_txtNamnteckning2[0]"]  = rep.företrädareName ?? rep.arbetsgivareName;
```

**Salary slip** — `payrollSlipUtils.ts` (new from v1.0.1):
```ts
const rep = resolveEmployerRepresentation(profile, periodEndDate);
slip.header.arbetsgivareLine = `Arbetsgivare: ${rep.arbetsgivareName}, ${rep.arbetsgivarePno}`;
if (rep.företrädareName) {
  slip.header.företrädareLine = `Företrädd av: ${rep.företrädareName}, ${rep.företrädarePno}`;
}
```

### Schema change

Add to `profile` table:
- `patient_requires_representative BOOLEAN DEFAULT false` — explicit override for "adult without capacity" case (god man / förvaltare scenario). When null, `isMinor(patientPno)` determines automatically.

### Migration

- No change to existing stored data; derivation is compute-on-read.
- Approved FK/4805 PDFs already generated with wrong names are **not retroactively fixed** — they represent what was filed at the time. New PDFs generated after this lands will use the corrected logic.
- Guardian should be notified: "This fix affects future PDFs only. If you have already mailed FK 3057 or filed 4805 for March with inconsistent employer names and the brukare is an adult, contact FK/Skatteverket to clarify — they generally accept amendments."

### Test cases

- Minor patient (e.g. pno 201501-XXXX → age 10-11 in 2026): rep = { arbetsgivareName: patient, företrädareName: guardian }
- Adult patient (pno 199001-XXXX → age ~36): rep = { arbetsgivareName: patient, företrädareName: null }
- Adult with `patient_requires_representative=true`: rep = { arbetsgivareName: patient, företrädareName: guardian }
- Patient turning 18 mid-period: rep reflects status at period end date (not generation date)
- Missing guardian name when minor: error — can't produce valid document without representative

## Why this belongs with v1.0.1

- Salary slip (v1.0.1) needs the same logic → build once, use in three renderers.
- Adding the helper while already touching the PDF/slip layer is cheap.
- Shipping salary slip with inconsistent employer representation (slip says patient-is-employer, 4805 says guardian-is-employer) would be confusing for the assistant and potentially a documentation audit issue.

## Decision point

- For Kalinga's current real users (patient IS a minor child): no behaviour change — guardian name still appears as arbetsgivare on 4805/FK because the minor-detection returns true.
- For future users who onboard an adult brukare: FK/4805 will correctly show brukare name, not guardian.

## Priority

**Correctness** — current behaviour is wrong for any adult-brukare use case, even though the current user base doesn't exercise that path. Shipping without this fix means silently producing misfiled documents for any adult brukare that comes along. Cheap to fix when salary slip touches the same code path.

## Related

- Salary slip todo: [.planning/todos/pending/2026-04-18-salary-slip-lonespecifikation-for-assistants.md](2026-04-18-salary-slip-lonespecifikation-for-assistants.md) — minor-detection logic originates here, extends to FK/4805
- Missing fields todo: [.planning/todos/pending/2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md](2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md) — `patient_requires_representative` is a new column belonging here
- v1.0 audit: [.planning/v1.0-MILESTONE-AUDIT.md](../../v1.0-MILESTONE-AUDIT.md) — this is a v1.0 correctness bug not previously flagged; audit should be updated to note it
