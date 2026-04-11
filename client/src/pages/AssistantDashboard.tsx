import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { assistantSelfApi, clockApi, guardianLinksApi } from "@/lib/api";
import type { GuardianLink } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/inputs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/controls";
import { ActivityPill, EmptyState } from "@/components/shared";
import { formatDate, formatDateLong, getWeekDates } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";

type Entry = Record<string, string | number | null | undefined>;

export default function AssistantDashboard() {
  const logout   = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
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

  const { data: clockStatus, refetch: refetchClockStatus } = useQuery({
    queryKey: ["clock-status", selectedGuardianId],
    queryFn: () => clockApi.status(selectedGuardianId!).then((r) => r.data),
    enabled: !!selectedGuardianId,
    refetchInterval: 30_000,
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

  const upcoming = (entries as Entry[])
    .filter((e) => (e.date as string) >= todayStr && e.req_status !== "rejected")
    .sort((a, b) => (a.date as string).localeCompare(b.date as string));

  const thisWeek = (entries as Entry[]).filter(
    (e) => weekDates.includes(e.date as string) && e.req_status !== "rejected"
  );
  const weekHours = thisWeek.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);

  const next7Days = upcoming.filter((e) => {
    const d = new Date(e.date as string);
    const limit = new Date(todayStr);
    limit.setDate(limit.getDate() + 7);
    return d <= limit;
  });

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
        {(() => {
          const todayEntry = (entries as Entry[]).find((e) => e.date === todayStr);
          return (
            <Card>
              <CardContent className="py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Today's shift
                </p>
                {todayEntry ? (
                  <p className="text-sm font-medium">
                    {todayEntry.start_time as string} – {todayEntry.end_time as string}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No shift scheduled today</p>
                )}
              </CardContent>
            </Card>
          );
        })()}

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
                const dayEntries = thisWeek.filter((e) => e.date === date);
                const isToday    = date === todayStr;
                const dayHours   = dayEntries.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
                return (
                  <div
                    key={date}
                    className={cn(
                      "rounded-lg p-2 text-center space-y-1",
                      isToday ? "bg-primary/10 ring-1 ring-primary/30" : "bg-white border border-border",
                      dayEntries.length === 0 && "opacity-40"
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

          {/* Upcoming — next 7 days */}
          <TabsContent value="upcoming">
            {next7Days.length === 0 ? (
              <EmptyState message="No shifts in the next 7 days" />
            ) : (
              <div className="space-y-2 mt-2">
                {next7Days.map((e) => {
                  const isToday = e.date === todayStr;
                  return (
                    <Card key={e.id as string} className={isToday ? "ring-1 ring-primary/30" : ""}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              {isToday && <Badge variant="info" className="text-[10px]">Today</Badge>}
                              <p className="text-sm font-semibold text-foreground">{formatDateLong(e.date as string)}</p>
                            </div>
                            <p className="font-mono text-lg font-bold text-foreground">
                              {e.start_time as string} – {e.end_time as string}
                            </p>
                            <div className="flex items-center gap-2">
                              <ActivityPill activityId={e.activity_id as string} />
                              <span className="text-xs text-muted-foreground">{e.hours as number}h</span>
                            </div>
                          </div>
                          <div>
                            {e.req_status === "pending"  && <Badge variant="warning">Pending</Badge>}
                            {e.req_status === "approved" && <Badge variant="success">✓ Confirmed</Badge>}
                          </div>
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
                            {e.start_time as string} – {e.end_time as string} · {e.hours as number}h
                          </p>
                        </div>
                        <div>
                          {e.rep_status === "approved" && <Badge variant="success">Approved</Badge>}
                          {e.rep_status === "pending"  && <Badge variant="warning">Pending</Badge>}
                          {e.rep_status === "draft"    && <Badge variant="secondary">Draft</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

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
