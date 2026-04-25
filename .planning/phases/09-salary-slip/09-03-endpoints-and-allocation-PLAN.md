---
phase: 09
plan: 03
type: execute
wave: 3
depends_on: ["09-01", "09-02"]
files_modified:
  - server/src/routes/pdf.ts
  - server/src/routes/assistant.ts
  - server/src/routes/__tests__/pdf-lonespec.test.ts
  - server/src/routes/__tests__/assistant-slips.test.ts
autonomous: true
requirements: [SLIP-01, SLIP-02, SLIP-05, SLIP-07]
must_haves:
  truths:
    - "POST /api/pdf/lonespec with approved payroll + non-null hourlyRateOverride returns 200 + application/pdf body starting with %PDF-"
    - "POST /api/pdf/lonespec returns 409 with Swedish error when payroll_records.status !== 'approved' for the requested (assistant, month)"
    - "POST /api/pdf/lonespec returns 400 with Swedish error when assistants.hourlyRateOverride IS NULL"
    - "POST /api/pdf/lonespec on first issue inserts a payment_slips row with sequence=1 and documentNumber='LS-{YYYY-MM}-001'"
    - "POST /api/pdf/lonespec on replay (same assistant, same reportMonth) returns the SAME documentNumber as the first issue and does NOT insert a new payment_slips row"
    - "GET /api/pdf/lonespec/me?month=YYYY-MM returns 200 + PDF for the JWT-bound assistant when payroll is approved + rate set"
    - "GET /api/pdf/lonespec/me ignores any ?assistantId= query param — uses ONLY req.assistantId from JWT"
    - "GET /api/pdf/lonespec/me returns 400 when req.assistantId is undefined (guardian with no linked assistant)"
    - "GET /api/pdf/lonespec/me only returns slips for the JWT-bound assistant — cross-assistant access via manipulated query returns 403 or is ignored"
    - "GET /api/assistant/slips returns an array of payment_slips rows where assistant_id === req.assistantId, ordered by reportMonth DESC then issuedAt DESC"
    - "GET /api/assistant/slips returns 400 when req.assistantId is undefined"
    - "Filename in Content-Disposition is `lonespec-{YYYY-MM}-{assistantName-dash-separated}.pdf` with no path traversal escape characters"
  artifacts:
    - path: "server/src/routes/pdf.ts"
      provides: "POST /lonespec + GET /lonespec/me + issueOrReuseSlip helper"
      contains: "POST.*/lonespec"
    - path: "server/src/routes/assistant.ts"
      provides: "GET /slips listing endpoint (JWT-scoped)"
      contains: "/slips"
    - path: "server/src/routes/__tests__/pdf-lonespec.test.ts"
      provides: "Integration tests for SLIP-01 + SLIP-02 endpoints + SLIP-05 allocation"
      min_lines: 200
    - path: "server/src/routes/__tests__/assistant-slips.test.ts"
      provides: "Integration tests for listing endpoint (may be merged into pdf-lonespec.test.ts — Claude's discretion)"
      min_lines: 60
  key_links:
    - from: "server/src/routes/pdf.ts POST /lonespec"
      to: "server/src/lib/payrollSlipUtils.ts buildAnhorigSlip"
      via: "direct function call"
      pattern: "buildAnhorigSlip\\("
    - from: "server/src/routes/pdf.ts POST /lonespec"
      to: "server/src/lib/pdfSlipRenderer.ts renderAnhorigSlipPdf"
      via: "direct function call"
      pattern: "renderAnhorigSlipPdf\\("
    - from: "server/src/routes/pdf.ts"
      to: "paymentSlips table"
      via: "drizzle insert/select (issueOrReuseSlip helper)"
      pattern: "paymentSlips"
    - from: "server/src/routes/assistant.ts GET /slips"
      to: "paymentSlips table"
      via: "drizzle select where assistantId = req.assistantId"
      pattern: "eq\\(paymentSlips.assistantId"
---

<objective>
Wire the guardian POST endpoint, the assistant GET-by-month endpoint, and the assistant slip-listing endpoint. Add the idempotent `issueOrReuseSlip()` helper that allocates a `payment_slips` row on first issue and reuses it on replay (D-05).

Purpose: Plan 02's pure builder + renderer become useful only when there is a route that (a) enforces the approval + rate-NULL gates, (b) allocates the document number, (c) scopes assistant access by JWT. This plan adds those three routes plus the integration tests that prove SLIP-01, SLIP-02, SLIP-05.

Output: Three HTTP endpoints (`POST /api/pdf/lonespec`, `GET /api/pdf/lonespec/me`, `GET /api/assistant/slips`); a helper for idempotent slip-row allocation; integration tests that cover 409 / 400 / 200 / 403 / first-issue / replay / cross-assistant IDOR.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-salary-slip/09-CONTEXT.md
@.planning/phases/09-salary-slip/09-RESEARCH.md
@.planning/phases/09-salary-slip/09-UI-SPEC.md
@server/src/routes/pdf.ts
@server/src/middleware/auth.ts
@server/src/lib/payrollSlipUtils.ts
@server/src/lib/pdfSlipRenderer.ts

<interfaces>
<!-- Contracts Plan 03 wires against. -->

From server/src/lib/payrollSlipUtils.ts (shipped in Plan 02):
```typescript
export function buildAnhorigSlip(input: {
  profile: ProfileLike;
  assistant: AssistantLike;
  payrollRecord: PayrollRecordLike;
  absences: AbsenceRow[];
  documentNumber: string;
  payDate: string;                                // YYYY-MM-DD
  payMethod: "bankgiro" | "swish" | "kontant";
}): SlipFields;
```

From server/src/lib/pdfSlipRenderer.ts (shipped in Plan 02):
```typescript
export async function renderAnhorigSlipPdf(fields: SlipFields): Promise<Buffer>;
```

From server/src/middleware/auth.ts (existing):
```typescript
export interface AuthRequest extends Request {
  userId?: number;
  role?: string;
  assistantId?: string;   // populated by requireAuth from JWT payload
}
export function requireAuth(req, res, next);
export function requireGuardian(req, res, next);
export function requireAssistantAccess(req, res, next);  // accepts both "assistant" and "guardian" roles; req.assistantId may be undefined
```

From server/src/db/schema.ts (after Plan 01):
```typescript
export const paymentSlips: PgTableWithColumns<...>;
// Columns: id, payrollRecordId, assistantId, reportMonth, documentNumber, sequence, issuedAt, payDate, payMethod, createdAt
// Unique: (assistantId, reportMonth, sequence)
```

From server/src/lib/id.ts (existing):
```typescript
export function newId(prefix: string): string;  // ulid-backed; used as newId("slip") for payment_slips.id
```

From server/src/routes/pdf.ts (existing 4805 pattern at lines 338-448):
```typescript
// Template to mirror — assistantId regex validation, assistant lookup,
// approved-payroll gate, profile lookup, field map build, buffer send.
```

From server/src/routes/assistant.ts (existing /me pattern at lines 12-22):
```typescript
// Uses `if (!req.assistantId) return res.status(400).json({ error: "No assistant linked to this account" });`
// Template for the new GET /slips listing.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add `issueOrReuseSlip()` helper + POST /api/pdf/lonespec + integration tests</name>
  <files>
    server/src/routes/pdf.ts
    server/src/routes/__tests__/pdf-lonespec.test.ts
  </files>
  <read_first>
    - server/src/routes/pdf.ts (lines 338-448 — the 4805 endpoint is the template; study the middleware order, error response shapes, and filename construction)
    - server/src/middleware/auth.ts (confirm requireAuth + requireGuardian signatures)
    - server/src/lib/payrollSlipUtils.ts + server/src/lib/pdfSlipRenderer.ts (confirm function signatures + SlipFields shape from Plan 02)
    - server/src/db/schema.ts (confirm paymentSlips columns + paymentMethodEnum values post-Plan-01)
    - .planning/phases/09-salary-slip/09-CONTEXT.md (§D-04 doc number, §D-05 replay, §D-08 endpoints, §D-09 pay date, §D-10 pay method, §D-11 historical, §D-12 rate fallback)
    - .planning/phases/09-salary-slip/09-RESEARCH.md (§Architecture Pattern 1 full sample; §Pattern 3 sequence allocation; §Pitfall 5 route order; §Pitfall 8 frozen pay date)
    - .planning/phases/09-salary-slip/09-UI-SPEC.md (§Copywriting — error message Swedish strings)
  </read_first>
  <behavior>
    - Test A (SLIP-01 happy path — guardian POST): Given approved payroll + hourlyRateOverride=254.10 + defaultPayDay=25 + paymentMethod=bankgiro, POST /api/pdf/lonespec with {year:"2026", month:"03", assistantId:"a_rose"} returns 200, Content-Type=application/pdf, body starts with `%PDF-`, Content-Disposition matches `attachment; filename="lonespec-2026-03-Rose-Karon.pdf"`.
    - Test B (SLIP-01 approval gate — 409): Given payroll status="draft", POST returns 409 with JSON error matching `Lönekörningen är inte godkänd för denna månad.`
    - Test C (SLIP-01 rate-NULL gate — 400): Given payroll approved but hourlyRateOverride IS NULL, POST returns 400 with JSON error containing the assistant name + Swedish text matching `Timlön saknas för {name}. Sätt timlönen i Inställningar → Assistenter.`
    - Test D (SLIP-01 invalid assistantId): POST with assistantId="../etc" returns 400 with `Invalid assistantId`.
    - Test E (SLIP-05 first issue): Given clean DB (no payment_slips rows), first POST inserts exactly one paymentSlips row with documentNumber="LS-2026-03-001", sequence=1, payDate="2026-04-25", payMethod="bankgiro". Verified via direct DB query after the POST.
    - Test F (SLIP-05 replay reuses row): Second POST for same (assistant, month) → DB still has exactly 1 row with same id, same documentNumber, same issuedAt, same payDate. The PDF body is returned fresh on each call.
    - Test G (SLIP-05 different month → new row + same assistant): POST for 2026-04 after 2026-03 → DB has 2 rows, one per month, each sequence=1, documentNumbers "LS-2026-03-001" and "LS-2026-04-001".
    - Test H (SLIP-05 different assistant, same month → new row): POST for a_mikael in 2026-03 after a_rose → DB has 2 rows, both "LS-2026-03-001" but different assistantId.
    - Test I (SLIP-05 unique index enforcement): Attempt to insert a duplicate row via direct DB call bypassing the helper → Postgres rejects with SQLSTATE 23505. (This test may be integration-only — if it proves fragile against Vitest's DB isolation, convert to a direct `db.insert(...).onConflictDoNothing()` check and assert no row was added.)
    - Test J (authorization — missing JWT): POST without Authorization header returns 401.
    - Test K (authorization — assistant role): POST with assistant JWT (not guardian) returns 403.
  </behavior>
  <action>
**a) Extend `server/src/routes/pdf.ts`** — add at the end of the file, before `export default router`:

1. **Imports** (append to existing import block):
```typescript
import { paymentSlips, profile } from "../db/schema";           // profile already imported by existing routes? Re-use if yes.
import { newId } from "../lib/id";
import { buildAnhorigSlip, type SlipFields } from "../lib/payrollSlipUtils";
import { renderAnhorigSlipPdf } from "../lib/pdfSlipRenderer";
import { absences } from "../db/schema";                         // for absences lookup
```

2. **Private helper `issueOrReuseSlip()`**:
```typescript
async function issueOrReuseSlip(params: {
  assistantId: string;
  reportMonth: string;              // "YYYY-MM"
  payrollRecordId: string;
  payDate: string;                  // "YYYY-MM-DD"
  payMethod: "bankgiro" | "swish" | "kontant";
}): Promise<{ id: string; documentNumber: string; payDate: string; payMethod: "bankgiro" | "swish" | "kontant"; issuedAt: Date }> {
  // 1. Look for an existing row (D-05 replay reuses).
  const existing = await db.select().from(paymentSlips).where(and(
    eq(paymentSlips.assistantId, params.assistantId),
    eq(paymentSlips.reportMonth, params.reportMonth),
  )).limit(1);
  if (existing.length > 0) {
    const row = existing[0];
    return {
      id: row.id,
      documentNumber: row.documentNumber,
      payDate: row.payDate,
      payMethod: row.payMethod as "bankgiro" | "swish" | "kontant",
      issuedAt: row.issuedAt,
    };
  }
  // 2. Allocate next sequence (always 1 in v1.0.1 given D-05 overwrite semantics, but compute defensively).
  const peers = await db.select().from(paymentSlips).where(and(
    eq(paymentSlips.assistantId, params.assistantId),
    eq(paymentSlips.reportMonth, params.reportMonth),
  ));
  const nextSeq = peers.length === 0 ? 1 : Math.max(...peers.map(p => p.sequence)) + 1;
  const padded = String(nextSeq).padStart(3, "0");
  const documentNumber = `LS-${params.reportMonth}-${padded}`;
  // 3. Insert. If a race loses, catch 23505 and re-select.
  try {
    const [row] = await db.insert(paymentSlips).values({
      id: newId("slip"),
      payrollRecordId: params.payrollRecordId,
      assistantId: params.assistantId,
      reportMonth: params.reportMonth,
      documentNumber,
      sequence: nextSeq,
      payDate: params.payDate,
      payMethod: params.payMethod,
    }).returning();
    return {
      id: row.id,
      documentNumber: row.documentNumber,
      payDate: row.payDate,
      payMethod: row.payMethod as "bankgiro" | "swish" | "kontant",
      issuedAt: row.issuedAt,
    };
  } catch (err: any) {
    // Postgres unique_violation on the (assistantId, reportMonth, sequence) index
    if (err?.code === "23505") {
      const [again] = await db.select().from(paymentSlips).where(and(
        eq(paymentSlips.assistantId, params.assistantId),
        eq(paymentSlips.reportMonth, params.reportMonth),
      )).limit(1);
      if (again) return {
        id: again.id, documentNumber: again.documentNumber,
        payDate: again.payDate, payMethod: again.payMethod as any, issuedAt: again.issuedAt,
      };
    }
    throw err;
  }
}

function computePayDate(reportMonth: string, defaultPayDay: number): string {
  // reportMonth = "2026-03" → payDate = "2026-04-25" (or next-month-after with day clamp 1..28)
  const [y, m] = reportMonth.split("-").map(n => parseInt(n, 10));
  const payYear  = m === 12 ? y + 1 : y;
  const payMonth = m === 12 ? 1 : m + 1;
  const day      = Math.min(Math.max(defaultPayDay || 25, 1), 28);
  return `${payYear}-${String(payMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
```

3. **`POST /lonespec` handler** — append after the 4805 handler (lines 338-448 are the template). Route order note (Pitfall 5): the GET /lonespec/me route goes FIRST in Task 2 — but since the HTTP verbs differ here, order doesn't matter for conflict. Still keep the more-specific route (`/me`) before the param-style routes by convention.

```typescript
router.post("/lonespec", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { year, month, assistantId } = req.body as { year?: string; month?: string; assistantId?: string };

    // Input validation (mirrors pdf.ts:346)
    if (!assistantId || !/^[a-zA-Z0-9_-]+$/.test(assistantId)) {
      return res.status(400).json({ error: "Invalid assistantId" });
    }
    if (!year || !/^\d{4}$/.test(year) || !month || !/^\d{1,2}$/.test(month)) {
      return res.status(400).json({ error: "Invalid year or month" });
    }

    const mm = month.padStart(2, "0");
    const yearMonth = `${year}-${mm}`;

    // Load assistant (mirrors pdf.ts:359)
    const [asst] = await db.select().from(assistants).where(eq(assistants.id, assistantId));
    if (!asst) return res.status(404).json({ error: "Assistant not found" });

    // D-12: rate-NULL gate — return Swedish error BEFORE checking payroll so the guardian knows
    // to set the rate, not to re-approve payroll.
    if (asst.hourlyRateOverride == null) {
      return res.status(400).json({
        error: `Timlön saknas för ${asst.name}. Sätt timlönen i Inställningar → Assistenter.`,
      });
    }

    // D-08: approval gate (mirrors pdf.ts:363-374 shape, Swedish error text)
    const [pr] = await db.select().from(payrollRecords).where(and(
      eq(payrollRecords.assistantId, assistantId),
      eq(payrollRecords.month, yearMonth),
      eq(payrollRecords.status, "approved"),
    ));
    if (!pr) {
      return res.status(409).json({ error: "Lönekörningen är inte godkänd för denna månad." });
    }

    // Load profile + absences
    const [prof] = await db.select().from(profile).limit(1);
    if (!prof) return res.status(500).json({ error: "Profile not found" });
    const absenceRows = await db.select().from(absences);

    // Compute payDate from profile.defaultPayDay (D-09) — frozen on payment_slips
    const payDate = computePayDate(yearMonth, prof.defaultPayDay ?? 25);
    const payMethod = (asst.paymentMethod ?? "bankgiro") as "bankgiro" | "swish" | "kontant";

    // Issue or reuse (D-05)
    const slipMeta = await issueOrReuseSlip({
      assistantId,
      reportMonth: yearMonth,
      payrollRecordId: pr.id,
      payDate,
      payMethod,
    });

    // Build field map + render PDF
    const fields: SlipFields = buildAnhorigSlip({
      profile: prof,
      assistant: asst,
      payrollRecord: pr,
      absences: absenceRows.map(a => ({
        assistantId: a.assistantId,
        startDate: a.startDate,
        endDate: a.endDate,
        absenceType: a.absenceType,
      })),
      documentNumber: slipMeta.documentNumber,
      payDate: slipMeta.payDate,
      payMethod: slipMeta.payMethod,
    });
    const pdfBuffer = await renderAnhorigSlipPdf(fields);

    const safeName = asst.name.replace(/\s+/g, "-").replace(/[^\w\-.]/g, "");  // defensive against any pathological name
    const filename = `lonespec-${yearMonth}-${safeName}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error("[pdf] lonespec error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

**b) Write `server/src/routes/__tests__/pdf-lonespec.test.ts`** — integration tests for behaviors A through K above. Follow the existing test conventions in `server/src/routes/__tests__/` (inspect whatever pattern is present there — supertest + app mount, or in-process fetch + test-only server boot). The key fixtures needed:
- A guardian auth JWT (role=guardian, userId)
- An assistant auth JWT (role=assistant, assistantId="a_rose")
- Seeded assistants row "a_rose" with hourlyRateOverride=254.10, paymentMethod="bankgiro", pno="8011155069"
- Seeded profile row with patientPno="2015...", guardianPno, patientRequiresRepresentative=false, defaultPayDay=25, patientName, guardianName
- Seeded payrollRecords row for (a_rose, "2026-03") with status="approved", billableHours=215, grossPay=54631.5, prelimTaxRateSnapshot=0.30, hourlyRateUsed=254.10, salaryModelUsed="anhörig"
- Seeded absences [] initially; add rows per test as needed
- Test cleanup truncates paymentSlips between tests

Each test ends with explicit DB row assertions using `db.select().from(paymentSlips)` — not just HTTP assertions.
  </action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/server && npm test -- --run pdf-lonespec 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "router.post(\"/lonespec\"" server/src/routes/pdf.ts` returns exactly 1 match
    - `grep -n "async function issueOrReuseSlip" server/src/routes/pdf.ts` returns exactly 1 match
    - `grep -n "function computePayDate" server/src/routes/pdf.ts` returns exactly 1 match
    - `grep -n "Timlön saknas för" server/src/routes/pdf.ts` returns exactly 1 match (D-12 Swedish error)
    - `grep -n "Lönekörningen är inte godkänd för denna månad" server/src/routes/pdf.ts` returns exactly 1 match (D-08 Swedish error)
    - `grep -nF 'LS-${params.reportMonth}' server/src/routes/pdf.ts` returns at least 1 match (doc-number format per D-04; fixed-string grep, no escaping)
    - `grep -nE 'router\.post\("/lonespec".*requireAuth.*requireGuardian' server/src/routes/pdf.ts` returns exactly 1 match (anchors on the new handler; not dependent on existing-endpoint counts)
    - `server/src/routes/__tests__/pdf-lonespec.test.ts` exists with `grep -c "^\\s*it\\(" ...` returning >= 11 (tests A through K)
    - `npm test -- --run pdf-lonespec` reports all tests passing
    - `npx tsc --noEmit -p server/tsconfig.json` exits 0
  </acceptance_criteria>
  <done>Guardian POST endpoint live with both gates (409 + 400) enforced; payment_slips row allocated on first issue, reused on replay; 11 integration tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GET /api/pdf/lonespec/me + GET /api/assistant/slips + tests</name>
  <files>
    server/src/routes/pdf.ts
    server/src/routes/assistant.ts
    server/src/routes/__tests__/pdf-lonespec.test.ts
    server/src/routes/__tests__/assistant-slips.test.ts
  </files>
  <read_first>
    - server/src/routes/pdf.ts (after Task 1 — you're appending another route)
    - server/src/routes/assistant.ts (lines 12-22 for the `/me` pattern that guards on `req.assistantId`)
    - server/src/middleware/auth.ts (requireAssistantAccess semantics — accepts BOTH roles but may leave req.assistantId undefined for a guardian without a linked assistant)
    - .planning/phases/09-salary-slip/09-RESEARCH.md (§Pitfall 6 — cross-assistant IDOR on /me; §Pitfall 7 — undefined req.assistantId; §Open Questions #2 — JSON listing endpoint placement)
    - .planning/phases/09-salary-slip/09-UI-SPEC.md (§AssistantDashboard — listing shape + sort order)
  </read_first>
  <behavior>
    - Test L (SLIP-02 /me happy path): Assistant Rose authenticates, POSTs a slip via guardian first to create the row, then GET /api/pdf/lonespec/me?month=2026-03 returns 200 + PDF + documentNumber matches the previously-issued row's number.
    - Test M (SLIP-02 /me reads JWT not query): Rose's JWT has assistantId="a_rose". GET /api/pdf/lonespec/me?month=2026-03&assistantId=a_mikael returns Rose's slip (not Mikael's) — the query param is IGNORED. Assert by checking returned PDF filename contains "Rose" not "Mikael".
    - Test N (SLIP-02 /me 400 when no linked assistant): Guardian JWT (role=guardian, assistantId undefined) hits GET /me → 400 with error "No assistant linked to this account" (mirrors assistant.ts:14 pattern).
    - Test O (SLIP-02 /me 409 when payroll not approved): Assistant JWT, GET /me?month=2026-03 where payroll for that month is draft → 409 Swedish error (same as guardian path).
    - Test P (SLIP-02 /me 400 when rate NULL): Assistant JWT, hourlyRateOverride=null → 400 Swedish error.
    - Test Q (SLIP-02 /me missing month param): GET /me without ?month → 400 "Invalid month".
    - Test R (SLIP-02 /slips listing happy path): Seed 3 paymentSlips rows for a_rose across 3 months, 1 row for a_mikael. GET /api/assistant/slips with Rose's JWT returns exactly 3 rows, sorted reportMonth DESC then issuedAt DESC. Each row includes id, documentNumber, reportMonth, issuedAt, payDate, payMethod. Mikael's row is absent.
    - Test S (SLIP-02 /slips IDOR attempt): GET /api/assistant/slips?assistantId=a_mikael with Rose's JWT returns Rose's rows only (query param ignored).
    - Test T (SLIP-02 /slips 400 when no linked assistant): Guardian JWT (assistantId undefined) → 400.
    - Test U (SLIP-02 /slips 401 unauthenticated): No Authorization header → 401.
  </behavior>
  <action>
**a) Add `GET /lonespec/me` handler** to `server/src/routes/pdf.ts` — append BEFORE `export default router`. Per RESEARCH Pitfall 5, verbs differ between POST /lonespec and GET /lonespec/me so Express ordering is safe; still put `/me` before any hypothetical future `/:id` routes.

```typescript
router.get("/lonespec/me", requireAuth, requireAssistantAccess, async (req: AuthRequest, res) => {
  try {
    // Pitfall 6 + 7: derive assistantId from JWT ONLY. Never read query/body.
    const assistantId = req.assistantId;
    if (!assistantId) {
      return res.status(400).json({ error: "No assistant linked to this account" });
    }

    const month = String(req.query.month ?? "");
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "Invalid month" });
    }

    const [asst] = await db.select().from(assistants).where(eq(assistants.id, assistantId));
    if (!asst) return res.status(404).json({ error: "Assistant not found" });

    // D-12 gate
    if (asst.hourlyRateOverride == null) {
      return res.status(400).json({
        error: `Timlön saknas för ${asst.name}. Sätt timlönen i Inställningar → Assistenter.`,
      });
    }

    // D-08 approval gate
    const [pr] = await db.select().from(payrollRecords).where(and(
      eq(payrollRecords.assistantId, assistantId),
      eq(payrollRecords.month, month),
      eq(payrollRecords.status, "approved"),
    ));
    if (!pr) return res.status(409).json({ error: "Lönekörningen är inte godkänd för denna månad." });

    const [prof] = await db.select().from(profile).limit(1);
    if (!prof) return res.status(500).json({ error: "Profile not found" });
    const absenceRows = await db.select().from(absences);

    const payDate = computePayDate(month, prof.defaultPayDay ?? 25);
    const payMethod = (asst.paymentMethod ?? "bankgiro") as "bankgiro" | "swish" | "kontant";
    const slipMeta = await issueOrReuseSlip({
      assistantId, reportMonth: month, payrollRecordId: pr.id, payDate, payMethod,
    });

    const fields = buildAnhorigSlip({
      profile: prof, assistant: asst, payrollRecord: pr,
      absences: absenceRows.map(a => ({ assistantId: a.assistantId, startDate: a.startDate, endDate: a.endDate, absenceType: a.absenceType })),
      documentNumber: slipMeta.documentNumber,
      payDate: slipMeta.payDate,
      payMethod: slipMeta.payMethod,
    });
    const pdfBuffer = await renderAnhorigSlipPdf(fields);

    const safeName = asst.name.replace(/\s+/g, "-").replace(/[^\w\-.]/g, "");
    const filename = `lonespec-${month}-${safeName}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error("[pdf] lonespec/me error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

**b) Add `GET /slips` handler to `server/src/routes/assistant.ts`** — append near the existing `/me` handler (lines 12-22). Follow the same pattern: `requireAuth + requireAssistantAccess`, reject undefined `req.assistantId`, select with `eq(paymentSlips.assistantId, req.assistantId!)`.

```typescript
// Append to assistant.ts imports:
import { paymentSlips } from "../db/schema";
import { desc } from "drizzle-orm";

// Append as a new route:
router.get("/slips", requireAuth, requireAssistantAccess, async (req: AuthRequest, res) => {
  if (!req.assistantId) {
    return res.status(400).json({ error: "No assistant linked to this account" });
  }
  const rows = await db.select().from(paymentSlips)
    .where(eq(paymentSlips.assistantId, req.assistantId))
    .orderBy(desc(paymentSlips.reportMonth), desc(paymentSlips.issuedAt));
  // Explicit projection — do NOT leak payrollRecordId to the client (reduces coupling).
  res.json(rows.map(r => ({
    id: r.id,
    reportMonth: r.reportMonth,
    documentNumber: r.documentNumber,
    issuedAt: r.issuedAt,
    payDate: r.payDate,
    payMethod: r.payMethod,
  })));
});
```

**c) Extend the test file** (`pdf-lonespec.test.ts`) or create `assistant-slips.test.ts` — Claude's discretion on split; merging keeps all slip-endpoint tests in one place and simplifies fixture setup. Add tests L through U covering all behaviors above. Each test seeds payment_slips rows via the helper (either call the POST /lonespec as a side effect, or direct `db.insert(paymentSlips).values(...)` if a test requires specific `issuedAt` ordering).

**Security-critical assertions** (Pitfall 6):
- Test M — after response, parse `Content-Disposition` filename and assert it contains `"Rose"` not `"Mikael"`.
- Test S — parse JSON response and assert every returned row has `assistantId === "a_rose"` (or verify the projection strips assistantId and returned IDs all match Rose's slips as seeded).
  </action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/server && npm test -- --run "pdf-lonespec|assistant-slips" 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "router.get(\"/lonespec/me\"" server/src/routes/pdf.ts` returns exactly 1 match
    - `grep -n "router.get(\"/slips\"" server/src/routes/assistant.ts` returns exactly 1 match
    - `grep -n "req.assistantId" server/src/routes/pdf.ts` returns >= 2 matches (both /me route references — NONE from query/body)
    - `grep -nE "req\\.query\\.assistantId|req\\.body\\.assistantId" server/src/routes/pdf.ts` — within the /me handler scope (after `router.get("/lonespec/me"`), returns 0 matches (Pitfall 6 guard)
    - `grep -n "desc(paymentSlips.reportMonth)" server/src/routes/assistant.ts` returns exactly 1 match
    - `grep -cE "^\\s*it\\(" server/src/routes/__tests__/pdf-lonespec.test.ts` returns >= 17 (11 from Task 1 + 6 new: L, M, N, O, P, Q)
    - `grep -cE "^\\s*it\\(" server/src/routes/__tests__/assistant-slips.test.ts` returns >= 4 (R, S, T, U) — OR if merged into pdf-lonespec.test.ts, that file's count is >= 21
    - Test M specifically asserts the Content-Disposition filename contains "Rose" not "Mikael" (grep the test source for that assertion)
    - `npm test -- --run "pdf-lonespec|assistant-slips"` reports all tests passing
    - `npx tsc --noEmit -p server/tsconfig.json` exits 0
  </acceptance_criteria>
  <done>Two new GET endpoints ship with cross-assistant IDOR guard verified by tests; listing endpoint sorts correctly; guardian-without-linked-assistant gated to 400; all integration tests green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client→POST /api/pdf/lonespec | Guardian-authenticated; `assistantId` from body is trusted AFTER requireGuardian + regex validation |
| client→GET /api/pdf/lonespec/me | Assistant OR guardian-linked; `assistantId` MUST come from JWT (Pitfall 6) |
| client→GET /api/assistant/slips | Same as above |
| server→Postgres | drizzle parameterises all values; unique index on (assistantId, reportMonth, sequence) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-20 | E (Elevation / IDOR) | GET /api/pdf/lonespec/me reading assistantId from query | mitigate | Handler reads assistantId from req.assistantId (populated by requireAuth from JWT) ONLY. Test M proves cross-assistant query param is ignored. Acceptance criterion greps for req.query.assistantId / req.body.assistantId — must be zero in the /me scope. |
| T-09-21 | E (IDOR) | GET /api/assistant/slips filtering by query | mitigate | `where(eq(paymentSlips.assistantId, req.assistantId))` — JWT-only. Test S proves query param is ignored. |
| T-09-22 | T (Tampering) | POST /api/pdf/lonespec with payroll-not-approved bypass | mitigate | 409 gate queries `payrollRecords.status === "approved"` in the same SQL statement; cannot be bypassed by client. Test B proves. |
| T-09-23 | T | POST /api/pdf/lonespec with hourlyRateOverride NULL → emit garbage numbers | mitigate | 400 gate before loading payrollRecord; Test C proves. |
| T-09-24 | T | Document number collision | mitigate | Unique index `payment_slips_assistant_month_seq_uniq` enforced at DB level; allocator catches SQLSTATE 23505 + reselects (race-safe). Test I attempts duplicate insert. |
| T-09-25 | I (Info Disclosure) | Content-Disposition filename includes untrusted assistant name | mitigate | `assistant.name.replace(/\\s+/g, "-").replace(/[^\\w\\-.]/g, "")` strips path-traversal chars. Name is DB-sourced (trusted) but defensive strip is cheap. Mirror the existing 4805 filename pattern (pdf.ts:438) and extend with the non-word-char strip. |
| T-09-26 | I | Error responses leaking DB details | mitigate | Catch-all returns generic `Internal server error`. Only assistant name is exposed in 400 (the caller already knows it). |
| T-09-27 | I | Logging slip contents (PII) | mitigate | Only `console.error("[pdf] lonespec error:", e)` is used (exception object, no request body). No `console.log(fields)`. Acceptance criterion for Plan 02 already greps for this. |
| T-09-28 | S (Spoofing) | Missing JWT | mitigate | requireAuth on all three routes returns 401. Tests J + U prove. |
| T-09-29 | D (Denial of Service) | Repeated /lonespec calls for same month | accept | Replay reuses the DB row (no unbounded growth); pdfkit render is ~30-80ms; rate limiting is an infra concern |
</threat_model>

<verification>
**Post-plan verification checks:**

1. **All endpoint tests green:** `cd server && npm test -- --run "pdf-lonespec|assistant-slips"` — 0 failures, >= 21 tests total.
2. **Full server suite green:** `cd server && npm test` — 0 failures (no regression in Phase 7/8).
3. **Type check clean:** `cd server && npx tsc --noEmit -p tsconfig.json` exits 0.
4. **IDOR guard grep:** Within the /me handler scope, no reads from `req.query.assistantId` or `req.body.assistantId`.
5. **Swedish error messages present:** The two D-08/D-12 Swedish strings grep in pdf.ts.
6. **Manual smoke:** `curl -X POST http://localhost:3000/api/pdf/lonespec -H "Authorization: Bearer {guardian-jwt}" -H "Content-Type: application/json" -d '{"year":"2026","month":"03","assistantId":"{known-approved}"}' --output /tmp/smoke.pdf` yields a file with `%PDF-` header (optional — tests cover this path).
</verification>

<success_criteria>
- SLIP-01: Guardian POST returns 200 + PDF for approved payroll; 409 otherwise; 400 on NULL rate. Proven by tests A, B, C.
- SLIP-02: Assistant GET /me returns own slip, ignores query-param IDOR attempts, 400 when no linked assistant. Proven by tests L, M, N.
- SLIP-02: Assistant GET /slips lists own slips only, sorted newest-first. Proven by tests R, S.
- SLIP-05: First issue allocates LS-YYYY-MM-001; replay reuses same row. Proven by tests E, F.
- SLIP-07: Endpoint reads payroll_records.salaryModelUsed + hourlyRateUsed via the builder (no recomputation). Confirmed by Plan 02 tests + Plan 03's pass-through of `pr` to `buildAnhorigSlip`.
</success_criteria>

<output>
After completion, create `.planning/phases/09-salary-slip/09-03-SUMMARY.md` documenting:
- Three endpoints live (method + path + auth middleware + gates)
- `issueOrReuseSlip()` behavior summary
- Test count per SLIP-XX requirement
- Any changes from the plan (e.g. if assistant-slips tests were merged into pdf-lonespec.test.ts)
</output>
