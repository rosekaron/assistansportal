import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  profileApi,
  settingsApi,
  assistantsApi,
  entriesApi,
  payrollApi,
  absenceApi,
  pdfApi,
  gcalApi,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/inputs";
import { PageHeader, EmptyState } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/controls";
import {
  Info,
  CheckCircle2,
  FileDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Banknote,
  UserX,
} from "lucide-react";
import { getWeekDates, cn } from "@/lib/utils";

type Entry     = Record<string, string | number | null | undefined>;
type Assistant = Record<string, string | number | null | undefined>;

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS    = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function pad(n: number) { return String(n).padStart(2, "0"); }

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

type MarkAbsentEntry = {
  assistantId: string;
  assistantName: string;
  date: string;
};

const ABSENCE_OPTIONS: { label: string; value: string }[] = [
  { label: "Sick leave", value: "sjukfrånvaro" },
  { label: "VAB",        value: "vab" },
  { label: "Holiday",    value: "semester" },
  { label: "Other",      value: "other" },
];

export default function HomePage() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const now          = new Date();

  const [markAbsentEntry, setMarkAbsentEntry] = useState<MarkAbsentEntry | null>(null);
  const [absenceType,     setAbsenceType]     = useState<string>("sjukfrånvaro");
  const [addShiftDate,    setAddShiftDate]    = useState<string | null>(null);
  const [shiftForm,       setShiftForm]       = useState({ assistantId: "", startTime: "08:00", endTime: "16:00" });

  // ── Week navigator state ───────────────────────────────────
  const [weekOffset, setWeekOffset] = useState(0);

  // ── Hoist weekDates so gcalEvents query can reference it ──────
  const weekDates = getWeekDates(weekOffset);
  const todayStr  = now.toISOString().split("T")[0];

  // ── Data queries ───────────────────────────────────────────
  const { data: profile }         = useQuery({ queryKey: ["profile"],    queryFn: () => profileApi.get().then(r => r.data) });
  const { data: settings = {} }   = useQuery({ queryKey: ["settings"],   queryFn: () => settingsApi.get().then(r => r.data) });
  const { data: assistants = [] } = useQuery({ queryKey: ["assistants"], queryFn: () => assistantsApi.list().then(r => r.data) });
  const { data: entries    = [] } = useQuery({ queryKey: ["entries"],    queryFn: () => entriesApi.list().then(r => r.data), staleTime: 0, refetchOnWindowFocus: true });
  const gcalConnected = (settings as Record<string, string>).gcal_connected === "true";
  const { data: gcalEvents = [] } = useQuery({
    queryKey: ["gcal-events-home", weekDates[0]],
    queryFn:  () => gcalApi.events(weekDates[0], weekDates[6]).then(r => r.data as Record<string, unknown>[]),
    enabled:  gcalConnected,
    staleTime: 2 * 60 * 1000,
  });

  // ── FK deadline (copied from Dashboard.tsx lines 56-76) ────
  const invoiceMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const invoiceYear     = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const dueDate         = new Date(now.getFullYear(), now.getMonth() + 1, 5);
  const daysUntilDue    = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const invoiceMonthStr = `${invoiceYear}-${pad(invoiceMonthIdx + 1)}`;

  const { data: payrollRecords = [] } = useQuery({
    queryKey: ["payroll", invoiceMonthStr],
    queryFn:  () => payrollApi.list(invoiceMonthStr).then(r => r.data),
  });

  // ── Mutations ──────────────────────────────────────────────
  const fkDownload = useMutation({
    mutationFn: () => pdfApi.fk3057(String(invoiceYear), pad(invoiceMonthIdx + 1)),
    onSuccess: (res) => {
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `FK3057-${invoiceYear}-${pad(invoiceMonthIdx + 1)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const markAbsent = useMutation({
    mutationFn: (entry: MarkAbsentEntry) =>
      absenceApi.create({
        assistantId: entry.assistantId,
        absenceType,
        startDate: entry.date,
        endDate:   entry.date,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      setMarkAbsentEntry(null);
      setAbsenceType("sjukfrånvaro");
    },
  });

  const addEntry = useMutation({
    mutationFn: (data: Record<string, unknown>) => entriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      setAddShiftDate(null);
      setShiftForm({ assistantId: "", startTime: "08:00", endTime: "16:00" });
    },
  });

  // ── Computed values ────────────────────────────────────────
  const allEntries = entries as Entry[];

  const pendingApprovals = allEntries.filter(e =>
    e.reqStatus === "approved" && e.repStatus === "pending"
  );

  const payrollPendingCount = (payrollRecords as { status: string }[]).filter(r => r.status === "draft").length;

  const invoiceEntries  = allEntries.filter(e => (e.date as string)?.startsWith(invoiceMonthStr) && e.reqStatus === "approved");
  const invoiceReady    = invoiceEntries.filter(e => e.repStatus === "approved");
  const invoiceHours    = invoiceReady.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
  const invoiceTotalHrs = invoiceEntries.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
  const invoicePending  = invoiceEntries.filter(e => e.repStatus === "pending").length;
  const invoiceIsReady  = invoicePending === 0 && invoiceReady.length > 0;

  const fkGated = invoicePending > 0 || invoiceHours === 0;

  // ── Schedule grid data (D-01, D-03) ───────────────────────
  //
  // Source of truth for DISPLAY is Google Calendar when connected.
  // The internal `entries` table is still the source of truth for
  // payroll / FK / absence — those downstream consumers read from
  // entries, not GCal. When GCal is not connected, the grid falls
  // back to entries so the view is never blank.
  //
  // GCal events are matched to assistants by case-insensitive name
  // in the event summary: "Assistance: {Name}" / "Assistance : {Name}"
  // / "Shift: {Name}" (clock-out format, see server/routes/clock.ts).
  type ShiftLike = { date: string; startTime: string; endTime: string; hours: number };

  const entriesAsShifts: (ShiftLike & { assistantId: string })[] = (entries as Entry[])
    .filter(e => weekDates.includes(e.date as string))
    .map(e => ({
      assistantId: e.assistantId as string,
      date:        e.date as string,
      startTime:   (e.startTime as string) ?? "",
      endTime:     (e.endTime as string) ?? "",
      hours:       (e.hours as number) ?? 0,
    }));

  const gcalShifts: (ShiftLike & { assistantId: string })[] = gcalConnected
    ? (gcalEvents as Record<string, unknown>[]).flatMap(ev => {
        const start = ev.start as Record<string, string> | undefined;
        const end   = ev.end   as Record<string, string> | undefined;
        const startDT = start?.dateTime ?? start?.date ?? "";
        const endDT   = end?.dateTime   ?? end?.date   ?? "";
        if (!startDT) return [];
        const date      = startDT.slice(0, 10);
        if (!weekDates.includes(date)) return [];
        const startTime = startDT.slice(11, 16) || "00:00";
        const endTime   = endDT.slice(11, 16)   || "00:00";
        const summary = (ev.summary as string) ?? "";
        const nameMatch = /(?:Assistance|Shift)\s*:\s*(.+)$/.exec(summary);
        const name = nameMatch ? nameMatch[1].trim() : "";
        if (!name) return [];
        const assistant = (assistants as Assistant[]).find(
          a => ((a.name as string) ?? "").toLowerCase() === name.toLowerCase()
        );
        if (!assistant) return [];
        // Hours from timestamps (handles overnight: start > end → +24h).
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        let hours = (eh * 60 + em - sh * 60 - sm) / 60;
        if (hours < 0) hours += 24;
        return [{ assistantId: assistant.id as string, date, startTime, endTime, hours }];
      })
    : [];

  const displayShifts = gcalConnected ? gcalShifts : entriesAsShifts;

  const byAssistantDay = (assistants as Assistant[]).map(assistant => ({
    assistant,
    days: weekDates.map(date =>
      displayShifts.filter(
        s => s.assistantId === (assistant.id as string) && s.date === date
      )
    ),
  }));

  const dailyTotals = weekDates.map(date =>
    displayShifts
      .filter(s => s.date === date)
      .reduce((sum, s) => sum + s.hours, 0)
  );

  // Week label: "Mon 14 Apr – Sun 20 Apr"
  const weekLabel = weekDates.length === 7
    ? `${new Date(weekDates[0] + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} – ${new Date(weekDates[6] + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`
    : "";

  const guardianFirst = (profile?.guardianName as string)?.split(" ")[0] ?? "";
  const patientName   = (profile?.patientName  as string) ?? "";

  return (
    <div>
      {/* ── Setup banner (conditional) ───────────────────────── */}
      {!profile?.setupDone && (
        <div className="mb-5 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-blue-800">Welcome! Let's get you set up</p>
            <p className="text-xs text-blue-600 mt-0.5">Add care details, FK decision number, and assistants to unlock all features</p>
          </div>
          <a href="/setup">
            <button className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-1.5 transition-colors whitespace-nowrap font-medium shadow-sm">
              Complete setup →
            </button>
          </a>
        </div>
      )}

      {/* ── Page header ──────────────────────────────────────── */}
      <PageHeader
        title={`${greeting()}${guardianFirst ? `, ${guardianFirst}` : ""}`}
        description={`${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${patientName ? ` · Care for ${patientName}` : ""}`}
      />

      {/* ── GCal status banner ───────────────────────────────── */}
      {!gcalConnected ? (
        <div className="mb-5 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-sm text-blue-800">
            Connect Google Calendar in Settings →{" "}
            <button
              onClick={() => navigate("/settings")}
              className="underline font-medium hover:text-blue-900 transition-colors"
            >
              Go to Settings
            </button>
          </p>
        </div>
      ) : (
        <p className="text-xs text-emerald-600 mb-5 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Synced with Google Calendar ✓
        </p>
      )}

      {/* ── This week's schedule ─────────────────────────────── */}
      <Card className="mb-5">
        <CardContent className="pt-5">
          <p className="text-base font-semibold mb-3">This week's schedule</p>

          {/* Week navigation (D-02) */}
          <div className="flex items-center justify-between mb-4 gap-2">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Previous week"
              onClick={() => setWeekOffset(o => o - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>
            <span className="text-sm font-semibold text-foreground text-center flex-1">{weekLabel}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(0)}
              className={cn(weekOffset === 0 ? "border-primary text-primary" : "")}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Next week"
              onClick={() => setWeekOffset(o => o + 1)}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Schedule table (D-01, D-04, D-05) */}
          {(assistants as Assistant[]).length === 0 ? (
            <EmptyState message="No assistants added yet. Add assistants in Settings." />
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-secondary/40">
                    <th
                      scope="col"
                      className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 py-2 w-28 min-w-[7rem]"
                    >
                      Assistant
                    </th>
                    {weekDates.map((date, i) => {
                      const isToday = date === todayStr;
                      return (
                        <th
                          key={date}
                          scope="col"
                          aria-current={isToday ? "date" : undefined}
                          className={cn(
                            "text-center text-xs font-semibold px-1 py-2 min-w-[3.5rem]",
                            isToday ? "text-primary" : "text-muted-foreground"
                          )}
                          style={isToday ? { borderBottom: "2px solid hsl(var(--primary))" } : undefined}
                        >
                          <div>{DAY_NAMES[i]}</div>
                          <div className="font-mono text-[11px] font-normal mt-0.5">
                            {new Date(date + "T12:00:00").getDate()}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {byAssistantDay.map(({ assistant, days }) => (
                    <tr
                      key={assistant.id as string}
                      className="border-t border-border hover:bg-secondary/20 transition-colors"
                    >
                      <th
                        scope="row"
                        className="text-left px-2 py-2 font-normal"
                      >
                        <div className="flex items-center gap-1.5">
                          {/* Color dot (D-04): 8×8px filled circle using assistant.color hex */}
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: (assistant.color as string) || "#6366f1" }}
                            aria-hidden="true"
                          />
                          <span className="text-xs font-medium text-foreground truncate max-w-[5rem]">
                            {(assistant.name as string)?.split(" ")[0]}
                          </span>
                        </div>
                      </th>
                      {days.map((dayEntries, i) => {
                        const date = weekDates[i];
                        const isToday = date === todayStr;
                        const hasShift = dayEntries.length > 0;
                        // Sort shifts by start time so multiple-shift days render chronologically
                        const sortedShifts = [...dayEntries].sort((a, b) =>
                          ((a.startTime as string) ?? "").localeCompare((b.startTime as string) ?? "")
                        );
                        return (
                          <td
                            key={date}
                            aria-current={isToday ? "date" : undefined}
                            className={cn(
                              "text-center px-1 py-2 relative group",
                              isToday ? "bg-primary/5" : ""
                            )}
                            style={isToday ? { borderLeft: "2px solid hsl(var(--primary))" } : undefined}
                          >
                            {hasShift ? (
                              <div className="relative inline-flex flex-col items-start gap-0.5">
                                {sortedShifts.map((shift, shiftIdx) => (
                                  <span
                                    key={shiftIdx}
                                    className="text-xs font-mono text-muted-foreground whitespace-nowrap"
                                    style={{ borderLeft: `2px solid ${(assistant.color as string) || "#6366f1"}`, paddingLeft: "4px" }}
                                  >
                                    {(shift.startTime as string)?.substring(0, 5)}–{(shift.endTime as string)?.substring(0, 5)}
                                  </span>
                                ))}
                                {/* Mark absent trigger (hover only) */}
                                <button
                                  className="absolute -top-1.5 -right-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  aria-label={`Mark ${assistant.name as string} absent on ${date}`}
                                  onClick={() => setMarkAbsentEntry({
                                    assistantId: assistant.id as string,
                                    assistantName: assistant.name as string,
                                    date,
                                  })}
                                >
                                  <UserX className="w-3 h-3 text-muted-foreground hover:text-destructive transition-colors" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs">–</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-secondary/20">
                    <td className="px-2 py-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                      Total
                    </td>
                    {dailyTotals.map((hrs, i) => (
                      <td key={weekDates[i]} className="text-center px-1 py-1.5 text-xs font-mono font-semibold text-foreground">
                        {hrs > 0 ? `${hrs}h` : "—"}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
              {displayShifts.length === 0 && (assistants as Assistant[]).length > 0 && (
                <p
                  aria-live="polite"
                  className="text-xs text-muted-foreground text-center py-3"
                >
                  No shifts scheduled this week.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pending actions ──────────────────────────────────── */}
      <Card className="mb-5">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Pending actions
          </p>

          {pendingApprovals.length === 0 && payrollPendingCount === 0 ? (
            <div className="flex items-center gap-2.5 text-emerald-600 py-1">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <p className="text-sm font-medium">All caught up — nothing pending</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingApprovals.length > 0 && (
                <button
                  onClick={() => navigate("/monthly")}
                  className="w-full flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-left"
                >
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {pendingApprovals.length} report{pendingApprovals.length !== 1 ? "s" : ""} to approve
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">Tap to review →</p>
                  </div>
                </button>
              )}

              {payrollPendingCount > 0 && (
                <button
                  onClick={() => navigate("/monthly")}
                  className="w-full flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-left"
                >
                  <Banknote className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {payrollPendingCount} payroll record{payrollPendingCount !== 1 ? "s" : ""} to approve
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">Tap to review →</p>
                  </div>
                </button>
              )}

              {daysUntilDue <= 7 && (
                <div className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border",
                  daysUntilDue <= 3 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                )}>
                  <AlertCircle className={cn(
                    "w-4 h-4 mt-0.5 shrink-0",
                    daysUntilDue <= 3 ? "text-red-500" : "text-amber-500"
                  )} />
                  <div>
                    <p className={cn(
                      "text-sm font-semibold",
                      daysUntilDue <= 3 ? "text-red-800" : "text-amber-800"
                    )}>
                      FK 3057 due in {daysUntilDue} day{daysUntilDue !== 1 ? "s" : ""}
                    </p>
                    <p className={cn(
                      "text-xs mt-0.5",
                      daysUntilDue <= 3 ? "text-red-600" : "text-amber-600"
                    )}>
                      {MONTHS[invoiceMonthIdx]} invoice due {dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FK invoice section */}
          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                FK invoice — {MONTHS[invoiceMonthIdx]}
              </p>
              {invoiceEntries.length > 0 && (
                <Badge variant={invoiceIsReady ? "success" : "warning"}>
                  {invoiceIsReady ? "Ready" : `${invoicePending} pending`}
                </Badge>
              )}
            </div>

            <p className="text-2xl font-mono font-bold text-primary mb-1">
              {invoiceHours}h
              <span className="text-xs font-normal text-muted-foreground ml-1">approved for FK</span>
            </p>

            {invoiceTotalHrs > 0 && (
              <div className="space-y-1 mb-3">
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (invoiceHours / invoiceTotalHrs) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {invoiceReady.length} of {invoiceEntries.length} reports approved
                </p>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => fkDownload.mutate()}
              disabled={fkDownload.isPending || fkGated}
              title={fkGated ? "Approve all reports and payroll first" : undefined}
            >
              <FileDown className="w-3.5 h-3.5" />
              {fkDownload.isPending ? "Generating…" : "Download FK 3057"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Due {dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "long" })} · {daysUntilDue} days
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Add shift dialog ────────────────────────────────── */}
      <Dialog open={addShiftDate !== null} onOpenChange={(open) => { if (!open) { setAddShiftDate(null); setShiftForm({ assistantId: "", startTime: "08:00", endTime: "16:00" }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add shift</DialogTitle>
            <DialogDescription>
              {addShiftDate && new Date(addShiftDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <p className="text-sm font-medium mb-1.5">Assistant</p>
              <Select value={shiftForm.assistantId} onValueChange={(v) => setShiftForm(f => ({ ...f, assistantId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select assistant" /></SelectTrigger>
                <SelectContent>
                  {(assistants as Assistant[]).map(a => (
                    <SelectItem key={a.id as string} value={a.id as string}>{a.name as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm font-medium mb-1.5">Start</p>
                <input type="time" value={shiftForm.startTime} onChange={e => setShiftForm(f => ({ ...f, startTime: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1.5">End</p>
                <input type="time" value={shiftForm.endTime} onChange={e => setShiftForm(f => ({ ...f, endTime: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                disabled={!shiftForm.assistantId || addEntry.isPending}
                onClick={() => {
                  if (!addShiftDate || !shiftForm.assistantId) return;
                  const [sh, sm] = shiftForm.startTime.split(":").map(Number);
                  const [eh, em] = shiftForm.endTime.split(":").map(Number);
                  const hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
                  addEntry.mutate({ assistantId: shiftForm.assistantId, date: addShiftDate, startTime: shiftForm.startTime, endTime: shiftForm.endTime, hours, reqStatus: "approved", repStatus: "draft", source: "proposal" });
                }}
              >
                {addEntry.isPending ? "Saving…" : "Add shift"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setAddShiftDate(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Mark absent dialog ──────────────────────────────── */}
      <Dialog
        open={markAbsentEntry !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMarkAbsentEntry(null);
            setAbsenceType("sjukfrånvaro");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark {markAbsentEntry?.assistantName} as absent?
            </DialogTitle>
            <DialogDescription>
              {markAbsentEntry?.date && (
                <>Date: {new Date(markAbsentEntry.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div>
              <p className="text-sm font-medium mb-1.5">Absence type</p>
              <Select value={absenceType} onValueChange={setAbsenceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ABSENCE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                onClick={() => markAbsentEntry && markAbsent.mutate(markAbsentEntry)}
                disabled={markAbsent.isPending}
              >
                {markAbsent.isPending ? "Saving…" : "Confirm"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setMarkAbsentEntry(null);
                  setAbsenceType("sjukfrånvaro");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
