import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { assistantSelfApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/inputs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/controls";
import { ActivityPill, EmptyState } from "@/components/shared";
import { activityById } from "@/lib/activities";
import { formatDate, formatDateLong } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CheckCircle, Timer, TimerOff, LogOut, Users } from "lucide-react";

type Entry = Record<string, string | number | null | undefined>;

function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso as string).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

// Family tag colors: cycle through a palette based on assistantId
const FAMILY_COLORS = [
  { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200"   },
  { bg: "bg-purple-50", text: "text-purple-700",  border: "border-purple-200" },
  { bg: "bg-emerald-50",text: "text-emerald-700", border: "border-emerald-200"},
  { bg: "bg-amber-50",  text: "text-amber-700",   border: "border-amber-200"  },
  { bg: "bg-rose-50",   text: "text-rose-700",    border: "border-rose-200"   },
];

function FamilyTag({ label, assistantId, size = "sm" }: { label: string; assistantId: string; size?: "sm" | "xs" }) {
  if (!label) return null;
  // Deterministic color from assistantId
  const idx   = assistantId.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % FAMILY_COLORS.length;
  const color = FAMILY_COLORS[idx];
  return (
    <span className={cn(
      "inline-flex items-center rounded border px-1.5 font-medium",
      size === "xs" ? "text-[10px] py-0" : "text-xs py-0.5",
      color.bg, color.text, color.border
    )}>
      {label}
    </span>
  );
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

  const { data: me }              = useQuery({ queryKey: ["assistant-me"],      queryFn: () => assistantSelfApi.me().then((r) => r.data) });
  const { data: entries = [] }    = useQuery({ queryKey: ["assistant-entries"], queryFn: () => assistantSelfApi.entries().then((r) => r.data) });
  const { data: families = [] }   = useQuery({ queryKey: ["assistant-families"],queryFn: () => assistantSelfApi.families().then((r) => r.data) });
  const { data: linkRequests = [] } = useQuery({ queryKey: ["assistant-link-requests"], queryFn: () => assistantSelfApi.linkRequests().then((r) => r.data) });

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

  const pending  = (entries as Entry[]).filter((e) => e.reqStatus === "pending");
  const approved = (entries as Entry[]).filter((e) => e.reqStatus === "approved");

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
  const acceptLink = useMutation({
    mutationFn: (linkId: string) => assistantSelfApi.acceptLink(linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant-link-requests"] });
      qc.invalidateQueries({ queryKey: ["assistant-families"] });
      qc.invalidateQueries({ queryKey: ["assistant-entries"] });
    },
  });
  const declineLink = useMutation({
    mutationFn: (linkId: string) => assistantSelfApi.declineLink(linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant-link-requests"] }),
  });
  const leaveFamily = useMutation({
    mutationFn: (assistantId: string) => assistantSelfApi.leaveFamily(assistantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant-families"] });
      qc.invalidateQueries({ queryKey: ["assistant-entries"] });
    },
  });
  const isClockLoading = clockIn.isPending || clockOut.isPending;

  const pendingLinks = (linkRequests as Record<string, unknown>[]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-sm font-semibold">
            {me?.assistant?.name ?? "Assistant"}
          </p>
          {(families as Record<string, unknown>[]).filter(f => (f.linkStatus as string) === "accepted").length > 1 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              {(families as Record<string, unknown>[]).filter(f => (f.linkStatus as string) === "accepted").length} families
            </p>
          )}
          {(families as Record<string, unknown>[]).filter(f => (f.linkStatus as string) === "accepted").length <= 1 && me?.patientName && (
            <p className="text-xs text-muted-foreground">Assisting {me.patientName}</p>
          )}
        </div>
        <button onClick={() => { logout(); navigate("/login"); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <LogOut className="w-3 h-3" />Log out
        </button>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Pending link requests banner */}
        {pendingLinks.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-800">
              {pendingLinks.length === 1 ? "New family request" : `${pendingLinks.length} family requests`}
            </p>
            {pendingLinks.map((req) => {
              const assistant = req.assistant as Record<string, unknown> | undefined;
              return (
                <div key={req.id as string} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">{assistant?.familyLabel as string || assistant?.name as string}</p>
                    <p className="text-xs text-blue-600">Wants to add you as their assistant</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="approve"
                      disabled={acceptLink.isPending}
                      onClick={() => acceptLink.mutate(req.id as string)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="reject"
                      disabled={declineLink.isPending}
                      onClick={() => declineLink.mutate(req.id as string)}>
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
                    Next: {formatDateLong(upcoming[0].date as string)} at {upcoming[0].startTime}
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
                        <div className="flex items-center gap-2 flex-wrap">
                          {e.familyLabel && (
                            <FamilyTag label={e.familyLabel as string} assistantId={e.assistantId as string} />
                          )}
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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono">{e.startTime} – {e.endTime}</span>
                        <span>{e.hours}h</span>
                        {e.familyLabel && (
                          <FamilyTag label={e.familyLabel as string} assistantId={e.assistantId as string} size="xs" />
                        )}
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

        {/* Pending proposals banner */}
        {pending.length > 0 && (
          <button onClick={() => setTab("proposals")}
            className="w-full text-left bg-card border border-amber-300 rounded-xl p-3.5 hover:border-amber-500 transition-colors">
            <p className="text-xs text-muted-foreground">Proposals to review</p>
            <p className="font-mono text-2xl font-bold text-amber-600">{pending.length}</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">Tap to review →</p>
          </button>
        )}

        {/* Tabs: Proposals / Reports / Families */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="proposals" className="flex-1">
              Proposals {pending.length > 0 && (
                <span className="ml-1 text-[10px] bg-amber-900 text-amber-400 rounded-full px-1.5">{pending.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-1">Reports</TabsTrigger>
            <TabsTrigger value="families" className="flex-1">
              Families
              {pendingLinks.length > 0 && (
                <span className="ml-1 text-[10px] bg-blue-700 text-blue-100 rounded-full px-1.5">{pendingLinks.length}</span>
              )}
            </TabsTrigger>
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
                            <div className="flex items-center gap-2 mb-1">
                              {e.familyLabel && (
                                <FamilyTag label={e.familyLabel as string} assistantId={e.assistantId as string} />
                              )}
                            </div>
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
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{formatDate(e.date as string)}</p>
                            {e.familyLabel && (
                              <FamilyTag label={e.familyLabel as string} assistantId={e.assistantId as string} size="xs" />
                            )}
                          </div>
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

          {/* Families */}
          <TabsContent value="families">
            <div className="space-y-3 mt-2">
              {pendingLinks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending requests</p>
                  {pendingLinks.map((req) => {
                    const assistant = req.assistant as Record<string, unknown> | undefined;
                    return (
                      <Card key={req.id as string} className="border-blue-200 bg-blue-50/30">
                        <CardContent className="py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{assistant?.familyLabel as string || assistant?.name as string}</p>
                            <p className="text-xs text-muted-foreground">Link request pending</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="approve" disabled={acceptLink.isPending}
                              onClick={() => acceptLink.mutate(req.id as string)}>Accept</Button>
                            <Button size="sm" variant="reject" disabled={declineLink.isPending}
                              onClick={() => declineLink.mutate(req.id as string)}>Decline</Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Accepted families */}
              {(families as Record<string, unknown>[])
                .filter(f => (f.linkStatus as string) === "accepted")
                .map((family) => {
                  const myEntries = (entries as Entry[]).filter(e => e.assistantId === family.id);
                  const upcoming  = myEntries.filter(e => (e.date as string) >= todayStr && e.reqStatus !== "rejected").length;
                  return (
                    <Card key={family.id as string}>
                      <CardContent className="py-3 flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FamilyTag label={family.familyLabel as string || family.name as string} assistantId={family.id as string} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {upcoming} upcoming shift{upcoming !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <Button
                          size="sm" variant="ghost"
                          className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                          disabled={leaveFamily.isPending}
                          onClick={() => {
                            if (confirm(`Leave ${family.familyLabel || family.name}? Your upcoming shifts will remain but you won't receive new ones.`)) {
                              leaveFamily.mutate(family.id as string);
                            }
                          }}
                        >
                          Leave
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}

              {(families as Record<string, unknown>[]).filter(f => (f.linkStatus as string) === "accepted").length === 0
                && pendingLinks.length === 0 && (
                <EmptyState message="No families linked yet" />
              )}
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
