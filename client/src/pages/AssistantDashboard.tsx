import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { assistantSelfApi, clockApi, guardianLinksApi, pdfApi } from "@/lib/api";
import type { GuardianLink, PaymentSlipListRow } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/inputs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/controls";
import { ActivityPill, EmptyState } from "@/components/shared";
import { formatDate, formatDateLong, getWeekDates } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { LogOut, ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";

// ── v1.0.1 Phase 9 (SLIP-02) — Lönespec helpers ──────────────────────────
/** "2026-03" → "Mars 2026" (Swedish, capitalised first letter) */
function formatMonthSv(reportMonth: string): string {
  const [y, m] = reportMonth.split("-").map((n) => parseInt(n, 10));
  const d = new Date(y, m - 1, 1);
  const raw = format(d, "MMMM yyyy", { locale: sv });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** ISO 8601 → "5 apr 2026" (sv-SE short date) */
function formatShortDateSv(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy", { locale: sv });
}

async function downloadMyLonespec(reportMonth: string) {
  try {
    const res = await pdfApi.lonespecMe(reportMonth);
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lonespec-${reportMonth}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err: unknown) {
    let message = "Kunde inte generera lönespecifikation. Försök igen.";
    try {
      const e = err as { response?: { status?: number; data?: Blob } };
      const status = e?.response?.status;
      const blob = e?.response?.data;
      const text = blob ? await blob.text() : null;
      const parsed = text ? (JSON.parse(text) as { error?: string }) : null;
      if (status === 409) message = "Lönekörningen är inte godkänd för denna månad.";
      else if (status === 400 && parsed?.error) message = parsed.error;
    } catch {
      /* fall through to generic */
    }
    alert(message);
  }
}

type Entry = Record<string, string | number | null | undefined>;

export default function AssistantDashboard() {
  const logout        = useAuthStore((s) => s.logout);
  const isDualRole    = useAuthStore((s) => s.isDualRole);
  const setActiveView = useAuthStore((s) => s.setActiveView);
  const navigate      = useNavigate();
  const qc       = useQueryClient();

  const [tab, setTab]           = useState("upcoming");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedGuardianId, setSelectedGuardianId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem("kalinga_selected_guardian_id");
    return saved ? parseInt(saved, 10) : null;
  });
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  const [clockOutTime, setClockOutTime]               = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds]           = useState(0);

  // ── Queries ──────────────────────────────────────────────────
  const { data: me } = useQuery({
    queryKey: ["assistant-me"],
    queryFn: () => assistantSelfApi.me().then((r) => r.data),
  });

  const { data: families = [] } = useQuery<GuardianLink[]>({
    queryKey: ["my-families"],
    queryFn: () => guardianLinksApi.myFamilies().then((r) => r.data),
  });

  const { data: entries = [] } = useQuery<Entry[]>({
    queryKey: ["assistant-entries"],
    queryFn: () => assistantSelfApi.entries().then((r) => r.data),
  });

  // GCal schedule: fetch a 4-week window centred on current weekOffset
  const scheduleStart = (() => {
    const d = new Date(); d.setDate(d.getDate() + weekOffset * 7 - 7); return d.toISOString().split("T")[0];
  })();
  const scheduleEnd = (() => {
    const d = new Date(); d.setDate(d.getDate() + weekOffset * 7 + 21); return d.toISOString().split("T")[0];
  })();
  type GCalEvent = Record<string, unknown>;
  const { data: gcalEvents = [] } = useQuery<GCalEvent[]>({
    queryKey: ["assistant-schedule", scheduleStart, scheduleEnd],
    queryFn:  () => assistantSelfApi.schedule(scheduleStart, scheduleEnd).then((r) => r.data as GCalEvent[]),
    staleTime: 2 * 60 * 1000,
  });

  function parseGcalEvent(ev: GCalEvent) {
    const startDT = ((ev.start as Record<string, string>)?.dateTime ?? (ev.start as Record<string, string>)?.date ?? "");
    const endDT   = ((ev.end   as Record<string, string>)?.dateTime ?? (ev.end   as Record<string, string>)?.date ?? "");
    if (!startDT) return null;
    const date      = startDT.substring(0, 10);
    const startTime = startDT.length > 10 ? startDT.substring(11, 16) : "00:00";
    const endTime   = endDT.length  > 10 ? endDT.substring(11, 16)   : "00:00";
    const [sh, sm]  = startTime.split(":").map(Number);
    const [eh, em]  = endTime.split(":").map(Number);
    const hours     = Math.max(0, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 4) / 4);
    return { date, startTime, endTime, hours, summary: (ev.summary as string) ?? "Shift" };
  }
  const parsedSchedule = gcalEvents.map(parseGcalEvent).filter(Boolean) as NonNullable<ReturnType<typeof parseGcalEvent>>[];

  const { data: clockStatus, refetch: refetchClockStatus } = useQuery({
    queryKey: ["clock-status", selectedGuardianId],
    queryFn: () => clockApi.status(selectedGuardianId!).then((r) => r.data),
    enabled: !!selectedGuardianId,
    refetchInterval: 30_000,
  });

  // v1.0.1 Phase 9 (SLIP-02) — assistant's issued salary slips
  const slipsQuery = useQuery<PaymentSlipListRow[]>({
    queryKey: ["assistant", "slips"],
    queryFn: () => assistantSelfApi.slips().then((r) => r.data),
  });

  // ── Family selection logic ────────────────────────────────────
  useEffect(() => {
    if (families.length > 0 && !selectedGuardianId) {
      const first = families[0].guardianId;
      setSelectedGuardianId(first);
      sessionStorage.setItem("kalinga_selected_guardian_id", String(first));
    }
  }, [families, selectedGuardianId]);

  // Fall back to me.guardianId if no families from API (single-tenant legacy path)
  const effectiveGuardianId =
    selectedGuardianId ??
    ((me as Record<string, unknown>)?.guardianId as number | undefined) ??
    null;

  // ── Live timer ───────────────────────────────────────────────
  useEffect(() => {
    if (clockStatus?.state !== "clocked_in" || !clockStatus.activeEvent) {
      setElapsedSeconds(0);
      return;
    }
    const startTime = new Date(clockStatus.activeEvent.timestamp as string).getTime();
    const interval  = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [clockStatus]);

  function formatElapsed(s: number): string {
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  // ── Mutations ────────────────────────────────────────────────
  const clockIn = useMutation({
    mutationFn: () => clockApi.clockIn(effectiveGuardianId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clock-status"] });
      void refetchClockStatus();
    },
  });

  const clockOut = useMutation({
    mutationFn: () => clockApi.clockOut(effectiveGuardianId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clock-status"] });
      qc.invalidateQueries({ queryKey: ["assistant-entries"] });
      void refetchClockStatus();
      setShowClockOutConfirm(false);
    },
  });

  // ── Derived state ────────────────────────────────────────────
  const todayStr  = new Date().toISOString().split("T")[0];
  const weekDates = getWeekDates(weekOffset);

  // Schedule (from GCal) — used for Today's shift, week strip, Upcoming tab
  const todayShift    = parsedSchedule.find((e) => e.date === todayStr) ?? null;
  const thisWeekShifts = parsedSchedule.filter((e) => weekDates.includes(e.date));
  const weekHours      = thisWeekShifts.reduce((s, e) => s + e.hours, 0);
  const next7Days      = parsedSchedule
    .filter((e) => {
      const d     = new Date(e.date);
      const start = new Date(todayStr);
      const limit = new Date(todayStr);
      limit.setDate(limit.getDate() + 7);
      return d >= start && d <= limit;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/30">

      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Assistansportal</p>
            {me?.assistant && (
              <p className="text-xs text-muted-foreground">
                {(me.assistant as Record<string, unknown>).name as string} · Assisting {me.patientName as string}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Family selector — only shown when assistant has ≥2 active families */}
          {families.length >= 2 && (
            <select
              value={selectedGuardianId ?? ""}
              onChange={(e) => {
                const gid = parseInt(e.target.value, 10);
                setSelectedGuardianId(gid);
                sessionStorage.setItem("kalinga_selected_guardian_id", String(gid));
              }}
              className="text-sm border border-border rounded-lg px-2 py-1 bg-background"
            >
              {families.map((f) => (
                <option key={f.guardianId} value={f.guardianId}>
                  Family {f.guardianId}
                </option>
              ))}
            </select>
          )}

          {isDualRole() && (
            <button
              onClick={() => { setActiveView("guardian"); navigate("/home"); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              ← Guardian view
            </button>
          )}
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />Log out
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Clock-in/out hero card */}
        <Card>
          <CardContent className="pt-6 pb-5">
            {clockStatus?.state === "clocked_in" ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-3">
                  CLOCKED IN
                </p>
                <div className="space-y-1 mb-4">
                  {clockStatus.activeEvent && (
                    <p className="text-sm text-muted-foreground">
                      Started:{" "}
                      {new Date(clockStatus.activeEvent.timestamp as string).toLocaleTimeString(
                        "sv-SE",
                        { hour: "2-digit", minute: "2-digit" }
                      )}
                    </p>
                  )}
                  <p className="font-mono text-3xl font-bold text-foreground">
                    {formatElapsed(elapsedSeconds)}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  className="w-full"
                  size="lg"
                  onClick={() => {
                    setClockOutTime(
                      new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
                    );
                    setShowClockOutConfirm(true);
                  }}
                >
                  Clock out
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  CLOCKED OUT
                </p>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!effectiveGuardianId || clockIn.isPending}
                  onClick={() => clockIn.mutate()}
                >
                  Clock in
                </Button>
                {(() => {
                  const last = (entries as Entry[])
                    .slice()
                    .sort((a, b) => (b.date as string).localeCompare(a.date as string))[0];
                  if (!last) return null;
                  return (
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Last shift: {last.date as string}, {last.hours as number}h
                    </p>
                  );
                })()}
              </>
            )}
          </CardContent>
        </Card>

        {/* Today's scheduled shift */}
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Today's shift
            </p>
            {todayShift ? (
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">{todayShift.summary}</p>
                <p className="font-mono text-sm text-foreground">
                  {todayShift.startTime} – {todayShift.endTime}
                  <span className="text-muted-foreground ml-2">{todayShift.hours}h</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No shift scheduled today</p>
            )}
          </CardContent>
        </Card>

        {/* Week strip */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((w) => w - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium px-1">
                  {weekOffset === 0
                    ? "This week"
                    : weekOffset === -1
                    ? "Last week"
                    : weekOffset === 1
                    ? "Next week"
                    : formatDate(weekDates[0])}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((w) => w + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-bold text-primary">{weekHours.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">this week</p>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDates.map((date) => {
                const dayShifts = thisWeekShifts.filter((e) => e.date === date);
                const isToday   = date === todayStr;
                const dayHours  = dayShifts.reduce((s, e) => s + e.hours, 0);
                return (
                  <div
                    key={date}
                    className={cn(
                      "rounded-lg p-2 text-center space-y-1",
                      isToday ? "bg-primary/10 ring-1 ring-primary/30" : "bg-white border border-border",
                      dayShifts.length === 0 && "opacity-40"
                    )}
                  >
                    <p className={cn("text-[10px] font-medium uppercase", isToday ? "text-primary" : "text-muted-foreground")}>
                      {new Date(date).toLocaleDateString("en-GB", { weekday: "short" })}
                    </p>
                    <p className={cn("text-sm font-bold", isToday ? "text-primary" : "text-foreground")}>
                      {new Date(date).getDate()}
                    </p>
                    {dayHours > 0 ? (
                      <p className="text-[10px] font-mono text-emerald-600">{dayHours}h</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">—</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Upcoming | Reports */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
            <TabsTrigger value="reports" className="flex-1">Reports</TabsTrigger>
          </TabsList>

          {/* Upcoming — next 7 days from GCal schedule */}
          <TabsContent value="upcoming">
            {next7Days.length === 0 ? (
              <EmptyState message="No shifts in the next 7 days" />
            ) : (
              <div className="space-y-2 mt-2">
                {next7Days.map((shift, idx) => {
                  const isToday = shift.date === todayStr;
                  return (
                    <Card key={`${shift.date}-${idx}`} className={isToday ? "ring-1 ring-primary/30" : ""}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              {isToday && <Badge variant="info" className="text-[10px]">Today</Badge>}
                              <p className="text-sm font-semibold text-foreground">{formatDateLong(shift.date)}</p>
                            </div>
                            <p className="font-mono text-lg font-bold text-foreground">
                              {shift.startTime} – {shift.endTime}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{shift.summary}</span>
                              <span className="text-xs text-muted-foreground">{shift.hours}h</span>
                            </div>
                          </div>
                          <Badge variant="success">✓ Scheduled</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Reports — auto-created entries, read-only, no Submit button */}
          <TabsContent value="reports">
            {(entries as Entry[]).length === 0 ? (
              <EmptyState message="No reports yet. Reports appear here after you clock out." />
            ) : (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-muted-foreground">
                  Shift reports are created when you clock out. Your guardian approves them.
                </p>
                {(entries as Entry[])
                  .slice()
                  .sort((a, b) => (b.date as string).localeCompare(a.date as string))
                  .map((e) => (
                    <Card key={e.id as string}>
                      <CardContent className="py-3.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{formatDate(e.date as string)}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {(e.startTime ?? e.start_time) as string} – {(e.endTime ?? e.end_time) as string} · {e.hours as number}h
                          </p>
                        </div>
                        <div>
                          {(e.repStatus ?? e.rep_status) === "approved" && <Badge variant="success">Approved</Badge>}
                          {(e.repStatus ?? e.rep_status) === "pending"  && <Badge variant="warning">Pending</Badge>}
                          {(e.repStatus ?? e.rep_status) === "draft"    && <Badge variant="secondary">Draft</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Lönespecifikationer (v1.0.1 Phase 9 / SLIP-02) ──────────────── */}
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
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-muted animate-pulse h-14 rounded-md" />
                ))}
              </div>
            ) : slipsQuery.isError ? (
              <p className="text-sm text-destructive">
                Kunde inte hämta lönespecifikationer. Försök ladda om sidan.
              </p>
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
                {slipsQuery.data!.map((slip) => (
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

      </div>

      {/* Clock-out confirmation dialog */}
      {showClockOutConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-lg font-semibold">End shift?</h2>
              <p className="text-sm text-muted-foreground">
                {clockStatus?.activeEvent &&
                  new Date(clockStatus.activeEvent.timestamp as string).toLocaleTimeString(
                    "sv-SE",
                    { hour: "2-digit", minute: "2-digit" }
                  )}{" "}
                – {clockOutTime} · {formatElapsed(elapsedSeconds)}.
                This will create a shift report.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowClockOutConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={clockOut.isPending}
                  onClick={() => clockOut.mutate()}
                >
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
