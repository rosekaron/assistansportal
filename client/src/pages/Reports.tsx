import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entriesApi, assistantsApi, profileApi, pdfApi, costsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/inputs";
import { PageHeader, AssistantAvatar, ActivityPill, EmptyState } from "@/components/shared";
import { activityById } from "@/lib/activities";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FileDown, ChevronLeft, ChevronRight, CheckCircle2, Clock, FileText, AlertCircle, Plus, Trash2 } from "lucide-react";

// FK schablonbelopp 2026 — update annually or make configurable in Settings
const FK_HOURLY_RATE = 334; // SEK per approved assistance hour

type Cost = {
  id: string;
  month: string;
  category: string;
  assistantId: string | null;
  amountSek: number;
  description: string;
};

const COST_LABELS: Record<string, string> = {
  wages:        "Wages (lön)",
  employer_tax: "Employer tax",
  sick_leave:   "Sick leave (sjuklön)",
  training:     "Training",
  adaptation:   "Workplace adaptation",
  other:        "Other",
};

const COST_COLORS: Record<string, string> = {
  wages:        "bg-blue-50 text-blue-700 border-blue-200",
  employer_tax: "bg-purple-50 text-purple-700 border-purple-200",
  sick_leave:   "bg-rose-50 text-rose-700 border-rose-200",
  training:     "bg-amber-50 text-amber-700 border-amber-200",
  adaptation:   "bg-teal-50 text-teal-700 border-teal-200",
  other:        "bg-slate-50 text-slate-600 border-slate-200",
};

const EMPLOYER_TAX_RATE = 0.3142; // arbetsgivaravgifter rate

type Entry     = Record<string, string | number | null | undefined>;
type Assistant = Record<string, string | number | null | undefined>;

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function pad(n: number) { return String(n).padStart(2,"0"); }

export default function ReportsPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedAssistant, setSelectedAssistant] = useState<string>("all");

  const { data: profile }        = useQuery({ queryKey: ["profile"],    queryFn: () => profileApi.get().then(r => r.data) });
  const { data: assistants = [] } = useQuery({ queryKey: ["assistants"], queryFn: () => assistantsApi.list().then(r => r.data) });
  const { data: allEntries = [] } = useQuery({ queryKey: ["entries"],    queryFn: () => entriesApi.list().then(r => r.data) });
  const { data: entries    = [] } = useQuery({
    queryKey: ["entries", year, month],
    queryFn:  () => entriesApi.list({
      start: `${year}-${pad(month + 1)}-01`,
      end:   `${year}-${pad(month + 1)}-${new Date(year, month + 1, 0).getDate()}`,
    }).then(r => r.data),
  });

  const monthKey = `${year}-${pad(month + 1)}`;

  // ── Costs ─────────────────────────────────────────────────────
  const [showAddCost, setShowAddCost] = useState(false);
  const [costForm, setCostForm] = useState({
    category: "wages", assistantId: "", amountSek: "", description: "",
  });

  const { data: monthCosts = [] } = useQuery({
    queryKey: ["costs", monthKey],
    queryFn:  () => costsApi.list(monthKey).then(r => r.data as Cost[]),
  });

  const addCost = useMutation({
    mutationFn: () => costsApi.create({
      month:       monthKey,
      category:    costForm.category,
      assistantId: costForm.assistantId || null,
      amountSek:   Number(costForm.amountSek),
      description: costForm.description,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costs", monthKey] });
      setCostForm({ category: "wages", assistantId: "", amountSek: "", description: "" });
      setShowAddCost(false);
    },
  });

  const deleteCost = useMutation({
    mutationFn: (id: string) => costsApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["costs", monthKey] }),
  });

  const approveEntry = useMutation({
    mutationFn: ({ id }: { id: string }) => entriesApi.update(id, { repStatus: "approved" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", year, month] }),
  });

  const rejectEntry = useMutation({
    mutationFn: ({ id }: { id: string }) => entriesApi.update(id, { repStatus: "rejected" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", year, month] }),
  });

  const setEntryType = useMutation({
    mutationFn: ({ id, entryType }: { id: string; entryType: string }) => entriesApi.update(id, { entryType }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", year, month] }),
  });

  const approveAll = useMutation({
    mutationFn: async (assistantId: string) => {
      const toApprove = (entries as Entry[]).filter(e =>
        (e.assistantId ?? e.assistant_id) === assistantId &&
        (e.reqStatus ?? e.req_status) === "approved" &&
        (e.repStatus ?? e.rep_status) === "pending"
      );
      for (const e of toApprove) {
        await entriesApi.update(e.id as string, { repStatus: "approved" });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", year, month] }),
  });

  const fkDownload = useMutation({
    mutationFn: () => pdfApi.fk3057(String(year), pad(month + 1)),
    onSuccess: (res) => {
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `FK3057-${year}-${pad(month + 1)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  // Navigate months
  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Per-assistant summary
  const summaries = useMemo(() => {
    return (assistants as Assistant[]).map(a => {
      const aid = a.id as string;
      const myEntries = (entries as Entry[]).filter(e =>
        (e.assistantId ?? e.assistant_id) === aid
      );
      const scheduled  = myEntries.filter(e => (e.reqStatus ?? e.req_status) !== "rejected");
      const approved   = myEntries.filter(e => (e.reqStatus ?? e.req_status) === "approved");
      const repPending = myEntries.filter(e =>
        (e.reqStatus ?? e.req_status) === "approved" &&
        (e.repStatus ?? e.rep_status) === "pending"
      );
      const repApproved = myEntries.filter(e => (e.repStatus ?? e.rep_status) === "approved");

      const totalHours    = scheduled.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
      const approvedHours = approved.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
      const reportedHours = repApproved.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);

      return { assistant: a, myEntries, approved, repPending, repApproved, totalHours, approvedHours, reportedHours };
    }).filter(s => s.myEntries.length > 0);
  }, [assistants, entries]);

  const filteredEntries = useMemo(() => {
    return (entries as Entry[])
      .filter(e => selectedAssistant === "all" || (e.assistantId ?? e.assistant_id) === selectedAssistant)
      .filter(e => (e.reqStatus ?? e.req_status) === "approved")
      .sort((a, b) => (a.date as string).localeCompare(b.date as string));
  }, [entries, selectedAssistant]);

  const totalApprovedHours  = filteredEntries.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
  // FK 3057 can only be generated when all reports for the month are approved
  // (hours on 3057 must match sum of all 3059s — FK will reject mismatches)
  const monthPendingCount = (entries as Entry[]).filter(e =>
    (e.reqStatus ?? e.req_status) === "approved" &&
    (e.repStatus ?? e.rep_status) === "pending"
  ).length;

  // ── Cost calculations ──────────────────────────────────────────
  const totalCosts       = (monthCosts as Cost[]).reduce((s, c) => s + c.amountSek, 0);
  const costsByCategory  = Object.keys(COST_LABELS).map(cat => ({
    category: cat,
    total: (monthCosts as Cost[]).filter(c => c.category === cat).reduce((s, c) => s + c.amountSek, 0),
  })).filter(x => x.total > 0);
  // FK reimbursement = approved hours × schablonbelopp
  const approvedHoursThisMonth = (entries as Entry[])
    .filter(e => (e.reqStatus ?? e.req_status) === "approved")
    .reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
  const fkReimbursement  = approvedHoursThisMonth * FK_HOURLY_RATE;
  const costBalance      = fkReimbursement - totalCosts;
  // Employer tax hint when wages are being entered
  const wageHint = costForm.category === "wages" && Number(costForm.amountSek) > 0
    ? Math.round(Number(costForm.amountSek) * EMPLOYER_TAX_RATE)
    : 0;

  const statusColor = (s: string) => ({
    approved: "text-emerald-600 bg-emerald-50 border-emerald-200",
    pending:  "text-amber-600 bg-amber-50 border-amber-200",
    draft:    "text-slate-500 bg-slate-50 border-slate-200",
    rejected: "text-red-600 bg-red-50 border-red-200",
  }[s] ?? "text-slate-500 bg-slate-50 border-slate-200");

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Review and approve time reports, then generate FK forms"
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[140px] text-center">
              {MONTHS[month]} {year}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <input
              type="month"
              value={`${year}-${pad(month + 1)}`}
              onChange={e => {
                if (!e.target.value) return;
                const [y, m] = e.target.value.split("-").map(Number);
                setYear(y);
                setMonth(m - 1);
              }}
              className="text-xs border border-border rounded-lg px-2 py-1 bg-white text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        }
      />

      {/* ── Cross-month pending alert ── */}
      {(() => {
        const allPending = (allEntries as Entry[]).filter(e =>
          (e.reqStatus ?? e.req_status) === "approved" &&
          (e.repStatus ?? e.rep_status) === "pending"
        );
        const otherMonthPending = allPending.filter(e => {
          const d = (e.date as string ?? "").slice(0, 7);
          return d !== `${year}-${pad(month + 1)}`;
        });
        if (otherMonthPending.length === 0) return null;
        const months = [...new Set(otherMonthPending.map(e => (e.date as string).slice(0, 7)))].sort();
        return (
          <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <Clock className="w-4 h-4 shrink-0 text-amber-500" />
            <span>
              <strong>{otherMonthPending.length} report{otherMonthPending.length > 1 ? "s" : ""} pending</strong> in other months —{" "}
              {months.map(m => {
                const [y, mo] = m.split("-").map(Number);
                return (
                  <button key={m} onClick={() => { setYear(y); setMonth(mo - 1); }}
                    className="underline underline-offset-2 hover:text-amber-900 mr-1">
                    {MONTHS[mo - 1]} {y}
                  </button>
                );
              })}
            </span>
          </div>
        );
      })()}

      {/* ── Per-assistant summary cards ── */}
      {summaries.length === 0 ? (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          No shifts found for {MONTHS[month]} {year}. Navigate to a month with data using the arrows above.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {summaries.map(({ assistant, approved, repPending, repApproved, approvedHours, reportedHours }) => {
            const allReported = repPending.length === 0 && repApproved.length > 0;
            const needsAction = repPending.length > 0;
            return (
              <Card
                key={assistant.id as string}
                className={cn(
                  "cursor-pointer transition-all border-2",
                  selectedAssistant === assistant.id ? "border-primary shadow-md" : "border-border hover:border-primary/40",
                  needsAction ? "bg-amber-50/30" : ""
                )}
                onClick={() => setSelectedAssistant(s => s === assistant.id ? "all" : assistant.id as string)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <AssistantAvatar
                        name={assistant.name as string}
                        initials={assistant.initials as string}
                        color={assistant.color as string}
                        size={36}
                      />
                      <div>
                        <p className="font-semibold text-sm">{assistant.name as string}</p>
                        <p className="text-xs text-muted-foreground">{approved.length} approved shifts</p>
                      </div>
                    </div>
                    {allReported
                      ? <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" />Ready</span>
                      : needsAction
                      ? <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"><Clock className="w-3 h-3" />{repPending.length} to review</span>
                      : <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5"><AlertCircle className="w-3 h-3" />No reports</span>
                    }
                  </div>

                  {/* Hours bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{reportedHours}h approved</span>
                      <span className="font-mono font-semibold text-foreground">{approvedHours}h total</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: approvedHours > 0 ? `${Math.min(100, (reportedHours / approvedHours) * 100)}%` : "0%" }}
                      />
                    </div>
                  </div>

                  {needsAction && (
                    <Button
                      size="sm" variant="outline"
                      className="mt-3 w-full text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                      disabled={approveAll.isPending}
                      onClick={e => { e.stopPropagation(); approveAll.mutate(assistant.id as string); }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve all {repPending.length} pending reports
                    </Button>
                  )}
                  <Button
                    size="sm" variant="outline"
                    className="mt-2 w-full text-xs gap-1.5"
                    onClick={async e => {
                      e.stopPropagation();
                      try {
                        const res = await pdfApi.fk3059(String(year), pad(month + 1), assistant.id as string);
                        const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `FK3059-${year}-${pad(month+1)}-${(assistant.name as string).replace(/\s+/g,"-")}.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err: unknown) {
                        const axErr = err as { response?: { data?: { error?: string } | ArrayBuffer } };
                        let msg = "Unknown error";
                        if (axErr?.response?.data instanceof ArrayBuffer) {
                          msg = new TextDecoder().decode(axErr.response.data);
                          try { msg = JSON.parse(msg).error ?? msg; } catch {}
                        } else {
                          msg = (axErr?.response?.data as { error?: string })?.error ?? String(err);
                        }
                        alert(`FK 3059 error: ${msg}`);
                      }
                    }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Download FK 3059
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Monthly costs ─────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Monthly costs — {MONTHS[month]} {year}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Wages, employer taxes, sick leave, training, and workplace adaptations
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAddCost(v => !v)}>
            <Plus className="w-3.5 h-3.5" />
            Add cost
          </Button>
        </div>

        {/* Add cost form */}
        {showAddCost && (
          <Card className="mb-4 border-primary/30">
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                  <select
                    value={costForm.category}
                    onChange={e => setCostForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-primary"
                  >
                    {Object.entries(COST_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Assistant (optional)</label>
                  <select
                    value={costForm.assistantId}
                    onChange={e => setCostForm(f => ({ ...f, assistantId: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-primary"
                  >
                    <option value="">— All / General —</option>
                    {(assistants as Assistant[]).map(a => (
                      <option key={a.id as string} value={a.id as string}>{a.name as string}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Amount (SEK)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={costForm.amountSek}
                    onChange={e => setCostForm(f => ({ ...f, amountSek: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. March salary"
                    value={costForm.description}
                    onChange={e => setCostForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              {/* Employer tax hint */}
              {wageHint > 0 && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                  <span className="text-xs text-purple-700">
                    <strong>Tip:</strong> don't forget arbetsgivaravgifter — approx.{" "}
                    <strong>{wageHint.toLocaleString("sv-SE")} kr</strong>{" "}
                    ({(EMPLOYER_TAX_RATE * 100).toFixed(1)}% of wages). Add it as a separate "Employer tax" entry.
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => addCost.mutate()}
                  disabled={addCost.isPending || !costForm.amountSek || Number(costForm.amountSek) <= 0}
                >
                  {addCost.isPending ? "Adding…" : "Add cost"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddCost(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(monthCosts as Cost[]).length === 0 ? (
          <div className="py-5 text-center bg-secondary/20 rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No costs logged for {MONTHS[month]} {year}</p>
            <p className="text-xs text-muted-foreground mt-1">Track wages, taxes, and other employer costs here</p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["Category","Assistant","Description","Amount (SEK)",""].map(h => (
                      <th key={h} className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(monthCosts as Cost[]).map(c => {
                    const assistant = (assistants as Assistant[]).find(a => a.id === c.assistantId);
                    return (
                      <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/10">
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", COST_COLORS[c.category])}>
                            {COST_LABELS[c.category] ?? c.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {assistant ? (assistant.name as string).split(" ")[0] : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{c.description || "—"}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-sm">
                          {c.amountSek.toLocaleString("sv-SE")} kr
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteCost.mutate(c.id)}
                            className="text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/30">
                    <td colSpan={3} className="px-4 py-3 text-sm font-semibold">Total costs</td>
                    <td className="px-4 py-3 font-mono font-bold text-base">
                      {totalCosts.toLocaleString("sv-SE")} kr
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        )}

        {/* FK reimbursement comparison */}
        {(approvedHoursThisMonth > 0 || totalCosts > 0) && (
          <div className="mt-4 rounded-xl border border-border bg-secondary/20 divide-y divide-border">
            <div className="flex justify-between items-center px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">FK reimbursement</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {approvedHoursThisMonth}h approved × {FK_HOURLY_RATE} kr schablonbelopp
                </p>
              </div>
              <span className="font-mono font-semibold text-sm whitespace-nowrap">
                {fkReimbursement.toLocaleString("sv-SE")} kr
              </span>
            </div>
            <div className="flex justify-between items-center px-4 py-3">
              <p className="text-sm font-medium text-foreground">Logged costs</p>
              <span className="font-mono font-semibold text-sm whitespace-nowrap">
                {totalCosts.toLocaleString("sv-SE")} kr
              </span>
            </div>
            <div className={cn(
              "flex justify-between items-center px-4 py-3 rounded-b-xl",
              costBalance >= 0 ? "bg-emerald-50" : "bg-red-50"
            )}>
              <div>
                <p className={cn("text-sm font-semibold", costBalance >= 0 ? "text-emerald-800" : "text-red-800")}>
                  {costBalance >= 0 ? "Surplus" : "Deficit"}
                </p>
                {costBalance < 0 && (
                  <p className="text-xs text-red-600 mt-0.5">
                    Costs exceed FK reimbursement — review wage levels or check your decision hours
                  </p>
                )}
                {costBalance >= 0 && totalCosts > 0 && (
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Within FK grant — surplus may cover future months or be returned to FK
                  </p>
                )}
              </div>
              <span className={cn(
                "font-mono font-bold text-base whitespace-nowrap",
                costBalance >= 0 ? "text-emerald-700" : "text-red-700"
              )}>
                {costBalance >= 0 ? "+" : ""}{costBalance.toLocaleString("sv-SE")} kr
              </span>
            </div>
          </div>
        )}

        {/* Category breakdown (when multiple categories logged) */}
        {costsByCategory.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {costsByCategory.map(({ category, total }) => (
              <div key={category} className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                COST_COLORS[category]
              )}>
                <span className="font-medium">{COST_LABELS[category]}</span>
                <span className="font-mono">{total.toLocaleString("sv-SE")} kr</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Detailed shift list ── */}
      {filteredEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {selectedAssistant === "all" ? "All approved shifts" : (assistants as Assistant[]).find(a => a.id === selectedAssistant)?.name + "'s shifts"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredEntries.length} shifts · {totalApprovedHours}h total — {MONTHS[month]} {year}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={() => fkDownload.mutate()}
                disabled={fkDownload.isPending || monthPendingCount > 0}
                className="gap-2"
              >
                <FileDown className="w-4 h-4" />
                {fkDownload.isPending ? "Generating…" : `Download FK 3057 — ${MONTHS[month]} ${year}`}
              </Button>
              {monthPendingCount > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {monthPendingCount} report{monthPendingCount > 1 ? "s" : ""} still pending — approve all before downloading
                </p>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["Assistant","Date","Time","Activity","Type","Hours","Report status","Action"].map(h => (
                      <th key={h} className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map(e => {
                    const a       = (assistants as Assistant[]).find(x => x.id === (e.assistantId ?? e.assistant_id));
                    const repSt   = (e.repStatus ?? e.rep_status) as string;
                    const entType = (e.entryType ?? e.entry_type) as string;
                    const isPending  = repSt === "pending";
                    const isApproved = repSt === "approved";
                    const isDraft    = repSt === "draft";
                    const isSick     = entType === "sick";

                    return (
                      <tr key={e.id as string} className={cn(
                        "border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors",
                        isPending ? "bg-amber-50/40" : "",
                        isSick    ? "bg-rose-50/30" : ""
                      )}>
                        <td className="px-4 py-3">
                          {a && (
                            <div className="flex items-center gap-2">
                              <AssistantAvatar name={a.name as string} initials={a.initials as string} color={a.color as string} size={26} />
                              <span className="text-sm font-medium">{a.name as string}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{formatDate(e.date as string)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {(e.startTime ?? e.start_time) as string} – {(e.endTime ?? e.end_time) as string}
                        </td>
                        <td className="px-4 py-3">
                          <ActivityPill activityId={(e.activityId ?? e.activity_id) as string} />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={(e.entryType ?? e.entry_type ?? "active") as string}
                            onChange={(ev) => setEntryType.mutate({ id: e.id as string, entryType: ev.target.value })}
                            className="text-xs bg-secondary border border-border rounded px-1.5 py-1 text-foreground cursor-pointer"
                          >
                            <option value="active">Active</option>
                            <option value="waiting">Waiting</option>
                            <option value="standby">Standby</option>
                            <option value="sick">Sick (sjuklön)</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm font-semibold">{e.hours}h</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", statusColor(repSt))}>
                            {repSt === "approved" ? "✓ Approved" : repSt === "pending" ? "Under review" : repSt === "rejected" ? "Rejected" : "Draft"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isPending && (
                            <div className="flex gap-1.5">
                              <Button
                                size="sm" variant="approve"
                                disabled={approveEntry.isPending}
                                onClick={() => approveEntry.mutate({ id: e.id as string })}
                              >
                                ✓ Approve
                              </Button>
                              <Button
                                size="sm" variant="reject"
                                disabled={rejectEntry.isPending}
                                onClick={() => rejectEntry.mutate({ id: e.id as string })}
                              >
                                ✕
                              </Button>
                            </div>
                          )}
                          {isApproved && <span className="text-xs text-emerald-600 font-medium">✓ Done</span>}
                          {isDraft    && <span className="text-xs text-muted-foreground">Awaiting submission</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/30">
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-foreground">Total</td>
                    <td className="px-4 py-3 font-mono text-base font-bold text-primary">{totalApprovedHours}h</td>
                    <td colSpan={2} className="px-4 py-3 text-xs text-muted-foreground">
                      {filteredEntries.filter(e => (e.repStatus ?? e.rep_status) === "approved").reduce((s,e) => s + ((e.hours as number) ?? 0), 0)}h approved for FK invoice
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          {/* FK instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />How to submit FK 3057</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700 text-xs mt-2">
              <li>Review and approve all pending reports above</li>
              <li>Click <strong>Download FK 3057</strong> to generate the pre-filled PDF</li>
              <li>Sign the PDF (digital signature or print and sign)</li>
              <li>Submit to Försäkringskassan via <strong>Mina sidor</strong> or by post</li>
              <li>Deadline is the <strong>5th of the second month following</strong> (e.g. January → March 5)</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
