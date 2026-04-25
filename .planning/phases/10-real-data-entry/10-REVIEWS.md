---
phase: 10
reviewers: [coderabbit]
reviewed_at: 2026-04-25T00:05:00Z
plans_reviewed: [10-01-PLAN.md, 10-02-PLAN.md, 10-03-PLAN.md]
review_target: PR #7 (milestone/v1.0.1 → main, 273 commits)
findings_total: 23
---

# Cross-AI PR Review — Milestone v1.0.1 (PR #7)

**Note on independence:** Only one external CLI was available (`coderabbit`). Gemini, Codex, and OpenCode are not installed; Claude is the current runtime and was skipped per the GSD review spec. The "consensus" section below is therefore a single-reviewer triage, not a multi-AI agreement.

CodeRabbit reviewed the actual git diff of `milestone/v1.0.1` against `main` — 97 code files, +18,745 / -8,547 lines plus the `.planning/` artefacts.

---

## CodeRabbit Review

Starting CodeRabbit review in plain text mode...

Review directory: /Users/rosekaron/Desktop/Kalinga/assistansportal

Connecting to review service
Setting up
Preparing sandbox
Summarizing
Tools completed
Reviewing

============================================================================
File: server/src/routes/entries.ts
Line: 45 to 48
Type: potential_issue

Comment:
Avoid leaking internal error details to clients.

Returning e.message directly can expose sensitive database information (constraint names, table structure, connection details) to API consumers. Consider logging the full error server-side but returning a generic message to clients.



🛡️ Proposed fix

   } catch (e) {
     console.error("[entries] POST error:", e);
-    res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
+    res.status(500).json({ error: "Internal server error" });
   }

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @server/src/routes/entries.ts around lines 45 - 48, The catch block in the POST handler currently returns e.message to clients, which can leak sensitive internals; change it so you still log the full error server-side (using console.error or processLogger with the caught error e in the catch block) but always send a generic response to clients (e.g., res.status(500).json({ error: "Internal server error" }) or similar). Keep the existing catch block around the POST route in entries.ts (the catch handling code that calls console.error and res.status), remove usage of e.message in the response, and ensure any error details remain only in server logs.

============================================================================
File: server/src/middleware/auth.ts
Line: 43 to 46
Type: potential_issue

Comment:
Error message doesn't match the check being performed.

This middleware enforces authorization (role-based access), not authentication. The error message "Authentication required" is misleading since authentication is already handled by requireAuth. Consider a message that reflects the actual requirement.




📝 Suggested fix

 export function requireAssistantAccess(req: AuthRequest, res: Response, next: NextFunction) {
   if (req.role === "assistant" || req.role === "guardian") return next();
-  return res.status(403).json({ error: "Authentication required" });
+  return res.status(403).json({ error: "Assistant or guardian access required" });
 }

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @server/src/middleware/auth.ts around lines 43 - 46, The middleware requireAssistantAccess currently returns a misleading message "Authentication required" even though it enforces role-based authorization; update the error response to reflect authorization/role failure (keep the 403 status) — e.g., return res.status(403).json({ error: "Forbidden: assistant or guardian role required" }) — and ensure any references to requireAuth remain unchanged.

============================================================================
File: .planning/phases/07-foundation-schema-cleanup/07-03-PLAN.md
Line: 134 to 135
Type: potential_issue

Comment:
Duplicate acceptance criterion.

Lines 134 and 135 contain the exact same grep command:

- ! grep -q 'router\\.(get|post|delete)\\("/slots' server/src/routes/misc.ts
- ! grep -q 'router\\.(get|post|delete)\\("/slots' server/src/routes/misc.ts


Remove the duplicate line.

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/07-foundation-schema-cleanup/07-03-PLAN.md around lines 134 - 135, Remove the duplicate acceptance criterion by deleting the repeated grep line; specifically, in the 07-03-PLAN.md section where the command string "grep -q 'router\\.(get|post|delete)\\(\"/slots' server/src/routes/misc.ts" appears twice, keep a single instance and remove the second occurrence so the criterion is not duplicated.

============================================================================
File: server/src/routes/auth.ts
Line: 229 to 234
Type: potential_issue

Comment:
Add unique constraint on (assistantId, guardianId) to assistantGuardianLinks table.

The schema shows no unique constraint on (assistantId, guardianId), making onConflictDoNothing() ineffective at preventing duplicates. Without this constraint, the insert at lines 229-234 will always succeed, potentially creating duplicate links for the same assistant-guardian pair. The follow-up update becomes the only deduplication mechanism, which is unreliable.

Define a unique index on these columns in the schema:
export const assistantGuardianLinks = pgTable("assistant_guardian_links", {
  // ... existing fields
}, (t) => ({
  uniqueLink: uniqueIndex("assistant_guardian_links_unique").on(t.assistantId, t.guardianId),
}));

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @server/src/routes/auth.ts around lines 229 - 234, The insert into assistantGuardianLinks uses .onConflictDoNothing() but the schema lacks a unique constraint on (assistantId, guardianId), so conflicts are never detected; update the table definition for assistantGuardianLinks to add a unique index (e.g., assistant_guardian_links_unique) on the assistantId and guardianId columns (using the uniqueIndex helper in the pgTable definition) so that the insert with onConflictDoNothing() will actually prevent duplicates; reference the assistantGuardianLinks table, the assistantId and guardianId columns, and name the index (assistant_guardian_links_unique) accordingly.

============================================================================
File: .planning/milestones/v1.0-ROADMAP.md
Line: 648 to 652
Type: potential_issue

Comment:
Inconsistent completion status for Phase 6.

Line 651 shows Phase 6 plan as incomplete with [ ]:
- [ ] 06-01-PLAN.md — Fix OAuth redirect...


But the Progress table at line 666 shows Phase 6 as "Complete". This inconsistency could cause confusion during cold-start resumption.




Proposed fix

-- [ ] 06-01-PLAN.md — Fix OAuth redirect, add /calendars endpoint, wire real connect/disconnect/picker in Settings (Wave 1)
+- [x] 06-01-PLAN.md — Fix OAuth redirect, add /calendars endpoint, wire real connect/disconnect/picker in Settings (Wave 1)

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/milestones/v1.0-ROADMAP.md around lines 648 - 652, The roadmap shows an inconsistency: the Phase 6 item "- [ ] 06-01-PLAN.md — Fix OAuth redirect..." is marked incomplete but the Progress table later lists Phase 6 as "Complete"; update the markdown so both places match—either mark the checklist item as completed (change "[ ]" to "[x]") or change the Progress table entry to "Incomplete"—ensure you modify the specific checklist line containing "06-01-PLAN.md" and the Progress table row for "Phase 6" so they are consistent.

============================================================================
File: .planning/phases/09-salary-slip/09-02-slip-builder-and-renderer-PLAN.md
Line: 487 to 495
Type: potential_issue

Comment:
Malformed table row in threat model.

The table row at line 495 appears to be missing proper pipe formatting. The static analysis correctly flags this as a column count issue.




Verify table structure

Line 495 should follow the same pattern as lines 489-494. Ensure all columns are properly separated with | characters.

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/09-salary-slip/09-02-slip-builder-and-renderer-PLAN.md around lines 487 - 495, The table row for Threat ID T-09-15 is malformed and missing the proper pipe separators causing a column count mismatch; edit the row in .planning/phases/09-salary-slip/09-02-slip-builder-and-renderer-PLAN.md so it matches the same five-column pattern as the other rows (columns: Threat ID | Category | Component | Disposition | Mitigation Plan) by adding the missing | characters and ensuring the content for the A4 page/memory/rate-limiting entry is placed into the Mitigation Plan column; verify the row now has five | separators and the markdown table renders correctly.

============================================================================
File: .planning/phases/08-employer-representation-helper/08-VERIFICATION.md
Line: 108 to 113
Type: potential_issue

Comment:
Same table column mismatch at line 112.

The anti-patterns table header declares 5 columns but the — placeholder row has 6 pipe-delimited cells.

-| (none) | — | — | — | — |
+| (none) | — | — | — | — |


Actually the header has 5 columns: File | Line | Pattern | Severity | Impact, and row 114 has 5 cells too: (none) | — | — | — | —. The static analysis may be counting incorrectly due to surrounding context. Verify the table renders correctly in your markdown viewer.

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-employer-representation-helper/08-VERIFICATION.md around lines 108 - 113, The markdown table in .planning/phases/08-employer-representation-helper/08-VERIFICATION.md has a column-count mismatch between the header (File | Line | Pattern | Severity | Impact) and the placeholder/anti-pattern row which introduces an extra pipe-delimited cell; update the placeholder row so it has exactly five cells to match the header (and ensure the separator row uses the same number of columns), then re-render/preview the document to confirm the table displays correctly; check nearby entries referencing employer-representation.ts and pdf.ts to ensure no other rows have extra or missing pipes.

============================================================================
File: .planning/phases/08-employer-representation-helper/08-VERIFICATION.md
Line: 40 to 42
Type: potential_issue

Comment:
Markdown table has mismatched column count.

The table header on line 40-41 declares 4 columns (#, Truth, Status, Evidence), but the data rows contain pipe characters within the Evidence column content that are being interpreted as additional column delimiters. This causes the static analysis warning about 6 columns instead of 4.

Consider escaping the pipe characters in evidence text or restructuring the table.


Example fix for line 42

-| 1 | Helper returns structured shape with arbetsgivare always = patient identity | VERIFIED | server/src/lib/employer-representation.ts:85-98 returns {arbetsgivare:{name,pno,address}, företrädare, isMinor} with patientName/patientPno sourced from profile; 16 tests assert shape |
+| 1 | Helper returns structured shape with arbetsgivare always = patient identity | VERIFIED | server/src/lib/employer-representation.ts:85-98 returns {arbetsgivare:{name,pno,address}, företrädare, isMinor} with patientName/patientPno sourced from profile; 16 tests assert shape |


The issue is actually the nested {...} with commas creating visual confusion. The table parses correctly if there are exactly 4 | delimiters per row. Review rows 42-51 to ensure each has exactly 4 content cells.

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/08-employer-representation-helper/08-VERIFICATION.md around lines 40 - 42, The Markdown table header declares four columns but the Evidence cell contains pipe characters from the object-like text ({arbetsgivare:{name,pno,address}, företrädare, isMinor}) which are being parsed as additional column delimiters; fix by ensuring each row has exactly four cells—either escape the inner pipes or wrap the entire Evidence text in a code span/block (e.g. backticks) or replace internal commas/pipes so they don’t act as delimiters; update the row(s) containing the Evidence referencing server/src/lib/employer-representation.ts and the {arbetsgivare:{name,pno,address}, företrädare, isMinor} snippet to use one of these approaches so the table parses as four columns.

============================================================================
File: .planning/todos/pending/2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md
Line: 85 to 87
Type: potential_issue

Comment:
Clarify error-blocking vs override logic.

The blocking behavior description is ambiguous. Line 86 states that error severity shows a "Resolve X errors first" banner, but then says "Still allow override with a 'Proceed despite warnings' confirmation." The phrase "Proceed despite warnings" suggests overriding warnings, not errors.

Please clarify the intended behavior:
- Can error severity violations be overridden with explicit confirmation, or are they hard-blocking?
- If errors can be overridden, consider rephrasing to "Proceed despite errors" for consistency
- If errors are hard-blocking, remove the override sentence

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/todos/pending/2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md around lines 85 - 87, Clarify the blocking/override behavior for error severity in the "Blocking vs advisory" section: decide whether error is hard-blocking or overridable; if overridable, change the ambiguous sentence that currently reads "Still allow override with a 'Proceed despite warnings' confirmation" to explicitly say "Still allow override with a 'Proceed despite errors' confirmation" and ensure the Monthly Step 1 ("Approve time entries") text mentions the explicit override flow; if hard-blocking, remove the override sentence entirely so error clearly cannot be bypassed.

============================================================================
File: .planning/todos/pending/2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md
Line: 5
Type: potential_issue

Comment:
Clarify milestone version numbering.

The front matter specifies planned_milestone: v1.3, and line 15 confirms v1.3 scope, but the phase scope section (lines 115-122) labels the phases as "v1.1" and "v1.2". This creates ambiguity about which version numbers to use for tracking and implementation.

Consider either:
- Renaming phases to "v1.3 Phase 1" and "v1.3 Phase 2", or
- Using sub-versions like "v1.3.1" and "v1.3.2", or
- Clarifying that v1.1/v1.2 refer to earlier milestones and this todo spans multiple releases




Also applies to: 115-122

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/todos/pending/2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md at line 5, The front matter key planned_milestone currently reads "v1.3" while the phase labels in the "phase scope" section reference "v1.1" and "v1.2", causing ambiguity; update the phase labels in that section (the lines referencing "v1.1" and "v1.2") to clearly align with planned_milestone by renaming them to either "v1.3 Phase 1" and "v1.3 Phase 2" or to sub-versions like "v1.3.1" and "v1.3.2", and add a single clarifying line below the front matter (near planned_milestone) stating which convention you chose so readers know the mapping between phases and the planned_milestone.

============================================================================
File: client/e2e/gcal.spec.ts
Line: 243 to 266
Type: potential_issue

Comment:
Test may not match actual UI behavior.

The test mocks assistants as an empty array (line 76 via mockGuardianCommon), but Home.tsx matches GCal events to assistants by name. With no assistants, gcalShifts will be empty.

Additionally, line 265 expects "Assistance: Anna" to be visible, but Home.tsx renders shift time ranges (e.g., "08:00–16:00"), not the event summary.

Consider:
1. Adding an assistant mock that matches the event summary name
2. Asserting on the rendered shift times instead

await page.route("/api/assistants", (r) =>
  r.fulfill({ json: [{ id: "a1", name: "Anna", color: "#6366f1" }] })
);
// ...
await expect(page.getByText("08:00–16:00")).toBeVisible();

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @client/e2e/gcal.spec.ts around lines 243 - 266, The test currently mocks no assistants (mockGuardianCommon) so Home.tsx's logic that maps GCal events to assistants (producing gcalShifts) yields nothing and the test also asserts the event summary text which Home.tsx does not render; fix by adding a mocked assistant that matches the event summary (e.g., name "Anna") via the API route for "/api/assistants" so the event will map to that assistant, and change the assertion to check for the rendered shift time range shown by Home.tsx (e.g., "08:00–16:00") instead of "Assistance: Anna".

============================================================================
File: .planning/phases/10-real-data-entry/10-03-SUMMARY.md
Line: 64 to 69
Type: potential_issue

Comment:
Address the decimal format mismatch in the hourly rate input field.

The Settings input for hourlyRateOverride displays a placeholder using Swedish decimal format (254,10 with comma) but the onChange handler parses input via Number(e.target.value), which expects English format with a period. This mismatch likely caused the reported regression where 0.31 was saved instead of 254.10. The help text also reinforces the comma format ("Anhörigmodellen: 254,10 kr/tim"), making it confusing for users. Consider normalizing the input to accept both formats or explicitly documenting the expected format.

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @.planning/phases/10-real-data-entry/10-03-SUMMARY.md around lines 64 - 69, The Settings "Assistenter" hourlyRateOverride input shows a Swedish comma placeholder but its onChange currently uses Number(e.target.value) which expects a period, causing values like 254,10 to be parsed incorrectly; update the input handler (the component rendering hourlyRateOverride and its onChange) to normalize the value before Number()—for example replace comma with period or strip thousands separators, validate with a locale-aware parse, and ensure the displayed help text/placeholder and any save logic use the same normalized format so saved values match the intended 254.10 representation.

============================================================================
File: server/src/routes/assistants.ts
Line: 89 to 145
Type: potential_issue

Comment:
Wrap multi-table operations in a transaction to ensure atomicity.

The /register-self endpoint performs three separate database operations (insert assistant, update auth, insert guardian link) without transaction boundaries. If the process fails mid-way:
- Assistant created but auth not updated → orphan assistant record
- Assistant + auth updated but link fails → assistant can't clock in



🛡️ Proposed fix using Drizzle transaction

 router.post("/register-self", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
   try {
     const { name, pno, phone, minWeeklyHours, isFlexible } = req.body;
     if (!name) return res.status(400).json({ error: "Name is required" });

     // Check if guardian already has a linked assistant record
     const [existing] = await db.select().from(auth).where(eq(auth.id, req.userId!)).limit(1);
     if (existing?.assistantId) {
       return res.status(409).json({ error: "You already have a linked assistant record" });
     }

     // Safety check: make sure no OTHER assistant row already has this guardian's auth_id.
     const alreadyLinked = await db.select().from(assistants).where(eq(assistants.authId, req.userId!));
     if (alreadyLinked.length > 0) {
       return res.status(409).json({
         error: Your account is already linked to assistant "${alreadyLinked[0].name}". Remove that link before registering yourself as a new assistant.,
       });
     }

     const count = (await db.select().from(assistants)).length;
     const initials = name.trim().split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

+    const result = await db.transaction(async (tx) => {
+      const [row] = await tx.insert(assistants).values({
-    const [row] = await db.insert(assistants).values({
       id:            newId("a"),
       name:          name.trim(),
       initials,
       color:         COLORS[count % COLORS.length],
       email:         existing?.email ?? "",
       pno:           pno    ?? "",
       phone:         phone  ?? "",
       minWeeklyHours: minWeeklyHours ?? 0,
       isFlexible:    isFlexible ?? false,
       authId:        req.userId!,
       inviteStatus:  "accepted",
     }).returning();

     // Link auth account → assistant record
-    await db.update(auth)
+    await tx.update(auth)
       .set({ assistantId: row.id })
       .where(eq(auth.id, req.userId!));

     // Create active guardian link so clock-in works immediately
-    await db.insert(assistantGuardianLinks).values({
+    await tx.insert(assistantGuardianLinks).values({
       id:          newId("gl"),
       assistantId: row.id,
       guardianId:  req.userId!,
       active:      true,
     }).onConflictDoNothing();

+      return row;
+    });

-    res.status(201).json({ ok: true, assistantId: row.id, assistant: row });
+    res.status(201).json({ ok: true, assistantId: result.id, assistant: result });
   } catch (e) {

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @server/src/routes/assistants.ts around lines 89 - 145, The route handler for router.post("/register-self") performs three separate DB operations (db.insert(assistants), db.update(auth), db.insert(assistantGuardianLinks)) without a transaction; wrap the assistant creation, auth.update(assistantId), and assistantGuardianLinks insert in a single Drizzle transaction so they commit or rollback together, ensure you use the returned inserted assistant row (row.id) from the transactional insert for the subsequent update/insert calls, keep the onConflictDoNothing behaviour for assistantGuardianLinks inside the transaction, and catch/throw errors so the transaction will rollback on failure and you still return the proper HTTP response.

============================================================================
File: server/src/routes/gcal.ts
Line: 20 to 38
Type: potential_issue

Comment:
Security concern: JWT in query parameter may be logged in server access logs.

The requireGuardianOrQueryToken helper accepts JWT tokens via ?token= query parameter. While this enables OAuth redirects, query strings are commonly logged by web servers, load balancers, and CDNs, potentially exposing tokens in logs.

Additionally, this duplicates JWT verification logic from requireAuth in server/src/middleware/auth.ts. Consider extracting the common verification logic.



🔧 Suggested refactor to reduce duplication

+import { requireAuth, requireGuardian, AuthRequest, verifyJwt } from "../middleware/auth";
-import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";

 // ── Auth helper: accepts JWT from header OR ?token= query param ──
 function requireGuardianOrQueryToken(req: AuthRequest, res: Response, next: NextFunction) {
-  const header = req.headers.authorization;
-  if (header?.startsWith("Bearer ")) {
-    try {
-      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET || "dev_secret") as { userId: number; role?: string };
-      req.userId = payload.userId; req.role = payload.role;
-    } catch { return res.status(401).json({ error: "Invalid token" }); }
-  } else if (req.query.token) {
+  const token = req.headers.authorization?.startsWith("Bearer ")
+    ? req.headers.authorization.slice(7)
+    : req.query.token as string | undefined;
+
+  if (token) {
     try {
-      const payload = jwt.verify(req.query.token as string, process.env.JWT_SECRET || "dev_secret") as { userId: number; role?: string };
+      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret") as { userId: number; role?: string };
       req.userId = payload.userId; req.role = payload.role;
     } catch { return res.status(401).json({ error: "Invalid token" }); }
   } else {
     return res.status(401).json({ error: "Unauthorized" });
   }
   if (req.role !== "guardian") return res.status(403).json({ error: "Guardian access required" });
   next();
 }



If query-param tokens are required for the OAuth flow, consider using short-lived, single-use state tokens instead, or ensure your logging infrastructure redacts sensitive query parameters.

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @server/src/routes/gcal.ts around lines 20 - 38, The helper requireGuardianOrQueryToken currently accepts JWTs from req.query (exposing them to logs) and duplicates verification logic from requireAuth; extract the JWT verification into a single function (e.g., verifyJwt(token: string) in server/src/middleware/auth.ts that uses process.env.JWT_SECRET) and have both requireAuth and requireGuardianOrQueryToken call it; remove the generic query-param branch from requireGuardianOrQueryToken so it only reads the Authorization header, and if you must support OAuth callbacks implement a dedicated route/middleware (e.g., handleOAuthCallback) that consumes a single-use/short-lived token from the query, exchanges/sets a cookie or redirects immediately, and does not leave the token in logs or continue to treat query tokens as general auth.

============================================================================
File: server/src/lib/pdfSlipRenderer.ts
Line: 153
Type: potential_issue

Comment:
Add semesterYtdUsed field or remove misleading "tagna i år" from semester display.

Line 153 displays the same value twice: ${fields.hours.semester} dagar (tagna i år: ${fields.hours.semester}). The phrase "tagna i år" (taken this year) suggests year-to-date tracking, but SlipFields has no semesterYtdUsed field—only the period semester days.

This mirrors the VAB pattern (line 151: vab dagar (år till dato: ${fields.hours.vabYtdUsed}/120)), which correctly uses a separate YTD field. Either:
- Add semesterYtdUsed: number to SlipFields.hours and populate it like vabYtdUsed, or
- Remove the "(tagna i år: ...)" clause to match other absence types (sjuk, other)

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @server/src/lib/pdfSlipRenderer.ts at line 153, The semester row currently repeats fields.hours.semester in: drawAmountRow("Semester", ${fields.hours.semester} dagar (tagna i år: ${fields.hours.semester})); either add a new SlipFields.hours.semesterYtdUsed: number (populate it where other YTDs like vabYtdUsed are set) and use ${fields.hours.semesterYtdUsed} in the "(tagna i år: ...)" clause, or remove the entire "(tagna i år: ...)" suffix so the line becomes just the semester days; update any related types (SlipFields.hours) and data population code to match the chosen approach.

============================================================================
File: client/src/pages/Home.tsx
Line: 253 to 258
Type: potential_issue

Comment:
Avoid nesting interactive elements.

An  tag containing a  is invalid HTML and can cause accessibility issues. Use either a styled link or a button with navigation:

-
-  
-    Complete setup →
-  
-
+ navigate("/setup")}
+  className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-1.5"
+>
+  Complete setup →
+


Or use a Link component styled as a button.

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @client/src/pages/Home.tsx around lines 253 - 258, In Home.tsx the JSX nests a  inside an  which is invalid; replace the anchor-button combo with a single interactive element: either use a Link component (import Link from react-router-dom) and apply the existing button classes to the Link, or keep a semantic  and perform navigation via useNavigate (create a handler like handleCompleteSetup that calls navigate('/setup')). Update the element that currently wraps "Complete setup →" accordingly and remove the nested tag so only one interactive element is rendered.

============================================================================
File: server/src/routes/clock.ts
Line: 147 to 165
Type: potential_issue

Comment:
Multiple DB operations without transaction could leave inconsistent state.

Lines 148-165 perform three sequential DB operations:
1. Mark clock-in event as verified
2. Insert clock-out event  
3. Insert entries row

If operation 2 or 3 fails after operation 1 succeeds, the clock-in is marked verified but no clock-out/entry exists. The user would be unable to clock out again (no unverified clock-in) and would have no entry for the shift.

Consider wrapping these operations in a transaction to ensure atomicity.


🛠️ Suggested approach

Use Drizzle's transaction API:

await db.transaction(async (tx) => {
  await tx.update(clockEvents)
    .set({ verified: true })
    .where(eq(clockEvents.id, clockInEvent.id));
  
  const [outEvent] = await tx.insert(clockEvents)
    .values({ / ... / })
    .returning();
  
  const [entry] = await tx.insert(entries)
    .values({ / ... / })
    .returning();
  
  return { outEvent, entry };
});

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @server/src/routes/clock.ts around lines 147 - 165, The three DB operations (update on clockEvents to set verified, insert into clockEvents to create outEvent, and insert into entries) must be executed inside a single transaction to ensure atomicity; change the sequence to use db.transaction(async (tx) => { ... }) and replace db calls with tx (e.g., tx.update(clockEvents).set(...).where(eq(clockEvents.id, clockInEvent.id)), const [outEvent] = await tx.insert(clockEvents).values({...}).returning(), and the tx.insert(entries)...returning() call), then use the returned outEvent/entry from the transaction for subsequent logic and propagate/throw errors from the transaction so failures roll back the verified flag.

============================================================================
File: server/src/routes/__tests__/pdf-lonespec.test.ts
Line: 270 to 280
Type: potential_issue

Comment:
Test will fail if JWT_SECRET env var is not set.

Line 270 uses process.env.JWT_SECRET! with a non-null assertion. If the test environment doesn't have this variable set, tests will fail with cryptic JWT signing errors rather than a clear message.


🛡️ Proposed fix

-const JWT_SECRET = process.env.JWT_SECRET!;
+const JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-for-vitest";


Or add validation at the top of the file:
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set for tests");
}
const JWT_SECRET = process.env.JWT_SECRET;

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @server/src/routes/__tests__/pdf-lonespec.test.ts around lines 270 - 280, The tests currently use a non-null asserted JWT_SECRET (JWT_SECRET) which will cause cryptic failures if process.env.JWT_SECRET is unset; update the top of the test file to validate the env var before use and throw a clear error if missing (e.g., check process.env.JWT_SECRET and assign to JWT_SECRET only after validation), so the helper functions guardianToken, assistantToken, and guardianWithoutAssistantToken receive a guaranteed secret; ensure the validation runs before any calls to those functions.

============================================================================
File: server/src/routes/clock.ts
Line: 52 to 69
Type: potential_issue

Comment:
TOCTOU: Concurrent clock-in requests can create duplicate unverified entries.

The check for an existing unverified clock-in (lines 53–65) and the insert (lines 71–82) execute as separate, non-atomic queries. If two requests arrive simultaneously, both can pass the check and insert duplicate clock-in events. The clockEvents table has no unique constraint to prevent this at the database level.

Add a unique partial index on (assistantId, guardianId, clockType) where verified = false, or wrap the check-and-insert in a transaction with row-level locking to ensure atomicity.

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @server/src/routes/clock.ts around lines 52 - 69, The current non-atomic check in the clock-in flow (query selecting from clockEvents filtering eq(clockEvents.assistantId, assistantId), eq(clockEvents.guardianId, guardianId), eq(clockEvents.clockType, "in"), eq(clockEvents.verified, false)) can race and create duplicate unverified entries; fix this by either adding a database-level safeguard (create a unique partial index on (assistantId, guardianId, clockType) WHERE verified = false on the clockEvents table) or by wrapping the check-and-insert in a transaction with appropriate row-level locking (SELECT ... FOR UPDATE or equivalent) around the same predicates so the existence check and subsequent insert are atomic, and ensure the insert path (where you currently write the new clock-in event) handles unique-constraint/duplicate-key errors gracefully to return the proper 400 response.

============================================================================
File: client/src/pages/Records.tsx
Line: 210 to 218
Type: potential_issue

Comment:
Absence year filter misses absences that span year boundaries.

The current filter a.startDate.startsWith(String(selectedYear)) only includes absences that start in the selected year. An absence from Dec 2025 – Jan 2026 won't appear when viewing 2026. Consider checking for overlap:



🐛 Proposed fix for year overlap

   const { data: allAbsences = [] } = useQuery({
     queryKey: ["absences-year", selectedYear],
     queryFn: () =>
       absenceApi.list().then((r) =>
-        (r.data as Absence[]).filter((a) =>
-          a.startDate.startsWith(String(selectedYear))
-        )
+        (r.data as Absence[]).filter((a) => {
+          const yearStart = ${selectedYear}-01-01;
+          const yearEnd = ${selectedYear}-12-31;
+          // Include if absence overlaps with selected year
+          return a.startDate = yearStart;
+        })
       ),
   });

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @client/src/pages/Records.tsx around lines 210 - 218, The current query transforms absenceApi.list() into allAbsences using a.filter that only checks a.startDate.startsWith(String(selectedYear)), which misses absences spanning year boundaries; update the filter inside the queryFn for useQuery (the mapping around absenceApi.list()) to parse the absence startDate and endDate (e.g., via Date or a date library) and keep absences whose date range overlaps the selectedYear range (from Jan 1 of selectedYear to Dec 31 of selectedYear), i.e., include records where absence.endDate >= startOfYear AND absence.startDate <= endOfYear so multi-year spans (e.g., Dec 2025–Jan 2026) are included.

============================================================================
File: client/src/pages/Monthly.tsx
Line: 594 to 599
Type: potential_issue

Comment:
Potential logic issue: Step 2 state never shows "locked".

Line 598 has state: step2Complete ? "complete" : (step1Complete ? "active" : "active") — the inner ternary always returns "active". This means Payroll (step 2) is never shown as "locked" even when Daily reports (step 1) is incomplete. Should this be step1Complete ? "active" : "locked" to indicate the payroll step is gated on report approval?



🐛 Suggested fix

     {
       number: 2,
       label: "Payroll",
       sublabel: payrollTotalCount > 0 ? ${payrollApprovedCount}/${payrollTotalCount} records approved : undefined,
-      state: step2Complete ? "complete" : (step1Complete ? "active" : "active"),
+      state: step2Complete ? "complete" : (step1Complete ? "active" : "locked"),
     },

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @client/src/pages/Monthly.tsx around lines 594 - 599, In the step definition for the Payroll step (object with number: 2, label: "Payroll") the state expression uses step2Complete ? "complete" : (step1Complete ? "active" : "active") which never yields "locked"; change the fallback logic so that when step2Complete is false the state is "active" only if step1Complete is true, otherwise "locked" (i.e., use step2Complete, step1Complete variables to return "complete", "active", or "locked" appropriately).

============================================================================
File: server/src/routes/assistant.ts
Line: 10
Type: potential_issue

Comment:
assistant.ts routes don't properly support guardian access—use runtime resolution like clock.ts does.

The endpoints in this file assume req.assistantId exists in the JWT token, but guardians receive tokens without an assistantId claim (only assistants and those with explicit user.assistantId do). While requireAssistantAccess allows both roles, endpoints like /entries/:id/accept, /entries/:id/reject, and /entries/:id/submit-report use req.assistantId! directly in queries, which will be undefined for guardian requests.

The comment in auth.ts:40-42 correctly describes the intended pattern: "route handlers use getAssistantId(userId) to resolve the assistant record from the DB." This is properly implemented in clock.ts (lines 15–35), which calls getAssistantId(req.userId!) for both assistants and guardians. assistant.ts should follow the same pattern—either call getAssistantId(req.userId!) at the start of each endpoint, or move this to middleware that populates req.assistantId at runtime.

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @server/src/routes/assistant.ts at line 10, Handlers in assistant.ts assume req.assistantId is present but guardians' JWTs lack that claim; update the endpoints that use req.assistantId (e.g., the /entries/:id/accept, /entries/:id/reject, /entries/:id/submit-report handlers) to resolve the assistant at runtime by calling the existing getAssistantId(req.userId!) (or add middleware that does this) instead of using req.assistantId! directly; keep requireAssistantAccess but ensure you populate req.assistantId from getAssistantId before running DB queries so both assistants and guardians are supported.

============================================================================
File: server/src/routes/assistant.ts
Line: 73 to 86
Type: potential_issue

Comment:
Absence query lacks guardian context and proposed fix is not feasible.

The absence check doesn't filter by guardianId, but the endpoint itself cannot use the proposed fix. The PUT /entries/:id/accept endpoint is assistant-facing (authenticated via req.assistantId), not guardian-facing, so req.userId is not available.

In a multi-guardian scenario where one assistant serves multiple guardians, this creates an authorization gap: an absence created by Guardian A will block shift acceptance even if Guardian B (also managing the assistant) expects the shift to proceed.

To fix this, the endpoint needs to either:
- Look up the guardian(s) associated with the entry via assistantGuardianLinks and check absences for each active guardian, or
- Add requireGuardian middleware and accept guardianId from the request body to scope the absence check

The current query should not be used without this context.

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

In @server/src/routes/assistant.ts around lines 73 - 86, The absence check currently queries absences by assistantId and date (activeAbsence / absences) without scoping to the guardian, which allows an absence from Guardian A to block Guardian B's shift acceptance; fix by first resolving the guardian(s) for the entry (query assistantGuardianLinks or the entry record to get guardianId(s) using the entry id handled by the PUT /entries/:id/accept handler), then re-run the absences query with a guardian scope (use the resolved guardianIds in the WHERE clause, e.g. absences.guardianId IN (guardianIds)); alternatively, if you prefer the middleware approach, add requireGuardian to the endpoint and accept guardianId from req.body (or req.guardianId) and use that to scope the absences query—update the code that builds activeAbsence to reference the guardian-scoped criteria instead of the current global query.

Review completed: 23 findings ✔

---

## Triage Summary (Claude, single-reviewer synthesis)

### HIGH — fix before merge or in immediate follow-up

1. **`server/src/routes/clock.ts:52-69` — TOCTOU on clock-in.** Concurrent clock-in requests can create duplicate unverified entries. Real bug; race-prone. Suggested fix: unique constraint on `(assistantId, date, startTime)` or wrap in a transaction with `SERIALIZABLE` isolation.
2. **`server/src/routes/clock.ts:147-165` — Multi-table DB ops without transaction.** Inconsistent state if one query succeeds and another fails. Wrap in `db.transaction(...)`.
3. **`server/src/routes/assistants.ts:89-145` — Same transaction concern** for multi-table assistants update.
4. **`server/src/routes/auth.ts:229-234` — Missing UNIQUE constraint on `(assistantId, guardianId)` in `assistantGuardianLinks`.** Duplicate links can be inserted. Add a Drizzle unique index migration.
5. **`server/src/routes/gcal.ts:20-38` — JWT in query parameter may be logged.** Move to header or signed short-lived URL pattern. Real security finding for production.
6. **`server/src/routes/entries.ts:45-48` — Internal error message leaked to clients via `e.message`.** Info-disclosure risk (constraint names, table structure, etc.). Log full server-side, return generic to client.

### MEDIUM — track but don't block merge

7. `server/src/middleware/auth.ts:43-46` — Error message text doesn't match the check. Cosmetic but confusing.
8. `server/src/routes/assistant.ts:10` + `:73-86` — Absence query lacks guardian scoping. Per Phase 9 RESEARCH.md Pitfall 6, this is the documented v1 single-tenant assumption; not a regression. Acceptable for v1.0.1.
9. `client/src/pages/Records.tsx:210-218` — Absence year filter misses entries spanning year boundaries (e.g. 2025-12-30 → 2026-01-05).
10. `client/src/pages/Monthly.tsx:594-599` — Step 2 state never shows "locked" — minor UX inconsistency.
11. `server/src/lib/pdfSlipRenderer.ts:153` — `semesterYtdUsed` field referenced but not populated; "tagna i år" displays incorrectly. Either remove the line or compute YTD.
12. `client/src/pages/Home.tsx:253-258` — Nested interactive elements (a11y / event-bubbling concern).
13. `server/src/routes/__tests__/pdf-lonespec.test.ts:270-280` — Test will fail if `JWT_SECRET` env var is not set in CI. Add fallback or mock.
14. `client/e2e/gcal.spec.ts:243-266` — Test assertions may not match actual UI behavior.

### LOW — docs / hygiene

15. `.planning/phases/07-foundation-schema-cleanup/07-03-PLAN.md:134-135` — Duplicate acceptance criterion.
16. `.planning/milestones/v1.0-ROADMAP.md:648-652` — Inconsistent Phase 6 completion status.
17. `.planning/phases/09-salary-slip/09-02-slip-builder-and-renderer-PLAN.md:487-495` — Malformed markdown table row.
18. `.planning/phases/08-employer-representation-helper/08-VERIFICATION.md:40-42` + `:108-113` — Markdown table column-count mismatches (×2).
19. `.planning/todos/pending/2026-04-18-home-notification-...md` — Two clarification asks (error-blocking vs override logic, milestone version numbering).

### EXTERNAL VALIDATION of an already-known gap

20. **`.planning/phases/10-real-data-entry/10-03-SUMMARY.md:64-69` — CodeRabbit independently flagged the `hourlyRateOverride = 0.31` decimal-format issue.** This is the same Settings-input parsing bug we already logged in 10-03-SUMMARY's Gaps section. Cross-AI confirmation that it's worth a separate follow-up.

---

## Recommendations

**For PR #7 merge decision:**
- The 6 HIGH-severity findings are real but most are about hardening existing behaviour (transactions, unique constraints, error sanitization), not regressions introduced by v1.0.1. They've been latent through prior milestones.
- Two paths:
  - **Merge now, file follow-up issues** for HIGH items as separate phases. v1.0.1's actual scope (salary slip, foundation cleanup, employer helper, real-data E2E) is solid and verified.
  - **Hold and fix HIGH-1/2/3/4/5/6 first**, then merge. Adds ~1-2 hours. Cleaner ship.
- The MEDIUM and LOW items can land in a future cleanup phase without blocking ship.

**For follow-up work:**
- Open an `ops/v1.0.2-hardening` milestone covering items 1-6 + the hourlyRate parsing bug.
- Skip items 8 (single-tenant v1 limit, documented), and the doc-only items 15-19 unless they actively confuse readers.
