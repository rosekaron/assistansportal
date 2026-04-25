/**
 * SLIP-01 / SLIP-02 / SLIP-05 — Salary slip endpoint integration tests.
 *
 * The db module is mocked with an in-memory store so these tests exercise
 * handler logic without a live Postgres (precedent: gcal.test.ts :50).
 *
 * Tests cover:
 *   A–K  POST /api/pdf/lonespec  (Task 1)
 *   L–Q  GET  /api/pdf/lonespec/me (Task 2 — added alongside)
 *   R–U  GET  /api/assistant/slips (Task 2 — merged here per plan §c)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// ── In-memory fixture tables ──────────────────────────────────────────────
type Row = Record<string, any>;
type Table = { rows: Row[] };

const state = {
  assistants:     { rows: [] as Row[] },
  profile:        { rows: [] as Row[] },
  payrollRecords: { rows: [] as Row[] },
  absences:       { rows: [] as Row[] },
  paymentSlips:   { rows: [] as Row[] },
};

// Table identity tokens used by the mock — the route code imports
// {assistants, profile, payrollRecords, absences, paymentSlips} from schema,
// and the mocked db matches on object identity.
const T = {
  assistants:     { __name: "assistants" } as Row,
  profile:        { __name: "profile" } as Row,
  payrollRecords: { __name: "payrollRecords" } as Row,
  absences:       { __name: "absences" } as Row,
  paymentSlips:   { __name: "paymentSlips" } as Row,
};

type Cond = { _filter: (row: Row) => boolean };
function makeEq(colName: string, value: any): Cond {
  return { _filter: (r: Row) => r[colName] === value };
}
function makeAnd(...cs: Cond[]): Cond {
  return { _filter: (r: Row) => cs.every((c) => c._filter(r)) };
}
function makeDesc(colName: string) {
  return { __sortCol: colName, __sortDir: "desc" };
}

// ── Mock drizzle-orm (we provide just the operators/functions used) ──────
vi.mock("drizzle-orm", async () => {
  // Preserve real drizzle-orm exports for anything we aren't overriding.
  const actual = await vi.importActual<any>("drizzle-orm");
  return {
    ...actual,
    eq: (col: any, val: any) => {
      // col is a drizzle column object with a .name — we key by name
      const name = col?.name ?? col?._?.name ?? col?.__name;
      return makeEq(name, val);
    },
    and: (...cs: Cond[]) => makeAnd(...cs),
    desc: (col: any) => makeDesc(col?.name ?? col?._?.name),
    or: actual.or,
    isNull: actual.isNull,
    gte: actual.gte,
    lte: actual.lte,
  };
});

// ── Mock schema so imports of {paymentSlips} etc resolve to the tokens ──
// The column accessors (paymentSlips.assistantId, etc.) are resolved via Proxy
// so any code writing `eq(paymentSlips.assistantId, id)` gets a Cond keyed by
// the property name.
function makeTableToken(name: string) {
  return new Proxy(
    { __name: name },
    {
      get(target, prop: string) {
        if (prop in target) return (target as any)[prop];
        // Any column access returns an object with `.name` equal to the prop —
        // eq()/desc() read this to build filters.
        return { name: prop, __table: name };
      },
    }
  );
}

vi.mock("../../db/schema", () => ({
  assistants:     makeTableToken("assistants"),
  profile:        makeTableToken("profile"),
  payrollRecords: makeTableToken("payrollRecords"),
  absences:       makeTableToken("absences"),
  paymentSlips:   makeTableToken("paymentSlips"),
  entries:        makeTableToken("entries"),
}));

// ── Mock db module — implements select/insert with our in-memory store ──
function resolveTable(tbl: any): { rows: Row[] } | null {
  const n = tbl?.__name;
  if (!n) return null;
  return (state as any)[n] ?? null;
}

function selectChain() {
  let sourceRows: Row[] = [];
  let filter: ((r: Row) => boolean) | null = null;
  let sortCol: string | null = null;
  let sortDir: "desc" | "asc" = "asc";
  const chain: any = {
    from(tbl: any) {
      const t = resolveTable(tbl);
      sourceRows = t ? t.rows : [];
      return chain;
    },
    where(cond: Cond) {
      filter = cond._filter;
      return chain;
    },
    orderBy(...orderings: any[]) {
      if (orderings.length > 0 && orderings[0].__sortCol) {
        sortCol = orderings[0].__sortCol;
        sortDir = orderings[0].__sortDir;
      }
      return chain;
    },
    limit(_n: number) {
      return chain;
    },
    then(resolve: any, reject: any) {
      try {
        let out = filter ? sourceRows.filter(filter) : sourceRows.slice();
        if (sortCol) {
          out.sort((a, b) => {
            const av = a[sortCol!]; const bv = b[sortCol!];
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return sortDir === "desc" ? -cmp : cmp;
          });
        }
        resolve(out);
      } catch (e) {
        reject(e);
      }
      return chain;
    },
  };
  return chain;
}

function insertChain(tbl: any) {
  let pendingValues: Row[] = [];
  const t = resolveTable(tbl);
  const chain: any = {
    values(v: Row | Row[]) {
      pendingValues = Array.isArray(v) ? v : [v];
      return chain;
    },
    returning() {
      if (!t) return Promise.resolve([]);
      const inserted: Row[] = [];
      for (const v of pendingValues) {
        const row: Row = { issuedAt: new Date(), createdAt: new Date(), ...v };
        // Enforce unique index (assistantId, reportMonth, sequence) on paymentSlips
        if (tbl.__name === "paymentSlips") {
          const collision = t.rows.find(r =>
            r.assistantId === row.assistantId &&
            r.reportMonth === row.reportMonth &&
            r.sequence === row.sequence);
          if (collision) {
            const err: any = new Error("duplicate key value violates unique constraint");
            err.code = "23505";
            throw err;
          }
        }
        t.rows.push(row);
        inserted.push(row);
      }
      return Promise.resolve(inserted);
    },
  };
  return chain;
}

vi.mock("../../db", () => ({
  db: {
    select: () => selectChain(),
    insert: (tbl: any) => insertChain(tbl),
  },
}));

// ── Lazy router imports so the mocks above are applied first ──────────────
let pdfRouter: any;
let assistantRouter: any;

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset fixture tables
  state.assistants.rows     = [];
  state.profile.rows        = [];
  state.payrollRecords.rows = [];
  state.absences.rows       = [];
  state.paymentSlips.rows   = [];

  // Seed profile
  state.profile.rows.push({
    id: 1,
    patientName: "Test Patient",
    patientPno:  "20150101-0000",
    guardianName: "Test Guardian",
    guardianPno:  "19800101-0000",
    patientRequiresRepresentative: false,
    address: "",
    addressStreet: "Street 1",
    addressZip: "11122",
    addressCity: "Stockholm",
    defaultPayDay: 25,
    weeklyHours: 129,
  });

  // Seed assistants: a_rose (approved, rate set), a_mikael (approved, no rate)
  state.assistants.rows.push({
    id: "a_rose",
    name: "Rose Karon",
    pno: "19801115-5069",
    hourlyRateOverride: 254.10,
    paymentMethod: "bankgiro",
    salaryModel: "anhörig",
    bankClearing: "",
    bankAccount: "",
    iban: "",
  });
  state.assistants.rows.push({
    id: "a_mikael",
    name: "Mikael Karon",
    pno: "19800715-1234",
    hourlyRateOverride: null,
    paymentMethod: "bankgiro",
    salaryModel: "anhörig",
    bankClearing: "",
    bankAccount: "",
    iban: "",
  });

  // Seed an approved payroll record for a_rose, 2026-03
  state.payrollRecords.rows.push({
    id: "pr_rose_202603",
    assistantId: "a_rose",
    month: "2026-03",
    billableHours: 215,
    grossPay: 54631.5,
    prelimTaxRateSnapshot: 0.30,
    hourlyRateUsed: 254.10,
    salaryModelUsed: "anhörig",
    status: "approved",
    hourlyRateSnapshot: 254.10,
    taxRateSnapshot: 0.3142,
    employerContributions: 0,
    totalEmployerCost: 0,
  });

  // Fresh router imports for each test (state mutations persist across,
  // but handlers use db module dynamically, so routers can be reused).
  if (!pdfRouter) {
    pdfRouter       = (await import("../pdf")).default;
    assistantRouter = (await import("../assistant")).default;
  }
});

const JWT_SECRET = process.env.JWT_SECRET!;
function guardianToken() {
  return jwt.sign({ userId: 1, role: "guardian" }, JWT_SECRET, { expiresIn: "1h" });
}
function assistantToken(assistantId: string) {
  return jwt.sign({ userId: 2, role: "assistant", assistantId }, JWT_SECRET, { expiresIn: "1h" });
}
function guardianWithoutAssistantToken() {
  return jwt.sign({ userId: 1, role: "guardian" }, JWT_SECRET, { expiresIn: "1h" });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/pdf", pdfRouter);
  app.use("/api/assistant", assistantRouter);
  return app;
}

// ── Task 1 tests — POST /api/pdf/lonespec ─────────────────────────────────

describe("SLIP-01 POST /api/pdf/lonespec", () => {
  it("A: happy path — returns 200 + application/pdf for approved payroll + rate set", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "a_rose" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    // supertest binary body is a Buffer
    const body = res.body instanceof Buffer ? res.body : Buffer.from(res.body);
    expect(body.slice(0, 5).toString()).toBe("%PDF-");
    expect(res.headers["content-disposition"]).toContain(`filename="lonespec-2026-03-Rose-Karon.pdf"`);
  });

  it("B: 409 when payroll status !== approved", async () => {
    state.payrollRecords.rows[0].status = "draft";
    const app = buildApp();
    const res = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "a_rose" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Lönekörningen är inte godkänd för denna månad/);
  });

  it("C: 400 when hourlyRateOverride is NULL", async () => {
    const app = buildApp();
    // ensure payroll approved for mikael so gate is rate, not approval
    state.payrollRecords.rows.push({
      id: "pr_mikael_202603",
      assistantId: "a_mikael",
      month: "2026-03",
      billableHours: 200,
      grossPay: 50000,
      prelimTaxRateSnapshot: 0.30,
      hourlyRateUsed: 0,
      salaryModelUsed: "anhörig",
      status: "approved",
      hourlyRateSnapshot: 0,
      taxRateSnapshot: 0.3142,
      employerContributions: 0,
      totalEmployerCost: 0,
    });
    const res = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "a_mikael" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Timlön saknas för Mikael Karon/);
    expect(res.body.error).toMatch(/Inställningar → Assistenter/);
  });

  it("D: 400 when assistantId contains path traversal characters", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "../etc" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid assistantId/);
  });

  it("E: SLIP-05 first issue — inserts one paymentSlips row with LS-2026-03-001 + payDate + payMethod", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "a_rose" });
    expect(res.status).toBe(200);
    expect(state.paymentSlips.rows).toHaveLength(1);
    const row = state.paymentSlips.rows[0];
    expect(row.documentNumber).toBe("LS-2026-03-001");
    expect(row.sequence).toBe(1);
    expect(row.payDate).toBe("2026-04-25");
    expect(row.payMethod).toBe("bankgiro");
    expect(row.assistantId).toBe("a_rose");
    expect(row.reportMonth).toBe("2026-03");
  });

  it("F: SLIP-05 replay reuses existing row — second POST does NOT insert new row", async () => {
    const app = buildApp();
    const r1 = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "a_rose" });
    expect(r1.status).toBe(200);
    const firstRow = { ...state.paymentSlips.rows[0] };
    const r2 = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "a_rose" });
    expect(r2.status).toBe(200);
    expect(state.paymentSlips.rows).toHaveLength(1);
    expect(state.paymentSlips.rows[0].id).toBe(firstRow.id);
    expect(state.paymentSlips.rows[0].documentNumber).toBe(firstRow.documentNumber);
    expect(state.paymentSlips.rows[0].issuedAt).toBe(firstRow.issuedAt);
  });

  it("G: different month → new row, each LS-{month}-001", async () => {
    const app = buildApp();
    // approve april too
    state.payrollRecords.rows.push({
      id: "pr_rose_202604",
      assistantId: "a_rose",
      month: "2026-04",
      billableHours: 210,
      grossPay: 53361,
      prelimTaxRateSnapshot: 0.30,
      hourlyRateUsed: 254.10,
      salaryModelUsed: "anhörig",
      status: "approved",
      hourlyRateSnapshot: 254.10,
      taxRateSnapshot: 0.3142,
      employerContributions: 0,
      totalEmployerCost: 0,
    });
    const r1 = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "a_rose" });
    const r2 = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "04", assistantId: "a_rose" });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(state.paymentSlips.rows).toHaveLength(2);
    const docs = state.paymentSlips.rows.map(r => r.documentNumber).sort();
    expect(docs).toEqual(["LS-2026-03-001", "LS-2026-04-001"]);
  });

  it("H: different assistant same month — both LS-2026-03-001, different assistantId", async () => {
    const app = buildApp();
    // give mikael a rate + approved payroll for 2026-03
    state.assistants.rows[1].hourlyRateOverride = 254.10;
    state.payrollRecords.rows.push({
      id: "pr_mikael_202603",
      assistantId: "a_mikael",
      month: "2026-03",
      billableHours: 200,
      grossPay: 50000,
      prelimTaxRateSnapshot: 0.30,
      hourlyRateUsed: 254.10,
      salaryModelUsed: "anhörig",
      status: "approved",
      hourlyRateSnapshot: 254.10,
      taxRateSnapshot: 0.3142,
      employerContributions: 0,
      totalEmployerCost: 0,
    });
    const r1 = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "a_rose" });
    const r2 = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "a_mikael" });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(state.paymentSlips.rows).toHaveLength(2);
    const byAsst = Object.fromEntries(state.paymentSlips.rows.map(r => [r.assistantId, r.documentNumber]));
    expect(byAsst["a_rose"]).toBe("LS-2026-03-001");
    expect(byAsst["a_mikael"]).toBe("LS-2026-03-001");
  });

  it("I: unique index rejects duplicate direct insert with SQLSTATE 23505", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "a_rose" });
    // Attempt a direct insert of a duplicate (assistantId, reportMonth, sequence)
    const { db } = await import("../../db");
    const { paymentSlips } = await import("../../db/schema");
    let threw: any = null;
    try {
      await (db as any).insert(paymentSlips).values({
        id: "slip_dup",
        payrollRecordId: "pr_rose_202603",
        assistantId: "a_rose",
        reportMonth: "2026-03",
        documentNumber: "LS-2026-03-001",
        sequence: 1,
        payDate: "2026-04-25",
        payMethod: "bankgiro",
      }).returning();
    } catch (e: any) {
      threw = e;
    }
    expect(threw).not.toBeNull();
    expect(threw.code).toBe("23505");
    expect(state.paymentSlips.rows).toHaveLength(1);
  });

  it("J: missing Authorization → 401", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/pdf/lonespec")
      .send({ year: "2026", month: "03", assistantId: "a_rose" });
    expect(res.status).toBe(401);
  });

  it("K: assistant role → 403", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${assistantToken("a_rose")}`)
      .send({ year: "2026", month: "03", assistantId: "a_rose" });
    expect(res.status).toBe(403);
  });
});

// ── Task 2 tests — GET /api/pdf/lonespec/me ───────────────────────────────

describe("SLIP-02 GET /api/pdf/lonespec/me", () => {
  it("L: happy path — assistant gets own slip, documentNumber matches first-issue row", async () => {
    const app = buildApp();
    // first issue via guardian to seed the row
    const seed = await request(app)
      .post("/api/pdf/lonespec")
      .set("Authorization", `Bearer ${guardianToken()}`)
      .send({ year: "2026", month: "03", assistantId: "a_rose" });
    expect(seed.status).toBe(200);
    const row = state.paymentSlips.rows[0];
    const res = await request(app)
      .get("/api/pdf/lonespec/me?month=2026-03")
      .set("Authorization", `Bearer ${assistantToken("a_rose")}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    // Row wasn't duplicated
    expect(state.paymentSlips.rows).toHaveLength(1);
    expect(state.paymentSlips.rows[0].documentNumber).toBe(row.documentNumber);
  });

  it("M: /me reads JWT not query — assistantId query param is IGNORED (filename contains Rose, not Mikael)", async () => {
    const app = buildApp();
    // Seed both assistants with approved payroll
    state.assistants.rows[1].hourlyRateOverride = 254.10;
    state.payrollRecords.rows.push({
      id: "pr_mikael_202603",
      assistantId: "a_mikael",
      month: "2026-03",
      billableHours: 200,
      grossPay: 50000,
      prelimTaxRateSnapshot: 0.30,
      hourlyRateUsed: 254.10,
      salaryModelUsed: "anhörig",
      status: "approved",
      hourlyRateSnapshot: 254.10,
      taxRateSnapshot: 0.3142,
      employerContributions: 0,
      totalEmployerCost: 0,
    });
    const res = await request(app)
      .get("/api/pdf/lonespec/me?month=2026-03&assistantId=a_mikael")
      .set("Authorization", `Bearer ${assistantToken("a_rose")}`);
    expect(res.status).toBe(200);
    // Content-Disposition must contain "Rose" not "Mikael" — proves JWT wins
    expect(res.headers["content-disposition"]).toContain("Rose");
    expect(res.headers["content-disposition"]).not.toContain("Mikael");
  });

  it("N: /me returns 400 when req.assistantId is undefined (guardian with no linked assistant)", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/pdf/lonespec/me?month=2026-03")
      .set("Authorization", `Bearer ${guardianWithoutAssistantToken()}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No assistant linked to this account/);
  });

  it("O: /me returns 409 when payroll not approved", async () => {
    state.payrollRecords.rows[0].status = "draft";
    const app = buildApp();
    const res = await request(app)
      .get("/api/pdf/lonespec/me?month=2026-03")
      .set("Authorization", `Bearer ${assistantToken("a_rose")}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Lönekörningen är inte godkänd/);
  });

  it("P: /me returns 400 when hourlyRateOverride is NULL", async () => {
    state.assistants.rows[0].hourlyRateOverride = null;
    const app = buildApp();
    const res = await request(app)
      .get("/api/pdf/lonespec/me?month=2026-03")
      .set("Authorization", `Bearer ${assistantToken("a_rose")}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Timlön saknas/);
  });

  it("Q: /me returns 400 when month param is missing/malformed", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/pdf/lonespec/me")
      .set("Authorization", `Bearer ${assistantToken("a_rose")}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid month/);
  });
});

// ── Task 2 tests — GET /api/assistant/slips ───────────────────────────────

describe("SLIP-02 GET /api/assistant/slips", () => {
  function seedSlips() {
    // 3 rows for a_rose, 1 row for a_mikael, deliberately out-of-order on
    // reportMonth and issuedAt so the test actually verifies sorting.
    state.paymentSlips.rows.push({
      id: "s1", payrollRecordId: "pr_rose_202602", assistantId: "a_rose",
      reportMonth: "2026-02", documentNumber: "LS-2026-02-001", sequence: 1,
      issuedAt: new Date("2026-03-01T09:00:00Z"),
      payDate: "2026-03-25", payMethod: "bankgiro", createdAt: new Date(),
    });
    state.paymentSlips.rows.push({
      id: "s2", payrollRecordId: "pr_rose_202603", assistantId: "a_rose",
      reportMonth: "2026-03", documentNumber: "LS-2026-03-001", sequence: 1,
      issuedAt: new Date("2026-04-01T09:00:00Z"),
      payDate: "2026-04-25", payMethod: "bankgiro", createdAt: new Date(),
    });
    state.paymentSlips.rows.push({
      id: "s3", payrollRecordId: "pr_rose_202601", assistantId: "a_rose",
      reportMonth: "2026-01", documentNumber: "LS-2026-01-001", sequence: 1,
      issuedAt: new Date("2026-02-01T09:00:00Z"),
      payDate: "2026-02-25", payMethod: "bankgiro", createdAt: new Date(),
    });
    state.paymentSlips.rows.push({
      id: "s4", payrollRecordId: "pr_mikael_202603", assistantId: "a_mikael",
      reportMonth: "2026-03", documentNumber: "LS-2026-03-001", sequence: 1,
      issuedAt: new Date("2026-04-01T09:00:00Z"),
      payDate: "2026-04-25", payMethod: "bankgiro", createdAt: new Date(),
    });
  }

  it("R: happy path — lists only JWT-bound assistant's slips, sorted reportMonth DESC", async () => {
    seedSlips();
    const app = buildApp();
    const res = await request(app)
      .get("/api/assistant/slips")
      .set("Authorization", `Bearer ${assistantToken("a_rose")}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    // Mikael's seeded row (s4) must not appear in Rose's listing.
    const ids = res.body.map((r: any) => r.id);
    expect(ids).not.toContain("s4");
    // Sort order: reportMonth DESC then issuedAt DESC (both Rose-owned months).
    expect(res.body.map((r: any) => r.reportMonth)).toEqual(["2026-03", "2026-02", "2026-01"]);
  });

  it("S: IDOR attempt via query param is ignored — Rose's JWT only sees Rose's rows", async () => {
    seedSlips();
    const app = buildApp();
    const res = await request(app)
      .get("/api/assistant/slips?assistantId=a_mikael")
      .set("Authorization", `Bearer ${assistantToken("a_rose")}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    // All returned rows must correspond to slips seeded for Rose (ids s1,s2,s3)
    const ids = res.body.map((r: any) => r.id).sort();
    expect(ids).toEqual(["s1", "s2", "s3"]);
  });

  it("T: 400 when req.assistantId is undefined", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/assistant/slips")
      .set("Authorization", `Bearer ${guardianWithoutAssistantToken()}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No assistant linked to this account/);
  });

  it("U: 401 without Authorization header", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/assistant/slips");
    expect(res.status).toBe(401);
  });
});
