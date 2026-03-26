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
import { formatDate, formatDateLong, getWeekDates } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { LogOut, ChevronLeft, ChevronRight, CheckCircle, FileText, CalendarDays } from "lucide-react";

type Entry = Record<string, string | number | null | undefined>;
type Slot  = Record<string, string | number | null | undefined>;

export default function AssistantDashboard() {
  const logout   = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const [tab, setTab]           = useState("upcoming");
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: me }           = useQuery({ queryKey: ["assistant-me"],      queryFn: () => assistantSelfApi.me().then((r) => r.data) });
  const { data: entries = [] } = useQuery({ queryKey: ["assistant-entries"], queryFn: () => assistantSelfApi.entries().then((r) => r.data) });
  const { data: slots = [] }   = useQuery({ queryKey: ["assistant-slots"],   queryFn: () => assistantSelfApi.openSlots().then((r) => r.data) });

  const todayStr  = new Date().toISOString().split("T")[0];
  const weekDates = getWeekDates(weekOffset);

  const upcoming    = (entries as Entry[]).filter((e) => (e.date as string) >= todayStr && e.req_status !== "rejected").sort((a, b) => (a.date as string).localeCompare(b.date as string));
  const pending     = (entries as Entry[]).filter((e) => e.req_status === "pending");
  const approved    = (entries as Entry[]).filter((e) => e.req_status === "approved");
  const needsReport = (entries as Entry[]).filter((e) => e.req_status === "approved" && e.rep_status === "draft");
  const thisWeek    = (entries as Entry[]).filter((e) => weekDates.includes(e.date as string) && e.req_status !== "rejected");
  const weekHours   = thisWeek.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);

  const accept = useMutation({
    mutationFn: (id: string) => assistantSelfApi.accept(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant-entries"] }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => assistantSelfApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant-entries"] }),
  });
  const submitReport = useMutation({
    mutationFn: (id: string) => assistantSelfApi.submitReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant-entries"] }),
  });
  const selfBook = useMutation({
    mutationFn: (slotId: string) => assistantSelfApi.selfBook(slotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant-entries"] });
      qc.invalidateQueries({ queryKey: ["assistant-slots"] });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <div>
            <p className="text-sm font-semibold">Assistansportal</p>
            {me?.assistant && (
              <p className="text-xs text-muted-foreground">
                {me.assistant.name} · Assisting {me.patientName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {pending.length > 0 && (
            <span className="text-xs text-amber-400 font-medium">{pending.length} proposals waiting</span>
          )}
          {needsReport.length > 0 && (
            <span className="text-xs text-blue-400 font-medium">{needsReport.length} reports due</span>
          )}
          <button onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-3.5 h-3.5" />Log out
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Week strip */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((w) => w - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium px-1">
                  {weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : weekOffset === 1 ? "Next week" : formatDate(weekDates[0])}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((w) => w + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-bold text-blue-400">{weekHours.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">this week</p>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDates.map((date) => {
                const dayEntries = thisWeek.filter((e) => e.date === date);
                const isToday    = date === todayStr;
                const hasPending = dayEntries.some((e) => e.req_status === "pending");
                const dayHours   = dayEntries.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
                return (
                  <div key={date} className={cn(
                    "rounded-lg p-2 text-center space-y-1",
                    isToday ? "bg-primary/15 ring-1 ring-primary/30" : "bg-secondary/30",
                    dayEntries.length === 0 && "opacity-40"
                  )}>
                    <p className={cn("text-[10px] font-medium uppercase", isToday ? "text-primary" : "text-muted-foreground")}>
                      {new Date(date).toLocaleDateString("en-GB", { weekday: "short" })}
                    </p>
                    <p className={cn("text-sm font-bold", isToday ? "text-primary" : "text-foreground")}>
                      {new Date(date).getDate()}
                    </p>
                    {dayHours > 0
                      ? <p className="text-[10px] font-mono text-emerald-400">{dayHours}h</p>
                      : <p className="text-[10px] text-muted-foreground">—</p>
                    }
                    {hasPending && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mx-auto" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Action banners */}
        {(pending.length > 0 || needsReport.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {pending.length > 0 && (
              <button onClick={() => setTab("proposals")}
                className="text-left border border-amber-900/50 bg-amber-950/20 rounded-xl p-3.5 hover:border-amber-700/70 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-amber-300">Shift proposals</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Tap to review</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-amber-400 bg-amber-950 border border-amber-900 rounded px-1.5">{pending.length}</span>
                </div>
              </button>
            )}
            {needsReport.length > 0 && (
              <button onClick={() => setTab("reports")}
                className="text-left border border-blue-900/50 bg-blue-950/20 rounded-xl p-3.5 hover:border-blue-700/70 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-blue-300">Reports due</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Submit your hours</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-blue-400 bg-blue-950 border border-blue-900 rounded px-1.5">{needsReport.length}</span>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
            <TabsTrigger value="proposals" className="flex-1">
              Proposals {pending.length > 0 && <span className="ml-1 text-[10px] bg-amber-900 text-amber-400 rounded-full px-1.5">{pending.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-1">Reports</TabsTrigger>
            <TabsTrigger value="slots" className="flex-1">Open slots</TabsTrigger>
          </TabsList>

          {/* Upcoming */}
          <TabsContent value="upcoming">
            {upcoming.length === 0
              ? <EmptyState message="No upcoming shifts — check Open Slots to self-book" />
              : (
                <div className="space-y-2 mt-2">
                  {upcoming.map((e) => {
                    const isToday = e.date === todayStr;
                    const act     = activityById(e.activity_id as string);
                    return (
                      <Card key={e.id as string} className={isToday ? "ring-1 ring-primary/40" : ""}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                {isToday && <Badge variant="info" className="text-[10px]">Today</Badge>}
                                <p className="text-sm font-medium">{formatDateLong(e.date as string)}</p>
                              </div>
                              <p className="font-mono text-lg font-semibold">{e.start_time} – {e.end_time}</p>
                              <div className="flex items-center gap-2">
                                <ActivityPill activityId={e.activity_id as string} />
                                <span className="text-xs text-muted-foreground">{e.hours}h</span>
                              </div>
                            </div>
                            <div>
                              {e.req_status === "pending" && <Badge variant="warning">Pending</Badge>}
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

          {/* Proposals */}
          <TabsContent value="proposals">
            {pending.length === 0
              ? <EmptyState message="No pending proposals right now" />
              : (
                <div className="space-y-3 mt-2">
                  {pending.map((e) => {
                    const act = activityById(e.activity_id as string);
                    return (
                      <Card key={e.id as string}>
                        <CardContent className="py-4 space-y-3">
                          <div>
                            <p className="text-sm font-medium">{formatDateLong(e.date as string)}</p>
                            <p className="font-mono text-xl font-bold mt-0.5">{e.start_time} – {e.end_time}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <ActivityPill activityId={e.activity_id as string} />
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
              ? <EmptyState message="No approved shifts to report yet" />
              : (
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-muted-foreground">Submit reports for completed shifts. Your guardian reviews and approves them.</p>
                  {approved.sort((a, b) => (b.date as string).localeCompare(a.date as string)).map((e) => (
                    <Card key={e.id as string}>
                      <CardContent className="py-3.5 flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{formatDate(e.date as string)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{e.start_time} – {e.end_time}</span>
                            <span>{e.hours}h</span>
                          </div>
                          <ActivityPill activityId={e.activity_id as string} size="sm" />
                        </div>
                        <div className="flex items-center gap-2">
                          {e.rep_status === "approved" && <Badge variant="success">✓ Approved</Badge>}
                          {e.rep_status === "pending"  && <Badge variant="warning">Under review</Badge>}
                          {e.rep_status === "draft"    && (
                            <Button size="sm" variant="outline" disabled={submitReport.isPending}
                              onClick={() => submitReport.mutate(e.id as string)}>
                              <FileText className="w-3.5 h-3.5" />Submit
                            </Button>
                          )}
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
                    const act = activityById(slot.activity_id as string);
                    return (
                      <Card key={slot.id as string}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1.5">
                              <p className="text-sm font-medium">{formatDateLong(slot.date as string)}</p>
                              <p className="font-mono text-lg font-semibold">{slot.start_time} – {slot.end_time}</p>
                              <div className="flex items-center gap-2">
                                <ActivityPill activityId={slot.activity_id as string} />
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
