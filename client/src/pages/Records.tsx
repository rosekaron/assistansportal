import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { payrollApi, absenceApi, assistantsApi } from "@/lib/api";
import type { PayrollRecord, Absence, AbsenceBalance, AbsenceType } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/inputs";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/controls";
import { PageHeader, AssistantAvatar, EmptyState } from "@/components/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format SEK amount: "15 234 kr" */
function formatSek(amount: number): string {
  const formatted = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} kr`;
}

/** Format YYYY-MM → "January 2026" */
function monthLabel(month: string): string {
  const [year, mon] = month.split("-");
  const d = new Date(parseInt(year), parseInt(mon) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Format ISO date string → "4 Apr 2026" */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Format period: "1 Jan – 31 Jan 2026" */
function formatPeriod(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T12:00:00");
  const end   = new Date(endDate   + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("en-GB", opts)} – ${end.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
}

/** Calendar days (inclusive) between two YYYY-MM-DD strings */
function calDays(startDate: string, endDate: string): number {
  return Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
}

/** Absence type → display label */
const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  "sjukfrånvaro": "Sick leave",
  "vab":          "VAB",
  "semester":     "Holiday",
  "other":        "Other",
};

/** Absence type badge */
function AbsenceTypeBadge({ type }: { type: AbsenceType }) {
  const variants: Record<AbsenceType, "warning" | "info" | "success" | "slate"> = {
    "sjukfrånvaro": "warning",
    "vab":          "info",
    "semester":     "success",
    "other":        "slate",
  };
  return (
    <Badge variant={variants[type] ?? "slate"}>
      {ABSENCE_TYPE_LABELS[type] ?? type}
    </Badge>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type AssistantInfo = { id: string; name: string; initials?: string; color?: string };

/** Per-assistant balance card pair (same pattern as Leave.tsx) */
function AssistantBalanceCards({ assistant }: { assistant: AssistantInfo }) {
  const { data: balance, isLoading } = useQuery<AbsenceBalance>({
    queryKey: ["absences", "balance", assistant.id],
    queryFn:  () => absenceApi.balance(assistant.id).then((r) => r.data),
  });

  const vabRemaining = balance?.vabRemaining ?? 120;
  const sickDays     = balance?.sickDays ?? 0;
  const usedVab      = 120 - vabRemaining;
  const pct          = Math.min(100, (usedVab / 120) * 100);

  const vabColor =
    vabRemaining >= 30 ? "text-emerald-600" :
    vabRemaining >= 10 ? "text-amber-600" :
    "text-red-600";

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* VAB balance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <AssistantAvatar name={assistant.name} initials={assistant.initials} color={assistant.color} size={20} />
            {assistant.name}
          </CardTitle>
          <p className="text-xs text-muted-foreground">VAB remaining</p>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <p className="text-2xl font-bold text-muted-foreground">--</p>
          ) : (
            <>
              <p className={cn("text-2xl font-bold", vabColor)}>{vabRemaining}</p>
              <p className="text-xs text-muted-foreground mt-1">days remaining of 120</p>
              <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sick days YTD */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <AssistantAvatar name={assistant.name} initials={assistant.initials} color={assistant.color} size={20} />
            {assistant.name}
          </CardTitle>
          <p className="text-xs text-muted-foreground">Sick leave YTD</p>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <p className="text-2xl font-bold text-muted-foreground">--</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-foreground">{sickDays}</p>
              <p className="text-xs text-muted-foreground mt-1">days recorded</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Year selector ─────────────────────────────────────────────────────────────

function YearSelector({
  year,
  onChange,
}: {
  year: number;
  onChange: (y: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <button
        onClick={() => onChange(year - 1)}
        className="p-1 rounded hover:bg-muted transition-colors"
        aria-label="Previous year"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="tabular-nums w-12 text-center">{year}</span>
      <button
        onClick={() => onChange(year + 1)}
        disabled={year >= currentYear}
        className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Next year"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const EMPTY_STATE_MSG = "No records yet. Data appears here once you complete a monthly cycle.";

export default function RecordsPage() {
  const now = new Date();
  const [selectedYear,      setSelectedYear]      = useState(now.getFullYear());
  const [selectedAssistant, setSelectedAssistant] = useState<string>("all");
  const [tab,               setTab]               = useState("payroll");

  // Assistants list
  const { data: rawAssistants = [] } = useQuery({
    queryKey: ["assistants"],
    queryFn:  () => assistantsApi.list().then((r) => r.data as AssistantInfo[]),
  });
  const assistants = rawAssistants as AssistantInfo[];

  // Payroll: query all 12 months for selected year
  const { data: allPayrollRecords = [] } = useQuery<PayrollRecord[]>({
    queryKey: ["payroll-year", selectedYear],
    queryFn: async () => {
      const months = Array.from({ length: 12 }, (_, i) =>
        `${selectedYear}-${String(i + 1).padStart(2, "0")}`
      );
      const results = await Promise.all(
        months.map((m) => payrollApi.list(m).then((r) => r.data))
      );
      return results.flat();
    },
  });

  // Absences: all absences filtered to selected year
  const { data: allAbsences = [] } = useQuery<Absence[]>({
    queryKey: ["absences-year", selectedYear],
    queryFn: () =>
      absenceApi.list().then((r) =>
        (r.data as Absence[]).filter((a) =>
          a.startDate.startsWith(String(selectedYear))
        )
      ),
  });

  // ── Payroll tab: group records by month (descending) ────────────────────────
  const payrollByMonth: Map<string, PayrollRecord[]> = new Map();
  for (const rec of allPayrollRecords) {
    const list = payrollByMonth.get(rec.month) ?? [];
    list.push(rec);
    payrollByMonth.set(rec.month, list);
  }
  const sortedPayrollMonths = Array.from(payrollByMonth.keys()).sort().reverse();

  // ── FK Submissions tab: months where ALL records are approved ───────────────
  const completedMonths = sortedPayrollMonths.filter((m) => {
    const records = payrollByMonth.get(m) ?? [];
    return records.length > 0 && records.every((r) => r.status === "approved");
  });

  // For each complete month, find the latest approvedAt date
  function latestApprovedAt(month: string): string | null {
    const records = payrollByMonth.get(month) ?? [];
    const dates = records.map((r) => r.approvedAt).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.sort().reverse()[0];
  }

  // ── Leave tab: filter absences by assistant ─────────────────────────────────
  const filteredAbsences =
    selectedAssistant === "all"
      ? allAbsences
      : allAbsences.filter((a) => a.assistantId === selectedAssistant);

  const sortedAbsences = [...filteredAbsences].sort(
    (a, b) => b.startDate.localeCompare(a.startDate)
  );

  const assistantsForLeave =
    selectedAssistant === "all"
      ? assistants
      : assistants.filter((a) => a.id === selectedAssistant);

  function assistantById(id: string | null): AssistantInfo | null {
    if (!id) return null;
    return assistants.find((a) => a.id === id) ?? null;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Records"
        description="Historical lookup for payroll, FK submissions, and leave"
        action={<YearSelector year={selectedYear} onChange={setSelectedYear} />}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="fk">FK Submissions</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>

        {/* ── Payroll tab ────────────────────────────────────────────────────── */}
        <TabsContent value="payroll">
          {sortedPayrollMonths.length === 0 ? (
            <EmptyState message={EMPTY_STATE_MSG} />
          ) : (
            <div className="space-y-6">
              {sortedPayrollMonths.map((month) => {
                const records = payrollByMonth.get(month) ?? [];
                return (
                  <div key={month}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {monthLabel(month)}
                    </p>
                    <Card>
                      <CardContent className="p-0 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="border-b border-border bg-card">
                            <tr>
                              {["Assistant", "Billable hours", "Gross pay", "Employer cost", "Status"].map((h) => (
                                <th
                                  key={h}
                                  className="text-left text-[11px] uppercase tracking-wide text-muted-foreground px-4 py-3 font-semibold"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {records.map((rec) => {
                              const asst = assistantById(rec.assistantId);
                              return (
                                <tr
                                  key={rec.id}
                                  className="border-b border-border last:border-0 hover:bg-muted/50"
                                >
                                  <td className="px-4 py-3">
                                    {asst ? (
                                      <div className="flex items-center gap-2">
                                        <AssistantAvatar
                                          name={asst.name}
                                          initials={asst.initials}
                                          color={asst.color}
                                          size={24}
                                        />
                                        <span className="text-foreground">{asst.name}</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">{rec.assistantId}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-foreground">
                                    {rec.billableHours}h
                                  </td>
                                  <td className="px-4 py-3 font-mono text-foreground">
                                    {formatSek(rec.grossPay)}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-foreground">
                                    {formatSek(rec.totalEmployerCost)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge
                                      variant={rec.status === "approved" ? "success" : "warning"}
                                    >
                                      {rec.status === "approved" ? "Approved" : "Draft"}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── FK Submissions tab ──────────────────────────────────────────────── */}
        <TabsContent value="fk">
          {completedMonths.length === 0 ? (
            <EmptyState message="No completed months yet. FK cycles appear here once all payroll is approved." />
          ) : (
            <Card>
              <CardContent className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-card">
                    <tr>
                      {["Month", "Status", "Cycle completed"].map((h) => (
                        <th
                          key={h}
                          className="text-left text-[11px] uppercase tracking-wide text-muted-foreground px-4 py-3 font-semibold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {completedMonths.map((month) => {
                      const approvedAt = latestApprovedAt(month);
                      return (
                        <tr
                          key={month}
                          className="border-b border-border last:border-0 hover:bg-muted/50"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {monthLabel(month)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="success">Cycle complete</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-sm">
                            {approvedAt ? formatDate(approvedAt) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            FK cycles are derived from payroll approval status (V1 approximation — dedicated submission log is post-MVP).
          </p>
        </TabsContent>

        {/* ── Leave tab ──────────────────────────────────────────────────────── */}
        <TabsContent value="leave">
          {/* Assistant filter */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex flex-col gap-1 min-w-[200px]">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assistant</p>
              <Select
                value={selectedAssistant}
                onValueChange={(v) => setSelectedAssistant(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All assistants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assistants</SelectItem>
                  {assistants.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Balance cards */}
          {assistantsForLeave.length > 0 && (
            <div className="space-y-4 mb-6">
              {assistantsForLeave.map((a) => (
                <AssistantBalanceCards key={a.id} assistant={a} />
              ))}
            </div>
          )}

          {/* Absence history */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Absence history {selectedYear}
          </p>
          <Card>
            <CardContent className="p-0 overflow-hidden">
              {sortedAbsences.length === 0 ? (
                <EmptyState message={EMPTY_STATE_MSG} />
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-card">
                    <tr>
                      {["Assistant", "Period", "Days", "Type"].map((h) => (
                        <th
                          key={h}
                          className="text-left text-[11px] uppercase tracking-wide text-muted-foreground px-4 py-3 font-semibold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAbsences.map((absence) => {
                      const asst = assistantById(absence.assistantId);
                      return (
                        <tr
                          key={absence.id}
                          className="border-b border-border last:border-0 hover:bg-muted/50"
                        >
                          <td className="px-4 py-3">
                            {asst ? (
                              <div className="flex items-center gap-2">
                                <AssistantAvatar
                                  name={asst.name}
                                  initials={asst.initials}
                                  color={asst.color}
                                  size={24}
                                />
                                <span className="text-foreground">{asst.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">All assistants</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatPeriod(absence.startDate, absence.endDate)}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {calDays(absence.startDate, absence.endDate)}
                          </td>
                          <td className="px-4 py-3">
                            <AbsenceTypeBadge type={absence.absenceType} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
