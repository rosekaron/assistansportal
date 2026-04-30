---
phase: 09
plan: 04
type: execute
wave: 4
depends_on: ["09-03"]
files_modified:
  - client/src/lib/api.ts
  - client/src/pages/Monthly.tsx
  - client/src/pages/AssistantDashboard.tsx
  - client/src/pages/Settings.tsx
autonomous: false
requirements: [SLIP-01, SLIP-02, SLIP-06]
must_haves:
  truths:
    - "Guardian opening Monthly.tsx for an approved assistant/month sees a `Ladda ner lönespec` button; clicking it downloads a PDF named lonespec-YYYY-MM-{Name}.pdf"
    - "Monthly.tsx button shows disabled state with `Lönekörning ej godkänd` label when payroll status is not approved"
    - "Monthly.tsx button shows disabled state with `Timlön saknas` label when the assistant's hourlyRateOverride is null"
    - "Assistant logged in as Rose sees a `Lönespecifikationer` section on AssistantDashboard; list shows only Rose's slips (sorted newest-first) with download buttons"
    - "Assistant logged in as Mikael sees ONLY Mikael's slips on AssistantDashboard (cross-assistant access verified server-side; UI just displays what server returns)"
    - "Settings → Assistants edit dialog exposes salary_model dropdown (Anhörigassistans enabled, Fremia + Custom disabled with v1.4/v1.5 Swedish label), hourly_rate_override numeric input, payment_method dropdown — all three persist through the existing Spara ändringar button"
    - "Settings → Profile exposes default_pay_day numeric input (1–28, default 25) persisting through the existing Profile Spara button"
    - "Changing default_pay_day does NOT retroactively change already-issued slips (payDate is frozen per D-09)"
  artifacts:
    - path: "client/src/lib/api.ts"
      provides: "pdfApi.lonespec, pdfApi.lonespecMe, assistantApi.slips helpers"
      contains: "lonespec"
    - path: "client/src/pages/Monthly.tsx"
      provides: "Lönespec download row with 3 disabled states"
      contains: "Ladda ner lönespec"
    - path: "client/src/pages/AssistantDashboard.tsx"
      provides: "Lönespecifikationer Card + list + empty state"
      contains: "Lönespecifikationer"
    - path: "client/src/pages/Settings.tsx"
      provides: "salary_model + hourly_rate_override + payment_method + default_pay_day fields"
      contains: "Avtalsmodell"
  key_links:
    - from: "client/src/pages/Monthly.tsx"
      to: "POST /api/pdf/lonespec"
      via: "pdfApi.lonespec helper"
      pattern: "pdfApi.lonespec\\("
    - from: "client/src/pages/AssistantDashboard.tsx"
      to: "GET /api/assistant/slips + GET /api/pdf/lonespec/me"
      via: "assistantApi.slips + pdfApi.lonespecMe helpers"
      pattern: "(assistantApi.slips|pdfApi.lonespecMe)"
    - from: "client/src/pages/Settings.tsx Assistants edit dialog"
      to: "PUT /api/assistants/:id"
      via: "existing save mutation (extended with new fields in state)"
      pattern: "salaryModel|hourlyRateOverride|paymentMethod"
    - from: "client/src/pages/Settings.tsx Profile"
      to: "PUT /api/profile"
      via: "existing Profile save mutation (extended with defaultPayDay)"
      pattern: "defaultPayDay"
---

<objective>
Wire the three UI surfaces specified in 09-UI-SPEC.md: Monthly Lönespec download row (SLIP-01), AssistantDashboard Lönespecifikationer section (SLIP-02), Settings field additions (SLIP-06).

Purpose: Plan 03 shipped endpoints; this plan makes them reachable in the product. All UI reuses existing primitives (Button, Card, Select, Input, Dialog, Tooltip) per UI-SPEC — zero new components, zero new tokens, zero new icons outside the two already in lucide-react (Download, FileText).

Output: Guardian can generate slips from Monthly; assistants see their own slips on Dashboard; Settings persists the three assistant-level fields + the one profile field. A human-verify checkpoint at the end confirms the visual result.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-salary-slip/09-CONTEXT.md
@.planning/phases/09-salary-slip/09-UI-SPEC.md
@.planning/phases/09-salary-slip/09-RESEARCH.md
@client/src/pages/Monthly.tsx
@client/src/pages/AssistantDashboard.tsx
@client/src/pages/Settings.tsx
@client/src/lib/api.ts

<interfaces>
<!-- Server contracts Plan 04 consumes. -->

Endpoints (from Plan 03):
- `POST /api/pdf/lonespec` body `{ year: string, month: string, assistantId: string }` → 200 application/pdf blob OR 409/400/500 JSON `{ error: string }`
- `GET /api/pdf/lonespec/me?month=YYYY-MM` → 200 application/pdf blob OR 409/400/500 JSON error
- `GET /api/assistant/slips` → 200 JSON array of `{ id: string; reportMonth: string; documentNumber: string; issuedAt: string /* ISO */; payDate: string /* YYYY-MM-DD */; payMethod: "bankgiro" | "swish" | "kontant" }` ordered newest-first

Client type additions (drizzle-inferred, same camelCase):
- `Assistant.salaryModel: "anhörig" | "fremia" | "custom" | null`
- `Assistant.hourlyRateOverride: number | null`
- `Assistant.paymentMethod: "bankgiro" | "swish" | "kontant" | null`
- `Profile.defaultPayDay: number | null`

Existing pdfApi pattern (client/src/lib/api.ts lines 106-114, use as template):
```typescript
export const pdfApi = {
  form4805: (year: string, month: string, assistantId: string) =>
    api.post("/pdf/4805", { year, month, assistantId }, { responseType: "blob" }),
  // ... add lonespec + lonespecMe following the same shape
};
```

Existing download-blob pattern (client/src/pages/Monthly.tsx lines 621-633, use verbatim structure for the new download handler):
```typescript
async function download4805(assistantId: string, assistantName: string) {
  try {
    const res = await pdfApi.form4805(String(year), pad(month + 1), assistantId);
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url;
    a.download = `4805-${year}-${pad(month + 1)}-${assistantName.replace(/\s+/g, "-")}.pdf`;
    a.click(); URL.revokeObjectURL(url);
  } catch { alert("..."); }
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Client API helpers — pdfApi.lonespec, pdfApi.lonespecMe, assistantApi.slips</name>
  <files>client/src/lib/api.ts</files>
  <read_first>
    - client/src/lib/api.ts (full file — confirm pdfApi + assistantApi current shape; extend, do not replace)
    - .planning/phases/09-salary-slip/09-UI-SPEC.md (§Interaction Contract — download-via-anchor pattern + error handling)
    - .planning/phases/09-salary-slip/09-RESEARCH.md (§Code Examples Ex.4 — API extension skeleton)
  </read_first>
  <action>
Extend `client/src/lib/api.ts` additively — do NOT rename or remove existing exports.

**Append to `pdfApi`** (inside the existing object literal):
```typescript
lonespec: (year: string, month: string, assistantId: string) =>
  api.post("/pdf/lonespec", { year, month, assistantId }, { responseType: "blob" }),
lonespecMe: (month: string) =>
  api.get(`/pdf/lonespec/me?month=${encodeURIComponent(month)}`, { responseType: "blob" }),
```

**Append to `assistantApi`** (inside the existing object literal):
```typescript
slips: () => api.get("/assistant/slips"),
```

**Add a type export** for the listing response near other type exports in the file (find where other API response types live; if none, inline the type at the top of the Plan 04 consumers):
```typescript
export type PaymentSlipListRow = {
  id: string;
  reportMonth: string;        // "YYYY-MM"
  documentNumber: string;     // "LS-YYYY-MM-NNN"
  issuedAt: string;           // ISO 8601
  payDate: string;            // "YYYY-MM-DD"
  payMethod: "bankgiro" | "swish" | "kontant";
};
```
  </action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/client && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "lonespec:" client/src/lib/api.ts` returns exactly 1 match with `responseType: "blob"` on the same line or adjacent
    - `grep -n "lonespecMe:" client/src/lib/api.ts` returns exactly 1 match with `responseType: "blob"`
    - `grep -n "slips:" client/src/lib/api.ts` returns at least 1 match inside assistantApi
    - `grep -n "PaymentSlipListRow" client/src/lib/api.ts` returns exactly 1 `export type` match
    - `npx tsc --noEmit -p client/tsconfig.json` exits 0
  </acceptance_criteria>
  <done>Three new API helpers + response type ship; existing pdfApi/assistantApi unchanged.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Monthly.tsx Lönespec download row with 3 disabled states</name>
  <files>client/src/pages/Monthly.tsx</files>
  <read_first>
    - client/src/pages/Monthly.tsx (full file — focus lines 621-633 for download4805 handler, lines 1096-1130 for the 4805 row UI, and the surrounding section containing those rows)
    - .planning/phases/09-salary-slip/09-UI-SPEC.md (§Copywriting Monthly.tsx — section heading Option A vs B, exact Swedish labels for all 3 disabled states, tooltip copy, error copy, filename format)
    - .planning/phases/09-salary-slip/09-CONTEXT.md (§D-13 Monthly surface)
  </read_first>
  <action>
**Per UI-SPEC §Copywriting — Option B (sibling section) is the recommended default.** Use it unless the existing section structure at lines 1096-1130 makes Option A (rename "AGI (blankett 4805)" → "Månadsdokument") genuinely cleaner — executor's final call, documented in SUMMARY.

**a) Add the download handler** — mirror `download4805` structure. Place near the existing handler:
```typescript
async function downloadLonespec(assistantId: string, assistantName: string) {
  try {
    const res = await pdfApi.lonespec(String(year), pad(month + 1), assistantId);
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url;
    a.download = `lonespec-${year}-${pad(month + 1)}-${assistantName.replace(/\s+/g, "-")}.pdf`;
    a.click(); URL.revokeObjectURL(url);
  } catch (err: any) {
    // Map known server errors to UI-SPEC §Copywriting error strings. Body is a Blob on error responses
    // (server sent JSON but responseType=blob), so we parse it.
    let message = "Kunde inte generera lönespecifikation. Försök igen.";
    try {
      const text = await (err?.response?.data as Blob)?.text();
      const parsed = text ? JSON.parse(text) : null;
      if (err?.response?.status === 409) message = "Lönekörningen är inte godkänd för denna månad.";
      else if (err?.response?.status === 400 && parsed?.error) message = parsed.error;  // server already has the Swedish string
    } catch { /* fall through to generic */ }
    alert(message);   // UI-SPEC allows alert() fallback; inline toast is preferred when the surrounding page already has a toast infra. If this file uses sonner/react-hot-toast, use that instead.
  }
}
```

**b) Add the row UI per Option B** — insert a new sibling section next to the existing 4805 block. The exact placement depends on the current layout at Monthly.tsx:1096-1130; insert AFTER the 4805 section so the visual order is 4805 then Lönespec. Use the same per-assistant row iteration pattern.

Copy verbatim (sv-SE):
- Section heading: `Lönespecifikation`
- Section body/description: `Ladda ner månadens lönespecifikation per assistent. Kräver godkänd lönekörning.`
- Per-assistant row: assistant name (left) + download button (right)

Button state derivation (per UI-SPEC §Interaction Contract):
```tsx
const isApproved = record?.status === "approved";
const rateSet = assistant.hourlyRateOverride != null;   // null or undefined → not set

// label + variant + tooltip + disabled
if (!isApproved) {
  // Variant: outline, disabled, label "Lönekörning ej godkänd"
  // Tooltip: "Godkänn lönekörning först för att ladda ner lönespecifikationen."
} else if (!rateSet) {
  // Variant: outline, disabled, label "Timlön saknas"
  // Tooltip: "Sätt timlön i Inställningar → Assistenter"
} else {
  // Variant: default (primary), enabled, label "Ladda ner lönespec"
  // Tooltip: "Ladda ner lönespecifikation (PDF)"
  // onClick: downloadLonespec(assistant.id, assistant.name)
}
```

Use the existing Button + Tooltip primitives. Download icon from `lucide-react` (already imported in the file — confirm before adding a duplicate import). Button includes `<Download className="mr-2 h-4 w-4" />` prefix on the enabled state.

Loading state: reuse the existing `Loader2` spinner pattern from Settings save buttons if any are in Monthly; else omit a loading spinner and rely on the browser download progress.

**Do NOT:**
- Rename or delete the existing 4805 section.
- Introduce new React state management patterns (reuse the existing approved-assistants loop).
- Change the page's section-heading typography (use the existing heading primitive/class).
  </action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/client && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20 && npm run build 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "async function downloadLonespec" client/src/pages/Monthly.tsx` returns exactly 1 match
    - `grep -n "pdfApi.lonespec(" client/src/pages/Monthly.tsx` returns at least 1 match
    - `grep -n "Ladda ner lönespec" client/src/pages/Monthly.tsx` returns at least 1 match (enabled label)
    - `grep -n "Lönekörning ej godkänd" client/src/pages/Monthly.tsx` returns at least 1 match (disabled label — payroll)
    - `grep -n "Timlön saknas" client/src/pages/Monthly.tsx` returns at least 1 match (disabled label — rate)
    - `grep -n "Lönespecifikation" client/src/pages/Monthly.tsx` returns at least 1 match (section heading)
    - `grep -n "hourlyRateOverride" client/src/pages/Monthly.tsx` returns at least 1 match (state derivation)
    - Client TypeScript compiles clean: `npx tsc --noEmit -p client/tsconfig.json` exits 0
    - Client builds clean: `npm run build` completes without errors
  </acceptance_criteria>
  <done>Monthly page exposes the Lönespec download button with all three states correctly Swedish-labeled and wired to the POST endpoint.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: AssistantDashboard Lönespecifikationer section</name>
  <files>client/src/pages/AssistantDashboard.tsx</files>
  <read_first>
    - client/src/pages/AssistantDashboard.tsx (full file — focus on the Card-based section pattern at lines 288/308/420 per UI-SPEC references)
    - .planning/phases/09-salary-slip/09-UI-SPEC.md (§Copywriting AssistantDashboard + §Interaction Contract + §Design Tokens section-heading style)
    - client/src/lib/api.ts (just extended with `assistantApi.slips` + `pdfApi.lonespecMe` + `PaymentSlipListRow` type)
  </read_first>
  <action>
Append a new `<Card>` block to AssistantDashboard (placement: final Card position below the existing last Card — "after the existing `Mina skift` / equivalent" per UI-SPEC).

**Data fetching** — reuse the existing React Query / fetch pattern in the file:
```typescript
const slipsQuery = useQuery({
  queryKey: ["assistant", "slips"],
  queryFn: async () => (await assistantApi.slips()).data as PaymentSlipListRow[],
});
```

Use the existing React Query import that AssistantDashboard already uses (confirm via a read before writing). If the file uses a bespoke `useFetch` pattern, use that instead — do NOT introduce a second data-fetching library.

**Section shape**:
```tsx
<Card className="mt-6 md:mt-8">
  <CardContent className="p-4 md:p-6">
    <div className="flex items-start justify-between mb-3">
      <div>
        <h2 className="text-xl font-semibold">Lönespecifikationer</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Dina månatliga lönespecifikationer. Du kan ladda ner PDF för arkivering.
        </p>
      </div>
    </div>

    {slipsQuery.isLoading ? (
      <div className="space-y-2">
        {[1,2,3].map(i => <div key={i} className="bg-muted animate-pulse h-14 rounded-md" />)}
      </div>
    ) : slipsQuery.isError ? (
      <p className="text-sm text-destructive">Kunde inte hämta lönespecifikationer. Försök ladda om sidan.</p>
    ) : (slipsQuery.data ?? []).length === 0 ? (
      <div className="flex flex-col items-center py-8 text-center">
        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
        <h3 className="text-sm font-semibold">Inga lönespecifikationer ännu</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Din första lönespecifikation skapas när guardian godkänt månadens lönekörning.
        </p>
      </div>
    ) : (
      <ul className="divide-y divide-border">
        {slipsQuery.data!.map(slip => (
          <li key={slip.id} className="py-3.5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">{formatMonthSv(slip.reportMonth)}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {slip.documentNumber} · utfärdat {formatShortDateSv(slip.issuedAt)}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadMyLonespec(slip.reportMonth)}
            >
              <Download className="mr-2 h-4 w-4" /> Ladda ner
            </Button>
          </li>
        ))}
      </ul>
    )}
  </CardContent>
</Card>
```

**Helper formatters** (colocated in this file, top-level):
```typescript
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";

function formatMonthSv(reportMonth: string): string {
  // "2026-03" → "mars 2026" — capitalize first letter for display
  const [y, m] = reportMonth.split("-").map(n => parseInt(n, 10));
  const d = new Date(y, m - 1, 1);
  const raw = format(d, "MMMM yyyy", { locale: sv });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatShortDateSv(iso: string): string {
  // ISO 8601 → "5 apr 2026"
  return format(parseISO(iso), "d MMM yyyy", { locale: sv });
}

async function downloadMyLonespec(reportMonth: string) {
  try {
    const res = await pdfApi.lonespecMe(reportMonth);
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url;
    a.download = `lonespec-${reportMonth}.pdf`;
    a.click(); URL.revokeObjectURL(url);
  } catch (err: any) {
    let message = "Kunde inte generera lönespecifikation. Försök igen.";
    try {
      const text = await (err?.response?.data as Blob)?.text();
      const parsed = text ? JSON.parse(text) : null;
      if (err?.response?.status === 409) message = "Lönekörningen är inte godkänd för denna månad.";
      else if (err?.response?.status === 400 && parsed?.error) message = parsed.error;
    } catch {}
    alert(message);
  }
}
```

Confirm `date-fns` and `date-fns/locale/sv` are already imported in the project (they are, per 09-UI-SPEC.md Design System). Confirm `FileText` + `Download` from lucide-react are imported (add to existing lucide-react import line if not present; do not introduce a new import statement).

**Do NOT:**
- Pagination, search, filter — UI-SPEC explicitly says none at v1.0.1 scale.
- Virtualization — max ~24 rows per assistant.
- Manual polling / refetch timer — React Query's default cache is sufficient.
  </action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/client && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Lönespecifikationer" client/src/pages/AssistantDashboard.tsx` returns exactly 1 match (section heading)
    - `grep -n "Inga lönespecifikationer ännu" client/src/pages/AssistantDashboard.tsx` returns exactly 1 match (empty state heading)
    - `grep -n "Din första lönespecifikation skapas när guardian godkänt" client/src/pages/AssistantDashboard.tsx` returns exactly 1 match (empty state body)
    - `grep -n "assistantApi.slips" client/src/pages/AssistantDashboard.tsx` returns at least 1 match
    - `grep -n "pdfApi.lonespecMe" client/src/pages/AssistantDashboard.tsx` returns at least 1 match
    - `grep -nE "function formatMonthSv|function formatShortDateSv|function downloadMyLonespec" client/src/pages/AssistantDashboard.tsx` returns exactly 3 matches
    - `grep -n "FileText" client/src/pages/AssistantDashboard.tsx` returns at least 1 match (import + usage)
    - `npx tsc --noEmit -p client/tsconfig.json` exits 0
  </acceptance_criteria>
  <done>AssistantDashboard renders Lönespecifikationer Card with all 4 states (loading/empty/populated/error) covered; download wires to /pdf/lonespec/me.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Settings — Assistants edit dialog (3 fields) + Profile default_pay_day</name>
  <files>client/src/pages/Settings.tsx</files>
  <read_first>
    - client/src/pages/Settings.tsx (full file — focus on the Assistants edit dialog's "Anställning & ekonomi" section from Phase 7 and the Profile FK-beslut section)
    - .planning/phases/09-salary-slip/09-UI-SPEC.md (§Copywriting Settings sections — exact labels, placeholder, helper text, Select option order, disabled option suffixes, layout grid)
    - .planning/phases/09-salary-slip/09-CONTEXT.md (§D-07 schema defaults, §D-13 frontend surfaces, §D-10 pay method)
    - client/src/components/ui/controls.tsx (or wherever Select is exported — confirm disabled prop on SelectItem)
    - client/src/components/ui/inputs.tsx (Input + Label signature)
  </read_first>
  <action>
**a) Assistants edit dialog additions (3 fields).** Locate the Anställning & ekonomi section of the dialog (after `iban` field, before `notes` per UI-SPEC placement rule). Append:

**Layout container** — one `grid grid-cols-2 gap-3` wrapping `salary_model` + `payment_method`, then a full-width row for `hourly_rate_override`.

```tsx
{/* v1.0.1 Phase 9 additions (SLIP-06 / D-07) */}
<div className="grid grid-cols-2 gap-3">
  <div>
    <Label htmlFor="salaryModel">Avtalsmodell</Label>
    <Select
      value={form.salaryModel ?? "anhörig"}
      onValueChange={(v) => setForm({ ...form, salaryModel: v as "anhörig" | "fremia" | "custom" })}
    >
      <SelectTrigger id="salaryModel">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="anhörig">Anhörigassistans</SelectItem>
        <SelectItem value="fremia" disabled className="text-muted-foreground">
          Fremia (Kommer i v1.4)
        </SelectItem>
        <SelectItem value="custom" disabled className="text-muted-foreground">
          Custom (Kommer i v1.5)
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
  <div>
    <Label htmlFor="paymentMethod">Utbetalningssätt</Label>
    <Select
      value={form.paymentMethod ?? "bankgiro"}
      onValueChange={(v) => setForm({ ...form, paymentMethod: v as "bankgiro" | "swish" | "kontant" })}
    >
      <SelectTrigger id="paymentMethod">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="bankgiro">Bankgiro</SelectItem>
        <SelectItem value="swish">Swish</SelectItem>
        <SelectItem value="kontant">Kontant</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>
<div>
  <Label htmlFor="hourlyRateOverride">Timlön (kr/tim)</Label>
  <Input
    id="hourlyRateOverride"
    type="number"
    step="0.01"
    min="0"
    placeholder="254,10"
    value={form.hourlyRateOverride ?? ""}
    onChange={(e) =>
      setForm({
        ...form,
        // Empty string → null (D-12 gate depends on null detection)
        hourlyRateOverride: e.target.value === "" ? null : Number(e.target.value),
      })
    }
  />
  <p className="text-xs text-muted-foreground mt-1">
    Lämna tomt blockerar lönespecifikation. Anhörigmodellen: 254,10 kr/tim.
  </p>
</div>
```

**State init** — whatever `form` state shape currently loads an assistant for editing in this file MUST be extended with `salaryModel`, `hourlyRateOverride`, `paymentMethod`. Find the `useState({ ... })` or equivalent initializer where existing assistant fields (e.g. `skattetabell`, `taxScheme`, `iban`) are set, and add the three new fields. Default values from the row: `salaryModel: row.salaryModel ?? "anhörig"`, `hourlyRateOverride: row.hourlyRateOverride`, `paymentMethod: row.paymentMethod ?? "bankgiro"`. Do NOT coerce null → 0 for hourlyRateOverride.

**Save mutation** — the existing `Spara ändringar` save calls `PUT /api/assistants/:id`. Since Plan 01 extended the whitelist, the three new fields are persisted automatically as long as they're part of the payload. Confirm the save body is `{ ...form }` (spreads full state) or explicitly whitelisted — in the latter case, extend the explicit whitelist.

**b) Profile default_pay_day field.** Per UI-SPEC §Settings.tsx → Profile (new field), placement is Claude's discretion. Recommended: new "Lön" mini-section below the existing FK-beslut section inside the Profile card (matches Phase 7 collapsible rhythm).

```tsx
{/* v1.0.1 Phase 9 addition (D-07, D-09) */}
<div className="mt-4">
  <h3 className="text-sm font-semibold mb-2">Lön</h3>
  <div>
    <Label htmlFor="defaultPayDay">Utbetalningsdag (varje månad)</Label>
    <Input
      id="defaultPayDay"
      type="number"
      min="1"
      max="28"
      step="1"
      value={profileForm.defaultPayDay ?? 25}
      onChange={(e) => {
        const n = Number(e.target.value);
        setProfileForm({
          ...profileForm,
          defaultPayDay: Number.isFinite(n) ? Math.min(Math.max(n, 1), 28) : 25,
        });
      }}
    />
    <p className="text-xs text-muted-foreground mt-1">
      Dag i månaden efter rapportmånaden då lönen betalas ut. 1–28. Gäller alla lönespecifikationer som skapas efter ändringen.
    </p>
  </div>
</div>
```

Extend the Profile state init with `defaultPayDay: p.defaultPayDay ?? 25`.

**Do NOT:**
- Add a separate save button — the existing `Spara` CTA handles both blocks.
- Change dialog width — Phase 7 `max-w-lg` stands.
- Introduce validation libraries — Phase 7 D-18 client-validation-only stance (HTML5 min/max + JS clamp suffice).
- Add a warning banner when defaultPayDay changes — UI-SPEC explicitly says "No warning banner needed."
  </action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/client && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20 && npm run build 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Avtalsmodell" client/src/pages/Settings.tsx` returns exactly 1 match (label)
    - `grep -n "Anhörigassistans" client/src/pages/Settings.tsx` returns exactly 1 match (SelectItem value label)
    - `grep -n "Fremia (Kommer i v1.4)" client/src/pages/Settings.tsx` returns exactly 1 match
    - `grep -n "Custom (Kommer i v1.5)" client/src/pages/Settings.tsx` returns exactly 1 match
    - `grep -n 'Timlön (kr/tim)' client/src/pages/Settings.tsx` returns exactly 1 match (label)
    - `grep -n "Utbetalningssätt" client/src/pages/Settings.tsx` returns exactly 1 match
    - `grep -n "Utbetalningsdag (varje månad)" client/src/pages/Settings.tsx` returns exactly 1 match
    - `grep -nE "salaryModel|hourlyRateOverride|paymentMethod|defaultPayDay" client/src/pages/Settings.tsx` returns >= 8 matches (state + input binding + default for each of 4 fields)
    - `grep -n "Lämna tomt blockerar lönespecifikation" client/src/pages/Settings.tsx` returns exactly 1 match (helper text)
    - `grep -n "disabled" client/src/pages/Settings.tsx | grep -E "fremia|custom"` — at least the Fremia or Custom SelectItem shows a `disabled` attribute
    - `npx tsc --noEmit -p client/tsconfig.json` exits 0 and `npm run build` completes clean
  </acceptance_criteria>
  <done>Four new fields visible + editable + persisting through existing save mutations; existing Phase 7 sections + dialog width unchanged.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Human verification of all four UI surfaces</name>
  <files>N/A — visual verification</files>
  <read_first>
    - .planning/phases/09-salary-slip/09-UI-SPEC.md (full file — reference for expected visual state at every surface)
  </read_first>
  <what-built>
    - Monthly.tsx: new Lönespecifikation section with per-approved-assistant row + download button showing all 3 states
    - AssistantDashboard.tsx: new Lönespecifikationer Card with list / empty / error states
    - Settings Assistants edit dialog: 3 new fields (Avtalsmodell, Timlön, Utbetalningssätt)
    - Settings Profile: 1 new field (Utbetalningsdag)
    - End-to-end wiring: guardian generates → row appears in payment_slips DB → assistant sees in own dashboard
  </what-built>
  <how-to-verify>
    **Test credentials (provide fresh on each checkpoint per user-memory preference):**
    - Guardian: email `{primary-guardian-email-from-.env-or-dev-db}` / password `{dev-default-or-as-shared-previously}` — executor operator to fetch from `server/.env` or a guardian's auth row. If unknown, request from the human before starting the checkpoint.
    - Assistant (Rose): email `{rose-email}` / password `{dev-default}` — same source.
    - Assistant (Mikael): email `{mikael-email}` / password `{dev-default}`.
    - Provide these ONCE at the start of the checkpoint, not per-subtest.

    **1. Settings (guardian) — field presence (SLIP-06):**
    - Log in as guardian. Visit `/settings`. Open Profile → confirm "Utbetalningsdag (varje månad)" input exists (default 25).
    - Open Assistants → edit Rose → confirm Avtalsmodell dropdown shows "Anhörigassistans" (enabled), "Fremia (Kommer i v1.4)" (grayed/disabled), "Custom (Kommer i v1.5)" (grayed/disabled). Confirm "Timlön (kr/tim)" numeric input + helper text "Lämna tomt blockerar lönespecifikation. Anhörigmodellen: 254,10 kr/tim." Confirm "Utbetalningssätt" dropdown defaults to "Bankgiro".
    - Enter 254.10 for Rose's timlön, click Spara. Reload the page, reopen Rose's edit dialog → confirm 254,10 persisted (display format may be "254.1" or "254.10" depending on browser — accept either numeric form).
    - Repeat for Mikael (254.10).

    **2. Monthly (guardian) — SLIP-01:**
    - Visit `/monthly`. Select a month where payroll is approved for at least one assistant (e.g. 2026-03).
    - Scroll to the new "Lönespecifikation" section — confirm heading + description text match UI-SPEC.
    - Per-approved-assistant row:
      - Rose (payroll approved, rate set) → button is primary-blue, label "Ladda ner lönespec". Click → browser downloads `lonespec-2026-03-Rose-Karon.pdf`. Open the PDF → confirm:
        - Title "LÖNESPECIFIKATION" top-left, "Nr: LS-2026-03-001" top-right
        - Arbetsgivare shows patient name + pno + address (NOT guardian name — EMP-02 invariant from Phase 8)
        - "Företrädd av:" line appears IF the patient is a minor in the seed data
        - Arbetstid section with 5 rows (Arbetade timmar, Sjukfrånvaro, VAB, Semester, Annan frånvaro)
        - Lön section with Grundlön + 3 zeroed benefit lines + BRUTTOLÖN total
        - Avdrag section with Preliminärskatt 30% (schablon) + NETTO TILL BANK total
        - Footer asterisk note "* Ingen ersättning vid sjukdom, VAB eller semester enligt överenskommelse (anhörigmodell)."
        - Swedish characters å/ä/ö render correctly (no `?` glyphs)
      - If another assistant has unapproved payroll → button disabled with label "Lönekörning ej godkänd". Hover → tooltip shows "Godkänn lönekörning först för att ladda ner lönespecifikationen."
      - Temporarily clear Rose's timlön in Settings, return to Monthly → button disabled, label "Timlön saknas". Restore 254.10 after the check.

    **3. AssistantDashboard (assistant Rose) — SLIP-02:**
    - Log out. Log in as Rose. Visit the AssistantDashboard landing page.
    - Scroll to new "Lönespecifikationer" section — confirm heading + description.
    - If Task 2 has issued at least one slip for Rose (from the Monthly test above), confirm 1+ rows: "Mars 2026" (month label), below it doc number + "utfärdat {date}", with "Ladda ner" outline button right.
    - Click Ladda ner → browser downloads a PDF. Open it → visual content matches the guardian's download.
    - If no slips yet, confirm empty state: FileText icon + "Inga lönespecifikationer ännu" + body copy.

    **4. Cross-assistant isolation — SLIP-02 IDOR:**
    - Log out. Log in as Mikael. Visit AssistantDashboard → Lönespecifikationer section shows ONLY Mikael's slips (not Rose's). If Mikael has none yet, empty state.
    - Open browser devtools → Network panel → manually copy the GET /api/assistant/slips request and modify to add `?assistantId=a_rose` → response still returns Mikael's data (query param ignored server-side).

    **5. Replay behavior — SLIP-05:**
    - As guardian, download Rose's March slip again from Monthly. Open the PDF → confirm same document number "LS-2026-03-001", same Utbetalningsdag (the DB row is reused per D-05).

    **6. Pay-date freeze — D-09:**
    - As guardian, change Profile Utbetalningsdag from 25 to 20. Save. Download Rose's March slip again. Confirm Utbetalningsdag on the PDF is still "25 april 2026" (the March slip was issued before the change — freeze invariant). Reset to 25 after.
  </how-to-verify>
  <action>Executor pauses for the human to run the 6-subtest verification laid out in `<how-to-verify>` above. Before pausing, the executor MUST: (a) ensure `npm run dev` (both server and client) is running against the dev Postgres, (b) surface the test credentials to the human as the first chat message in the checkpoint, (c) summarise exactly which surfaces to visit and in what order (Settings → Monthly → AssistantDashboard-as-Rose → AssistantDashboard-as-Mikael → replay-check → pay-date-freeze-check). No automated steps — this task is purely a human-driven UX gate for SLIP-01 / SLIP-02 / SLIP-06 visual correctness.</action>
  <verify>
    <automated>echo "Checkpoint task — human verification required; no automated verify"</automated>
  </verify>
  <acceptance_criteria>
    - Human confirms all 6 subtests pass verbatim ("approved" resume-signal received)
    - PDF downloaded from Monthly renders Swedish characters å/ä/ö without substitution
    - Arbetsgivare line on the downloaded PDF shows the patient name (not the guardian name) — EMP-02 invariant from Phase 8 holds
    - Document number on the Monthly-issued PDF matches `LS-YYYY-MM-001` format
    - Cross-assistant IDOR attempt via devtools returns only the authenticated assistant's data
    - Pay-date on a previously-issued slip does NOT change after Utbetalningsdag is altered in Settings (D-09 freeze invariant)
  </acceptance_criteria>
  <done>Human typed "approved"; all 6 subtests verified; any observed gaps triaged into either (a) a same-session fix applied and re-verified, or (b) a documented carry-over tracked in the plan SUMMARY.</done>
  <resume-signal>Type "approved" if all 6 checks pass. Type "issues: {specifics}" listing surface + what didn't match UI-SPEC. Common issues: Swedish character rendering, button state logic, cross-assistant row bleed-through — flag the exact observation and which file is likely at fault so the follow-up fix can be targeted.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser→Monthly download handler | Guardian initiates; assistantId is one of the approved assistants visible on the page — trusted after role check |
| browser→AssistantDashboard download handler | Assistant JWT; month value is user input but server re-derives assistantId from JWT (Plan 03 guard) |
| browser→Settings form state | Guardian input; persisted through PUT whitelist (Plan 01 guard); UI-layer sanitization is convenience only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-30 | S (Spoofing) | Unauthenticated client calling /api/assistant/slips | mitigate | Server requires JWT; UI-layer has no role to play here. Plan 03 test U proves. |
| T-09-31 | E (IDOR) | UI accidentally surfacing another assistant's slip | mitigate | UI renders only what server returns. `useQuery(["assistant","slips"])` calls `assistantApi.slips()` which hits `/api/assistant/slips` — server-side filter is the gate. Plan 03 tests R + S prove. |
| T-09-32 | T (Tampering) | Browser-side defaultPayDay outside 1–28 bypasses server clamp | mitigate | Plan 01 server-side PUT clamp also enforces 1–28; UI clamp is a convenience. Values outside range fall back to 25 server-side. |
| T-09-33 | T | User picks Fremia / Custom option despite UI disabled state | mitigate | Radix `SelectItem disabled` prevents keyboard/mouse selection. Even if a malicious client bypasses and POSTs `salaryModel: "fremia"`, the drizzle pgEnum accepts it (value is valid), BUT Plan 03 slip generation checks `payrollRecord.salaryModelUsed === "anhörig"` implicitly through the hardcoded Avtalsmodell label and pure-anhörig calculation — Fremia slip generation is simply not implemented, so no wrong slip can be produced. Accepted: slip endpoint would generate an anhörig-shaped slip even if salaryModel was flipped; deemed acceptable for v1.0.1 since no production harm results. |
| T-09-34 | I (Info Disclosure) | Alert() leaking Swedish error copy containing assistant name | accept | The assistant name is already visible to the caller (guardian sees all assistants). Low-value leak. |
| T-09-35 | D (Denial of Service) | User rapidly clicking download button | accept | Idempotent server (D-05 replay); occasional double-download is harmless. No explicit debounce needed. |
</threat_model>

<verification>
**Post-plan verification checks (run before marking plan complete):**

1. **Client TypeScript compile:** `cd client && npx tsc --noEmit -p tsconfig.json` exits 0.
2. **Client build:** `cd client && npm run build` completes without errors.
3. **Swedish-label greps:** All UI-SPEC copy strings present in their target files (covered by per-task acceptance criteria).
4. **Human verification completed:** Task 5 checkpoint "approved".
5. **No regression in existing tests:** `cd client && npm test` (if any exist); `cd server && npm test` — 0 failures.
</verification>

<success_criteria>
- SLIP-01: Guardian Monthly button ships with 3 disabled states + download wired to POST /api/pdf/lonespec. Proven by Task 5 check 2.
- SLIP-02: AssistantDashboard Lönespecifikationer section lists own slips (server-scoped), download wired to GET /api/pdf/lonespec/me. Proven by Task 5 checks 3 + 4.
- SLIP-06: Settings Assistants dialog exposes all 3 new fields with correct Swedish labels + disabled Fremia/Custom options + working persistence. Proven by Task 5 check 1.
- D-09 freeze invariant visibly holds: changing defaultPayDay does NOT alter already-issued slips. Proven by Task 5 check 6.
- UI uses zero new primitives / colors / tokens / icons — all strictly reused per UI-SPEC.
</success_criteria>

<output>
After completion, create `.planning/phases/09-salary-slip/09-04-SUMMARY.md` documenting:
- Which section-heading approach chosen on Monthly (Option A vs B) and why
- Exact placement of Profile `defaultPayDay` (new Lön subsection vs embedded in FK-beslut)
- Any UI deviations from UI-SPEC (should be none; if any, justify)
- Result of human verification checkpoint (approved / issues-and-fixes applied)
- Confirmation that guardian end-to-end flow (Settings → Monthly → download → Assistant Dashboard → download) works on real seed data
</output>
