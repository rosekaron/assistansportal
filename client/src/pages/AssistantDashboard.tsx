import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { assistantSelfApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/inputs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/controls";
import { ActivityPill, EmptyState, FillBar } from "@/components/shared";
import { activityById } from "@/lib/activities";
import { formatDate, formatDateLong } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { LogOut, CheckCircle, CalendarDays, Timer, TimerOff } from "lucide-react";

type Entry = Record<string, string | number | null | undefined>;
type Slot  = Record<string, string | number | null | undefined>;

function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso as string).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function ClockButton({ entry, onClockIn, onClockOut, isLoading }: {
  entry: Entry;
  onClockIn: () => void;
  onClockOut: () => void;
  isLoading: boolean;
}) {
  const clockedIn  = !!entry.clockedInAt;
  const clockedOut = !!entry.clockedOutAt;

  if (clockedOut) {
    return (
      <div className="text-center space-y-1 py-2">
        <p className="text-xs text-muted-foreground">Clocked out</p>
        <p className="font-mono text-lg font-bold text-emerald-400">{entry.actualHours}h recorded</p>
        <p className="text-xs text-muted-foreground">
          {formatTime(entry.clockedInAt as string)} – {formatTime(entry.clockedOutAt as string)}
        </p>
      </div>
    );
  }

  if (clockedIn) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground text-center">
          Clocked in at {formatTime(entry.clockedInAt as string)}
        </p>
        <Button
          className="w-full h-14 text-base font-semibold bg-red-600 hover:bg-red-700 text-white"
          disabled={isLoading}
          onClick={onClockOut}
        >
          <TimerOff className="w-5 h-5 mr-2" />
          Clock out
        </Button>
      </div>
    );
  }

  return (
    <Button
      className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
      disabled={isLoading}
      onClick={onClockIn}
    >
      <Timer className="w-5 h-5 mr-2" />
      Clock in
    </Button>
  );
}

export default function AssistantDashboard() {
  const logout   = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const [tab, setTab] = useState("upcoming");

  const { data: me }           = useQuery({ queryKey: ["assistant-me"],      queryFn: () => assistantSelfApi.me().then((r) => r.data) });
  const { data: entries = [] } = useQuery({ queryKey: ["assistant-entries"], queryFn: () => assistantSelfApi.entries().then((r) => r.data) });
  const { data: slots = [] }   = useQuery({ queryKey: ["assistant-slots"],   queryFn: () => assistantSelfApi.openSlots().then((r) => r.data) });

  const todayStr = new Date().toISOString().split("T")[0];

  // Today's confirmed shifts
  const todayEntries = (entries as Entry[])
    .filter((e) => e.date === todayStr && e.reqStatus === "approved")
    .sort((a, b) => (a.startTime as string).localeCompare(b.startTime as string));

  // Next 7 days (excluding today)
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const in7DaysStr = in7Days.toISOString().split("T")[0];
  const upcoming = (entries as Entry[])
    .filter((e) => (e.date as string) > todayStr && (e.date as string) <= in7DaysStr && e.reqStatus !== "rejected")
    .sort((a, b) => (a.date as string).localeCompare(b.date as string));

  const pending     = (entries as Entry[]).filter((e) => e.reqStatus === "pending");
  const approved    = (entries as Entry[]).filter((e) => e.reqStatus === "approved");
  const needsReport = [] as Entry[]; // clock-out now auto-submits — no manual step needed

  // Weekly hours (Mon–Sun of current week)
  const today     = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0
  const monday    = new Date(today); monday.setDate(today.getDate() - dayOfWeek);
  const sunday    = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const monStr    = monday.toISOString().split("T")[0];
  const sunStr    = sunday.toISOString().split("T")[0];
  const weekHours = (entries as Entry[])
    .filter((e) => (e.date as string) >= monStr && (e.date as string) <= sunStr && e.reqStatus !== "rejected")
    .reduce((s, e) => s + ((e.hours as number) ?? 0), 0);

  const clockIn = useMutation({
    mutationFn: (id: string) => assistantSelfApi.clockIn(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant-entries"] }),
  });
  const clockOut = useMutation({
    mutationFn: (id: string) => assistantSelfApi.clockOut(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant-entries"] }),
  });
  const accept = useMutation({
    mutationFn: (id: string) => assistantSelfApi.accept(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant-entries"] }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => assistantSelfApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant-entries"] }),
  });
  const selfBook = useMutation({
    mutationFn: (slotId: string) => assistantSelfApi.selfBook(slotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant-entries"] });
      qc.invalidateQueries({ queryKey: ["assistant-slots"] });
    },
  });

  const isClockLoading = clockIn.isPending || clockOut.isPending;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-sm font-semibold">
            {me?.assistant?.name ?? "Assistant"}
          </p>
          {me?.patientName && (
            <p className="text-xs text-muted-foreground">Assisting {me.patientName}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {pending.length > 0 && (
            <button onClick={() => setTab("proposals")}
              className="text-xs text-amber-400 font-medium">{pending.length} proposals</button>
          )}
          <button onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Today section */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Today</h2>
            <span className="text-xs text-muted-foreground font-mono">{weekHours.toFixed(1)}h this week</span>
          </div>

          {todayEntries.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No shifts today</p>
                {upcoming.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Next: {formatDateLong(upcoming[0].date as string)} at {upcoming[0].start_time}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {todayEntries.map((e) => (
                <Card key={e.id as string} className="ring-1 ring-primary/30">
                  <CardContent className="py-4 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-mono text-2xl font-bold">{e.startTime} – {e.endTime}</p>
                        <div className="flex items-center gap-2">
                          <ActivityPill activityId={e.activityId as string} />
                          <span className="text-xs text-muted-foreground">{e.hours}h planned</span>
                        </div>
                      </div>
                      <Badge variant="success">Today</Badge>
                    </div>
                    <ClockButton
                      entry={e}
                      onClockIn={() => clockIn.mutate(e.id as string)}
                      onClockOut={() => clockOut.mutate(e.id as string)}
                      isLoading={isClockLoading}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Next 7 days */}
        {upcoming.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2">Next 7 days</h2>
            <div className="space-y-2">
              {upcoming.map((e) => (
                <Card key={e.id as string}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{formatDateLong(e.date as string)}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{e.startTime} – {e.endTime}</span>
                        <span>{e.hours}h</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ActivityPill activityId={e.activityId as string} size="sm" />
                      {e.reqStatus === "pending" && <Badge variant="warning">Pending</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Action banners */}
        {(pending.length > 0 || needsReport.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {pending.length > 0 && (
              <button onClick={() => setTab("proposals")}
                className="text-left bg-card border border-amber-300 rounded-xl p-3.5 hover:border-amber-500 transition-colors">
                <p className="text-xs text-muted-foreground">Proposals</p>
                <p className="font-mono text-2xl font-bold text-amber-600">{pending.length}</p>
                <p className="text-xs text-amber-600 font-medium mt-0.5">Tap to review →</p>
              </button>
            )}
            {needsReport.length > 0 && (
              <button onClick={() => setTab("reports")}
                className="text-left bg-card border border-blue-300 rounded-xl p-3.5 hover:border-blue-500 transition-colors">
                <p className="text-xs text-muted-foreground">Reports due</p>
                <p className="font-mono text-2xl font-bold text-blue-600">{needsReport.length}</p>
                <p className="text-xs text-blue-600 font-medium mt-0.5">Submit hours →</p>
              </button>
            )}
          </div>
        )}

        {/* Tabs: Proposals / Reports / Open Slots */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="proposals" className="flex-1">
              Proposals {pending.length > 0 && (
                <span className="ml-1 text-[10px] bg-amber-900 text-amber-400 rounded-full px-1.5">{pending.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-1">Reports</TabsTrigger>
            <TabsTrigger value="slots" className="flex-1">Open slots</TabsTrigger>
          </TabsList>

          {/* Proposals */}
          <TabsContent value="proposals">
            {pending.length === 0
              ? <EmptyState message="No pending proposals right now" />
              : (
                <div className="space-y-3 mt-2">
                  {pending.map((e) => {
                    const act = activityById(e.activityId as string);
                    return (
                      <Card key={e.id as string}>
                        <CardContent className="py-4 space-y-3">
                          <div>
                            <p className="text-sm font-medium">{formatDateLong(e.date as string)}</p>
                            <p className="font-mono text-xl font-bold mt-0.5">{e.startTime} – {e.endTime}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <ActivityPill activityId={e.activityId as string} />
                              <span className="text-xs text-muted-foreground">{e.hours}h</span>
                            </div>
                          </div>
                          <div className="text-xs p-2.5 rounded-lg font-medium" style={{ background: act.color + "18", color: act.color }}>
                            {act.icon} {act.desc}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="approve" className="flex-1" disabled={accept.isPending}
                              onClick={() => accept.mutate(e.id as string)}>
                              <CheckCircle className="w-3.5 h-3.5" />Accept shift
                            </Button>
                            <Button variant="reject" disabled={reject.isPending}
                              onClick={() => reject.mutate(e.id as string)}>
                              Decline
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
          </TabsContent>

          {/* Reports */}
          <TabsContent value="reports">
            {approved.length === 0
              ? <EmptyState message="No completed shifts yet" />
              : (
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-muted-foreground">Your completed shifts. Guardian reviews and approves them after you clock out.</p>
                  {approved.sort((a, b) => (b.date as string).localeCompare(a.date as string)).map((e) => (
                    <Card key={e.id as string}>
                      <CardContent className="py-3.5 flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{formatDate(e.date as string)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{e.startTime} – {e.endTime}</span>
                            <span>{e.actualHours ? `${e.actualHours}h actual` : `${e.hours}h planned`}</span>
                          </div>
                          <ActivityPill activityId={e.activityId as string} size="sm" />
                        </div>
                        <div className="flex items-center gap-2">
                          {e.repStatus === "approved" && <Badge variant="success">✓ Approved</Badge>}
                          {e.repStatus === "pending"  && <Badge variant="warning">Under review</Badge>}
                          {e.repStatus === "draft"    && <Badge variant="default">Not clocked out</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
          </TabsContent>

          {/* Open slots */}
          <TabsContent value="slots">
            {(slots as Slot[]).length === 0
              ? <EmptyState message="No open slots available right now" />
              : (
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-muted-foreground mb-3">Available shifts you can claim directly.</p>
                  {(slots as Slot[]).map((slot) => {
                    const act = activityById(slot.activityId as string);
                    return (
                      <Card key={slot.id as string}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1.5">
                              <p className="text-sm font-medium">{formatDateLong(slot.date as string)}</p>
                              <p className="font-mono text-lg font-semibold">{slot.startTime} – {slot.endTime}</p>
                              <div className="flex items-center gap-2">
                                <ActivityPill activityId={slot.activityId as string} />
                                <span className="text-xs text-muted-foreground">{slot.hours}h</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{act.desc}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <FillBar filled={(slot.filled as number) ?? 0} capacity={(slot.capacity as number) ?? 1} />
                              <Button size="sm" variant="outline" disabled={selfBook.isPending}
                                onClick={() => selfBook.mutate(slot.id as string)}>
                                <CalendarDays className="w-3.5 h-3.5" />Book shift
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
