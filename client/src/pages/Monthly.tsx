import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entriesApi, assistantsApi, profileApi, pdfApi, payrollApi, paymentsApi } from "@/lib/api";
import type { Entry, Assistant } from "@/lib/types";
import type { PayrollRecord, Payment } from "@/lib/api";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Badge, Separator } from "@/components/ui/inputs";
import { PageHeader, SectionLabel, EmptyState, AssistantAvatar, ActivityPill } from "@/components/shared";
import { activityById } from "@/lib/activities";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  FileDown, ChevronLeft, ChevronRight, CheckCircle2, Clock,
  FileText, AlertCircle, Trash2, Pencil, Plus
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

// ── Utility functions ──────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Format SEK amount using sv-SE locale. Output: "15 234 kr" or "15 234,50 kr" */
function formatSek(amount: number): string {
  const formatted = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} kr`;
}

/** Format hours: integer or one decimal, no space before "h". E.g. "87h" or "87,5h" */
function formatHours(hours: number): string {
  const val = Number.isInteger(hours) ? hours : parseFloat(hours.toFixed(1));
  return `${String(val).replace(".", ",")}h`;
}

/**
 * Parse absenceBreakdownJson into a display string.
 * Input: '{"sjukfrånvaro":8,"vab":0,"semester":16,"other":0}'
 * Output: "sjukfrånvaro 8h, semester 16h" (omit types with 0 hours; "0h" if all zero)
 */
function formatAbsenceBreakdown(json: string | null): string {
  if (!json) return "0h";
  try {
    const breakdown = JSON.parse(json) as Record<string, number>;
    const parts = Object.entries(breakdown)
      .filter(([, h]) => h > 0)
      .map(([type, h]) => `${type} ${formatHours(h)}`);
    return parts.length > 0 ? parts.join(", ") : "0h";
  } catch {
    return "0h";
  }
}

/** YYYY-MM month helpers */
function monthLabelStr(month: string): string {
  const [year, mon] = month.split("-");
  const d = new Date(parseInt(year), parseInt(mon) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function prevMonthStr(month: string): string {
  const [year, mon] = month.split("-");
  const d = new Date(parseInt(year), parseInt(mon) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonthStr(month: string): string {
  const [year, mon] = month.split("-");
  const d = new Date(parseInt(year), parseInt(mon), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Progress Stepper ───────────────────────────────────────────────────────

type StepState = "complete" | "active" | "locked";

interface StepProps {
  number: number;
  label: string;
  sublabel?: string;
  state: StepState;
}

function StepCircle({ number, state }: { number: number; state: StepState }) {
  if (state === "complete") {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="w-5 h-5 text-white" />
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="w-8 h-8 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-primary">{number}</span>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full border-2 border-border bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-muted-foreground">{number}</span>
    </div>
  );
}

function ProgressStepper({ steps }: { steps: StepProps[] }) {
  return (
    <div className="flex items-center gap-0 mb-8 bg-card border border-border rounded-xl px-6 py-4">
      {steps.map((step, idx) => (
        <div key={step.number} className="flex items-center flex-1 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <StepCircle number={step.number} state={step.state} />
            <div className="min-w-0">
              <p className={cn(
                "text-sm font-semibold leading-tight",
                step.state === "locked" ? "text-muted-foreground" : "text-foreground"
              )}>
                {step.label}
              </p>
              {step.sublabel && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.sublabel}</p>
              )}
            </div>
          </div>
          {idx < steps.length - 1 && (
            <div className="flex-1 mx-4 h-px bg-border min-w-4" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── AssistantPayrollCard ───────────────────────────────────────────────────

type AssistantPayrollCardProps = {
  record: PayrollRecord;
  assistantName: string;
  assistantInitials?: string;
  assistantColor?: string;
};

function AssistantPayrollCard({
  record,
  assistantName,
  assistantInitials,
  assistantColor,
}: AssistantPayrollCardProps) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newMethod, setNewMethod] = useState<"bankgiro" | "swish" | "kontant">("bankgiro");

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["payments", record.id],
    queryFn:  () => paymentsApi.list(record.id).then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: () => payrollApi.approve(record.id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["payroll"] }),
  });

  const createPaymentMutation = useMutation({
    mutationFn: () => paymentsApi.create({
      payrollRecordId: record.id,
      assistantId:     record.assistantId,
      date:            newDate,
      amountSek:       parseFloat(newAmount.replace(",", ".")),
      method:          newMethod,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", record.id] });
      setNewDate(""); setNewAmount(""); setNewMethod("bankgiro");
      setShowAddForm(false);
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.delete(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["payments", record.id] }),
  });

  const totalPaid = payments.reduce((sum, p) => sum + p.amountSek, 0);
  const outstanding = Math.max(0, record.grossPay - totalPaid);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <AssistantAvatar name={assistantName} initials={assistantInitials} color={assistantColor} size={36} />
          <div>
            <h3 className="text-xl font-semibold text-foreground">{assistantName}</h3>
            {record.status === "draft"
              ? <Badge variant="slate">Draft</Badge>
              : <Badge variant="success">Approved</Badge>
            }
          </div>
        </div>
        {record.status === "draft" ? (
          <Button
            variant="default"
            size="sm"
            disabled={approveMutation.isPending}
            onClick={() => approveMutation.mutate()}
            className={cn(approveMutation.isPending && "opacity-50")}
          >
            {approveMutation.isPending ? "..." : "Approve"}
          </Button>
        ) : (
          <Button
            variant="approve"
            size="sm"
            disabled
            aria-label="Payroll record approved"
          >
            Approved ✓
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stat grid — 5 columns */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: "Billable hours",  value: formatHours(record.billableHours) },
            { label: "Absence hours",   value: formatAbsenceBreakdown(record.absenceBreakdownJson) },
            { label: "Gross pay",       value: <span aria-label={`${Math.round(record.grossPay)} kronor`}>{formatSek(record.grossPay)}</span> },
            { label: `Employer tax (${String((record.taxRateSnapshot * 100).toFixed(2)).replace(".", ",")}%)`, value: <span aria-label={`${Math.round(record.employerContributions)} kronor`}>{formatSek(record.employerContributions)}</span> },
            { label: "Total cost",      value: <span aria-label={`${Math.round(record.totalEmployerCost)} kronor`}>{formatSek(record.totalEmployerCost)}</span> },
          ].map(({ label, value }) => (
            <div key={label} className="bg-secondary rounded-lg p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
              <p className="text-xl font-semibold font-mono tabular-nums text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Payment history */}
        <SectionLabel>Payments</SectionLabel>
        {payments.length === 0 ? (
          <EmptyState message="No payments recorded yet." />
        ) : (
          <ul className="space-y-1">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm group">
                <span className="font-mono tabular-nums">{p.date}</span>
                <span className="font-mono tabular-nums">{formatSek(p.amountSek)}</span>
                <Badge variant="slate">{p.method}</Badge>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete this payment of ${formatSek(p.amountSek)}? This cannot be undone.`)) {
                      deletePaymentMutation.mutate(p.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                  aria-label={`Delete payment ${formatSek(p.amountSek)}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add payment toggle + form */}
        <Button variant="ghost" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          Add payment
        </Button>

        {showAddForm && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor={`date-${record.id}`}>Date</Label>
                <Input
                  id={`date-${record.id}`}
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`amount-${record.id}`}>Amount (SEK)</Label>
                <Input
                  id={`amount-${record.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`method-${record.id}`}>Method</Label>
                <select
                  id={`method-${record.id}`}
                  value={newMethod}
                  onChange={(e) => setNewMethod(e.target.value as "bankgiro" | "swish" | "kontant")}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="bankgiro">Bankgiro</option>
                  <option value="swish">Swish</option>
                  <option value="kontant">Cash</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                disabled={!newDate || !newAmount || createPaymentMutation.isPending}
                onClick={() => createPaymentMutation.mutate()}
              >
                {createPaymentMutation.isPending ? "..." : "Save payment"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowAddForm(false); setNewDate(""); setNewAmount(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <p className={cn(
          "text-sm font-mono",
          outstanding === 0 ? "text-emerald-700" : "text-amber-700"
        )}>
          Outstanding balance:{" "}
          <span aria-label={`${Math.round(outstanding)} kronor`}>
            {outstanding === 0 ? "Paid in full" : formatSek(outstanding)}
          </span>
        </p>
      </CardFooter>
    </Card>
  );
}

// ── Time helpers ───────────────────────────────────────────────────────────

/**
 * Compute decimal hours between startDate+startTime and endDate+endTime.
 * Handles cross-midnight shifts (e.g. 22:00 → next day 06:00 = 8h).
 * Quarter-hour precision.
 */
function hoursFromDateRange(startDate: string, startTime: string, endDate: string, endTime: string): number {
  if (!startDate || !startTime || !endDate || !endTime) return 0;
  const start = new Date(`${startDate}T${startTime}`);
  const end   = new Date(`${endDate}T${endTime}`);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / 3_600_000) * 4) / 4;
}

/** Single-day variant (backward compat for edit modal). */
function hoursFromRange(start: string, end: string): number {
  const today = new Date().toISOString().split("T")[0];
  return hoursFromDateRange(today, start, today, end);
}

// ── Main Monthly page ──────────────────────────────────────────────────────

export default function MonthlyPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  // ── Edit entry modal state ────────────────────────────────────────────────
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd,   setEditEnd]   = useState("");
  const [editHours, setEditHours] = useState("");

  // ── Add entry modal state ─────────────────────────────────────────────────
  const [addOpen,        setAddOpen]        = useState(false);
  const [addAssistantId, setAddAssistantId] = useState("");
  const [addStartDate,   setAddStartDate]   = useState("");
  const [addEndDate,     setAddEndDate]     = useState("");
  const [addStart,       setAddStart]       = useState("");
  const [addEnd,         setAddEnd]         = useState("");
  const [addError,       setAddError]       = useState<string | null>(null);

  // Single shared month key across both reports and payroll sections
  const monthKey = `${year}-${pad(month + 1)}`;

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: profile }        = useQuery({ queryKey: ["profile"],    queryFn: () => profileApi.get().then(r => r.data) });
  const { data: assistants = [] } = useQuery({ queryKey: ["assistants"], queryFn: () => assistantsApi.list().then(r => r.data) });

  const { data: entries = [] } = useQuery({
    queryKey: ["entries", year, month],
    queryFn:  () => entriesApi.list({
      start: `${year}-${pad(month + 1)}-01`,
      end:   `${year}-${pad(month + 1)}-${new Date(year, month + 1, 0).getDate()}`,
    }).then(r => r.data),
  });

  const { data: payrollRecords = [], isLoading: payrollLoading } = useQuery<PayrollRecord[]>({
    queryKey: ["payroll", monthKey],
    queryFn:  () => payrollApi.list(monthKey).then(r => r.data),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const approveEntry = useMutation({
    mutationFn: ({ id }: { id: string }) => entriesApi.update(id, { repStatus: "approved" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", year, month] }),
  });

  const rejectEntry = useMutation({
    mutationFn: ({ id }: { id: string }) => entriesApi.update(id, { repStatus: "rejected" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", year, month] }),
  });

  const approveAll = useMutation({
    mutationFn: async (assistantId: string) => {
      const toApprove = (entries as Entry[]).filter(e =>
        e.assistantId === assistantId &&
        e.reqStatus === "approved" &&
        e.repStatus === "pending"
      );
      for (const e of toApprove) {
        await entriesApi.update(e.id as string, { repStatus: "approved" });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", year, month] }),
  });

  const generatePayroll = useMutation({
    mutationFn: () => payrollApi.generate(monthKey),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["payroll", monthKey] }),
  });

  const editEntryMutation = useMutation({
    mutationFn: ({ id, startTime, endTime, hours }: { id: string; startTime: string; endTime: string; hours: number }) =>
      entriesApi.update(id, { startTime, endTime, hours }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries", year, month] });
      setEditEntry(null);
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => entriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries", year, month] });
      setAddOpen(false);
      setAddError(null);
      setAddAssistantId(""); setAddStartDate(""); setAddEndDate("");
      setAddStart(""); setAddEnd("");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err as Error)?.message
        ?? "Unknown error";
      setAddError(msg);
    },
  });

  const fk3057Download = useMutation({
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

  // ── Computed values ───────────────────────────────────────────────────────

  // Per-assistant summaries for Step 1 chips
  const summaries = useMemo(() => {
    return (assistants as Assistant[]).map(a => {
      const aid = a.id as string;
      const myEntries = (entries as Entry[]).filter(e => e.assistantId === aid);
      const approved   = myEntries.filter(e => e.reqStatus === "approved");
      const repPending = myEntries.filter(e =>
        e.reqStatus === "approved" && e.repStatus === "pending"
      );
      const repApproved = myEntries.filter(e => e.repStatus === "approved");
      const approvedHours = approved.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
      const reportedHours = repApproved.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);

      return { assistant: a, myEntries, approved, repPending, repApproved, approvedHours, reportedHours };
    }).filter(s => s.myEntries.length > 0);
  }, [assistants, entries]);

  // Pending count for FK gate
  const monthPendingCount = (entries as Entry[]).filter(e =>
    e.reqStatus === "approved" && e.repStatus === "pending"
  ).length;

  // Step completion
  const step1Complete = monthPendingCount === 0 && (entries as Entry[]).length > 0;
  const step2Complete = payrollRecords.length > 0 && payrollRecords.every(r => r.status === "approved");
  const fkUnlocked = step1Complete && step2Complete;

  // Stepper sub-labels
  const approvedReportsCount = (entries as Entry[]).filter(e => e.repStatus === "approved").length;
  const totalReportsCount = (entries as Entry[]).filter(e => e.reqStatus === "approved").length;
  const payrollApprovedCount = payrollRecords.filter(r => r.status === "approved").length;
  const payrollTotalCount = payrollRecords.length;

  // Payroll stat chips
  const totalGross = payrollRecords.reduce((s, r) => s + r.grossPay, 0);
  const totalEmployerCost = payrollRecords.reduce((s, r) => s + r.employerContributions, 0);
  const outstandingPayroll = payrollRecords
    .filter(r => r.status === "draft")
    .reduce((s, r) => s + r.grossPay, 0);

  // Approved entries for reports table
  const approvedEntries = useMemo(() => {
    return (entries as Entry[])
      .filter(e => e.reqStatus === "approved")
      .sort((a, b) => (a.date as string).localeCompare(b.date as string));
  }, [entries]);

  // D-07: Step 4 unlocks when all payroll is approved (same condition as step2Complete)
  const agiUnlocked = step2Complete;

  // ── Stepper state ─────────────────────────────────────────────────────────
  const stepperSteps: StepProps[] = [
    {
      number: 1,
      label: "Daily reports",
      sublabel: totalReportsCount > 0 ? `${approvedReportsCount}/${totalReportsCount}` : undefined,
      state: step1Complete ? "complete" : "active",
    },
    {
      number: 2,
      label: "Payroll",
      sublabel: payrollTotalCount > 0 ? `${payrollApprovedCount}/${payrollTotalCount}` : undefined,
      state: step2Complete ? "complete" : (step1Complete ? "active" : "active"),
    },
    {
      number: 3,
      label: "FK forms",
      state: fkUnlocked ? "complete" : "locked",
    },
    {
      number: 4,
      label: "AGI (4805)",
      state: agiUnlocked ? "active" : "locked",
    },
  ];

  // ── 4805 download handler ─────────────────────────────────────────────────
  async function download4805(assistantId: string, assistantName: string) {
    try {
      const res = await pdfApi.form4805(String(year), pad(month + 1), assistantId);
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `4805-${year}-${pad(month + 1)}-${assistantName.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not download form 4805. Ensure payroll is approved and the template PDF (skv4805.pdf) is in the forms/ directory.");
    }
  }

  // ── Month navigation ──────────────────────────────────────────────────────
  function goToPrevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function goToNextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const statusColor = (s: string) => ({
    approved: "text-emerald-600 bg-emerald-50 border-emerald-200",
    pending:  "text-amber-600 bg-amber-50 border-amber-200",
    draft:    "text-slate-500 bg-slate-50 border-slate-200",
    rejected: "text-red-600 bg-red-50 border-red-200",
  }[s] ?? "text-slate-500 bg-slate-50 border-slate-200");

  // Suppress unused warning for profile (loaded for side-effects / query cache)
  void profile;

  return (
    <div>
      <PageHeader
        title="Monthly"
        description="Approve reports, run payroll, and download FK forms"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={goToPrevMonth}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[140px] text-center capitalize">
              {monthLabelStr(monthKey)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={goToNextMonth}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <input
              type="month"
              value={monthKey}
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

      {/* ── Progress Stepper ── */}
      <ProgressStepper steps={stepperSteps} />

      {/* ════════════════════════════════════════════════════════════
          SECTION 1 — Daily reports
      ════════════════════════════════════════════════════════════ */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary-foreground">1</span>
            </div>
            <h2 className="text-base font-semibold text-foreground">Daily reports</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => {
              setAddStartDate(`${year}-${pad(month + 1)}-01`);
              setAddEndDate(`${year}-${pad(month + 1)}-01`);
              setAddOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add entry
          </Button>
        </div>

        {summaries.length === 0 ? (
          <div className="py-12 text-center bg-secondary/10 rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              Nothing yet for {MONTHS[month]} {year}. Reports appear here once assistants submit them.
            </p>
          </div>
        ) : (
          <>
            {/* Per-assistant summary chips */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {summaries.map(({ assistant, approved, repPending, repApproved, approvedHours, reportedHours }) => {
                const allReported = repPending.length === 0 && repApproved.length > 0;
                const needsAction = repPending.length > 0;
                return (
                  <Card
                    key={assistant.id as string}
                    className={cn(
                      "transition-all border-2",
                      needsAction ? "bg-amber-50/30 border-amber-200" : "border-border"
                    )}
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
                          onClick={() => approveAll.mutate(assistant.id as string)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve all {repPending.length} pending reports
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Report table */}
            {approvedEntries.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Assistant", "Date", "Time", "Activity", "Hours", "Verified", "Report status", "Action"].map(h => (
                          <th key={h} className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {approvedEntries.map(e => {
                        const a       = (assistants as Assistant[]).find(x => x.id === e.assistantId);
                        const repSt   = e.repStatus as string;
                        const isPending  = repSt === "pending";
                        const isApproved = repSt === "approved";
                        const isDraft    = repSt === "draft";

                        return (
                          <tr key={e.id as string} className={cn(
                            "border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors",
                            isPending ? "bg-amber-50/40" : ""
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
                              {e.startTime as string} – {e.endTime as string}
                            </td>
                            <td className="px-4 py-3">
                              <ActivityPill activityId={e.activityId as string} />
                            </td>
                            <td className="px-4 py-3 font-mono text-sm font-semibold">{e.hours}h</td>
                            <td className="px-4 py-3">
                              {/* Canonical entry.verified boolean — NOT source heuristic */}
                              {(e as Entry & { verified?: boolean }).verified === true
                                ? <Badge variant="success">Verified</Badge>
                                : <Badge variant="secondary">Manual</Badge>
                              }
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", statusColor(repSt))}>
                                {repSt === "approved" ? "✓ Approved" : repSt === "pending" ? "Under review" : repSt === "rejected" ? "Rejected" : "Draft"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5 items-center flex-wrap">
                                {isPending && (
                                  <>
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
                                  </>
                                )}
                                {isApproved && <span className="text-xs text-emerald-600 font-medium">✓ Done</span>}
                                {isDraft    && <span className="text-xs text-muted-foreground">Awaiting submission</span>}
                                {/* Edit button always visible for pending/approved entries */}
                                {(isPending || isApproved) && (
                                  <Button
                                    size="sm" variant="ghost"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                    title="Edit times"
                                    onClick={() => {
                                      setEditEntry(e as Entry);
                                      setEditStart((e.startTime as string) ?? "");
                                      setEditEnd((e.endTime as string) ?? "");
                                      setEditHours(String(e.hours ?? ""));
                                    }}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          SECTION 2 — Payroll
      ════════════════════════════════════════════════════════════ */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary-foreground">2</span>
          </div>
          <h2 className="text-base font-semibold text-foreground">Payroll</h2>
        </div>

        {payrollLoading ? (
          <div className="space-y-6">
            <div role="status" aria-label="Loading payroll records..." className="animate-pulse bg-muted rounded-xl h-48 w-full" />
            <div role="status" aria-label="Loading payroll records..." className="animate-pulse bg-muted rounded-xl h-48 w-full" />
          </div>
        ) : payrollRecords.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <EmptyState message="No payroll records for this month" />
            <Button
              variant="default"
              disabled={generatePayroll.isPending}
              onClick={() => generatePayroll.mutate()}
            >
              {generatePayroll.isPending ? "Generating..." : "Generate payroll"}
            </Button>
          </div>
        ) : (
          <>
            {/* 3 stat chips */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "Total gross pay",     value: formatSek(totalGross) },
                { label: "Total employer cost",  value: formatSek(totalEmployerCost) },
                { label: "Outstanding",          value: formatSek(outstandingPayroll) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
                  <p className="text-2xl font-semibold font-mono tabular-nums text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {/* Per-assistant payroll cards */}
            <div className="space-y-6">
              {payrollRecords.map((record) => {
                const asst = (assistants as Assistant[]).find(a => (a.id as string) === record.assistantId);
                return (
                  <AssistantPayrollCard
                    key={record.id}
                    record={record}
                    assistantName={asst?.name as string ?? record.assistantId}
                    assistantInitials={asst?.initials as string | undefined}
                    assistantColor={asst?.color as string | undefined}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          SECTION 3 — FK forms
      ════════════════════════════════════════════════════════════ */}
      <div className={cn("rounded-xl border p-6", fkUnlocked ? "bg-card border-border" : "bg-muted/50 border-border/50")}>
        <div className="flex items-center gap-3 mb-4">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
            fkUnlocked ? "bg-primary" : "bg-muted-foreground/30"
          )}>
            <span className={cn("text-xs font-bold", fkUnlocked ? "text-primary-foreground" : "text-muted-foreground")}>3</span>
          </div>
          <h2 className={cn("text-base font-semibold", fkUnlocked ? "text-foreground" : "text-muted-foreground")}>FK forms</h2>
          {!fkUnlocked && (
            <span className="text-xs text-muted-foreground bg-muted border border-border rounded-full px-2 py-0.5">
              Complete steps 1 and 2 first
            </span>
          )}
        </div>

        {/* FK 3059 — per assistant */}
        {summaries.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">FK 3059 — Per assistant</p>
            {summaries.map(({ assistant }) => (
              <Button
                key={assistant.id as string}
                variant="outline"
                size="sm"
                disabled={!fkUnlocked}
                title={!fkUnlocked ? "Approve all reports and payroll first" : undefined}
                className="gap-2 mr-2"
                onClick={async () => {
                  if (!fkUnlocked) return;
                  try {
                    const res = await pdfApi.fk3059(String(year), pad(month + 1), assistant.id as string);
                    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `FK3059-${year}-${pad(month + 1)}-${(assistant.name as string).replace(/\s+/g, "-")}.pdf`;
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
                Download FK 3059 — {assistant.name as string}
              </Button>
            ))}
          </div>
        )}

        {/* FK 3057 — full month */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">FK 3057 — Full month</p>
          <Button
            variant="default"
            disabled={!fkUnlocked || fk3057Download.isPending}
            title={!fkUnlocked ? "Approve all reports and payroll first" : undefined}
            className="gap-2"
            onClick={() => fk3057Download.mutate()}
          >
            <FileDown className="w-4 h-4" />
            {fk3057Download.isPending ? "Generating..." : "Download FK 3057"}
          </Button>
          {!fkUnlocked && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Approve all reports and payroll first
            </p>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          SECTION 4 — AGI (blankett 4805)
      ════════════════════════════════════════════════════════════ */}
      <div className="mb-10 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
            agiUnlocked ? "bg-primary" : "bg-muted"
          )}>
            <span className={cn("text-xs font-bold", agiUnlocked ? "text-primary-foreground" : "text-muted-foreground")}>4</span>
          </div>
          <h2 className="text-base font-semibold text-foreground">AGI (blankett 4805)</h2>
        </div>

        {!agiUnlocked ? (
          <div className="py-10 text-center bg-secondary/10 rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              Approve all payroll records to unlock AGI download.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Download a pre-filled blankett 4805 (Förenklad arbetsgivardeklaration) for each assistant.
              Submit to Skatteverket by the 12th of the following month.
            </p>
            <div className="grid lg:grid-cols-2 gap-3">
              {(assistants as Assistant[]).map((a) => {
                const record = payrollRecords.find(r => r.assistantId === (a.id as string));
                const isApproved = record?.status === "approved";
                return (
                  <Card key={a.id as string}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <AssistantAvatar name={a.name as string} initials={a.initials as string} color={a.color as string} size={36} />
                          <div>
                            <p className="font-semibold text-sm">{a.name as string}</p>
                            {record && (
                              <p className="text-xs text-muted-foreground">
                                Gross: {formatSek(record.grossPay)} · Tax withheld: {formatSek(record.grossPay * (record.prelimTaxRateSnapshot ?? 0))}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isApproved ? "default" : "ghost"}
                          disabled={!isApproved}
                          title={isApproved ? "Download blankett 4805" : "Approve payroll first"}
                          onClick={() => isApproved && download4805(a.id as string, a.name as string)}
                        >
                          <FileDown className="w-4 h-4" />
                          {isApproved ? "Download 4805" : "Payroll pending"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Edit entry modal ────────────────────────────────────────────────── */}
      <Dialog open={!!editEntry} onOpenChange={(open) => { if (!open) setEditEntry(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit report times</DialogTitle>
            <DialogDescription>
              Correct the start time, end time, or hours for this entry.
              Hours auto-calculate when you change the times.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-start">Start time</Label>
                <Input
                  id="edit-start"
                  type="time"
                  value={editStart}
                  onChange={e => {
                    setEditStart(e.target.value);
                    if (editEnd) setEditHours(String(hoursFromRange(e.target.value, editEnd)));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-end">End time</Label>
                <Input
                  id="edit-end"
                  type="time"
                  value={editEnd}
                  onChange={e => {
                    setEditEnd(e.target.value);
                    if (editStart) setEditHours(String(hoursFromRange(editStart, e.target.value)));
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-hours">Hours</Label>
              <Input
                id="edit-hours"
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={editHours}
                onChange={e => setEditHours(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Auto-calculated from times, or enter manually.</p>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
              <Button
                disabled={editEntryMutation.isPending || !editStart || !editEnd || !editHours}
                onClick={() => {
                  if (!editEntry) return;
                  editEntryMutation.mutate({
                    id:        editEntry.id as string,
                    startTime: editStart,
                    endTime:   editEnd,
                    hours:     parseFloat(editHours),
                  });
                }}
              >
                {editEntryMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add entry modal ──────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setAddError(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add entry manually</DialogTitle>
            <DialogDescription>
              Add hours that were not clock-logged. Entry counts immediately toward FK reports and payroll.
            </DialogDescription>
          </DialogHeader>
          {addError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {addError}
            </div>
          )}
          <div className="grid gap-4 mt-2">
            {/* Assistant */}
            <div className="space-y-1.5">
              <Label htmlFor="add-assistant">Assistant</Label>
              <select
                id="add-assistant"
                value={addAssistantId}
                onChange={e => setAddAssistantId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
              >
                <option value="">Select assistant…</option>
                {(assistants as Assistant[]).map(a => (
                  <option key={a.id as string} value={a.id as string}>{a.name as string}</option>
                ))}
              </select>
            </div>

            {/* Start date + time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-start-date">Start date</Label>
                <Input
                  id="add-start-date"
                  type="date"
                  value={addStartDate}
                  onChange={e => setAddStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-start-time">Start time</Label>
                <Input
                  id="add-start-time"
                  type="time"
                  value={addStart}
                  onChange={e => setAddStart(e.target.value)}
                />
              </div>
            </div>

            {/* End date + time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-end-date">End date</Label>
                <Input
                  id="add-end-date"
                  type="date"
                  value={addEndDate}
                  onChange={e => setAddEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-end-time">End time</Label>
                <Input
                  id="add-end-time"
                  type="time"
                  value={addEnd}
                  onChange={e => setAddEnd(e.target.value)}
                />
              </div>
            </div>

            {/* Hours — read-only, auto-calculated */}
            {(() => {
              const computed = hoursFromDateRange(addStartDate, addStart, addEndDate, addEnd);
              return computed > 0 ? (
                <div className="bg-muted/50 border border-border rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Hours</span>
                  <span className="font-mono font-semibold text-foreground">{computed}h</span>
                </div>
              ) : null;
            })()}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button
                disabled={
                  createEntryMutation.isPending ||
                  !addAssistantId || !addStartDate || !addEndDate || !addStart || !addEnd ||
                  hoursFromDateRange(addStartDate, addStart, addEndDate, addEnd) <= 0
                }
                onClick={() => {
                  const hours = hoursFromDateRange(addStartDate, addStart, addEndDate, addEnd);
                  createEntryMutation.mutate({
                    assistantId: addAssistantId,
                    date:        addStartDate,
                    startTime:   addStart,
                    endTime:     addEnd,
                    hours,
                    entryType:   "active",
                    reqStatus:   "approved",
                    repStatus:   "approved",
                    source:      "manual",
                  });
                }}
              >
                {createEntryMutation.isPending ? "Adding…" : "Add entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
