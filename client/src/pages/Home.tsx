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
import { PageHeader, AssistantAvatar, EmptyState } from "@/components/shared";
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
  ChevronRight,
  AlertCircle,
  Banknote,
  Plus,
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

  // Schedule driven by Google Calendar events (source of truth)
  function gcalEventDate(ev: Record<string, unknown>): string {
    const dt = ((ev.start as Record<string, string>)?.dateTime ?? (ev.start as Record<string, string>)?.date ?? "");
    return dt.substring(0, 10);
  }
  function gcalEventHours(ev: Record<string, unknown>): number {
    const s = ((ev.start as Record<string, string>)?.dateTime ?? "");
    const e = ((ev.end   as Record<string, string>)?.dateTime ?? "");
    if (!s || !e) return 0;
    return parseFloat(((new Date(e).getTime() - new Date(s).getTime()) / 3_600_000).toFixed(1));
  }

  const byDay = weekDates.map((date, i) => {
    const dayGcal      = (gcalEvents as Record<string, unknown>[]).filter(ev => gcalEventDate(ev) === date);
    const totalHours   = dayGcal.reduce((s, ev) => s + gcalEventHours(ev), 0);
    const eventTitles  = dayGcal.map(ev => (ev.summary as string) ?? "Event").slice(0, 2);
    return { date, dayName: DAY_NAMES[i], totalHours, eventCount: dayGcal.length, eventTitles };
  });

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
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-semibold">
              {weekOffset === 0 ? "This week's schedule" : (() => {
                const first = new Date(weekDates[0] + "T12:00:00");
                const last  = new Date(weekDates[6] + "T12:00:00");
                const fmt   = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
                return `${fmt.format(first)} – ${fmt.format(last)}`;
              })()}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekOffset(o => Math.max(o - 1, -12))}
                disabled={weekOffset <= -12}
                className="text-xs px-2"
              >
                ← Prev
              </Button>
              {weekOffset !== 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekOffset(0)}
                  className="text-xs px-2"
                >
                  Today
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekOffset(o => o + 1)}
                className="text-xs px-2"
              >
                Next →
              </Button>
            </div>
          </div>

          {/* 7-column grid */}
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mb-2">
            {byDay.map(({ date, dayName, eventCount, totalHours, eventTitles }) => {
              const isToday = date === todayStr;
              const isEmpty = eventCount === 0;
              return (
                <div
                  key={date}
                  className={cn(
                    "rounded-xl p-2 text-center border transition-all",
                    isToday
                      ? "border-primary/40 bg-primary/8 ring-1 ring-primary/20"
                      : isEmpty
                        ? "border-border bg-secondary/20 opacity-40"
                        : "border-border bg-secondary/20",
                  )}
                >
                  <p className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide mb-1",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}>
                    {dayName}
                  </p>
                  <p className={cn(
                    "text-xs font-mono mb-2",
                    isToday ? "text-primary font-bold" : "text-muted-foreground"
                  )}>
                    {new Date(date + "T12:00:00").getDate()}
                  </p>

                  {isEmpty ? (
                    <div className="h-7 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground/20">
                        <Plus className="w-3 h-3" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-0.5 mb-1">
                        {eventTitles.map((title, idx) => (
                          <p key={idx} className="text-[9px] text-blue-700 font-medium truncate leading-tight">{title}</p>
                        ))}
                        {eventCount > 2 && (
                          <p className="text-[9px] text-muted-foreground">+{eventCount - 2} more</p>
                        )}
                      </div>
                      <p className="text-xs font-mono font-semibold text-foreground mb-1.5">
                        {totalHours > 0 ? `${totalHours}h` : `${eventCount} event${eventCount !== 1 ? "s" : ""}`}
                      </p>
                      {gcalConnected && (
                        <button
                          onClick={() => {
                            const firstAsst = (assistants as Assistant[])[0];
                            if (!firstAsst) return;
                            setMarkAbsentEntry({
                              assistantId:   firstAsst.id   as string,
                              assistantName: firstAsst.name as string,
                              date,
                            });
                          }}
                          className="text-[9px] text-muted-foreground hover:text-foreground underline transition-colors"
                        >
                          Mark absent
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
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
