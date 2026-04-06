import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entriesApi, blockedApi, assistantsApi } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/controls";
import { Button } from "@/components/ui/button";
import { Input, Label, Badge } from "@/components/ui/inputs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/controls";
import {
  PageHeader, AssistantAvatar, AvatarStack,
  ReqBadge, RepBadge, CalBadge, EmptyState
} from "@/components/shared";
import { formatDate, getWeekDates } from "@/lib/utils";
import { Calendar, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import type { Entry, Blocked, Assistant } from "@/lib/types";

export default function HoursPage() {
  const [tab, setTab] = useState("schedule");
  const qc = useQueryClient();

  const { data: entries    = [] } = useQuery({ queryKey: ["entries"],    queryFn: () => entriesApi.list().then((r) => r.data)     });
  const { data: blocked    = [] } = useQuery({ queryKey: ["blocked"],    queryFn: () => blockedApi.list().then((r) => r.data)     });
  const { data: assistants = [] } = useQuery({ queryKey: ["assistants"], queryFn: () => assistantsApi.list().then((r) => r.data) });

  const pendingReps = (entries as Entry[]).filter((e) => e.reqStatus === "approved" && e.repStatus === "pending").length;

  return (
    <div>
      <PageHeader title="Hours" description="Manage schedules, approvals and reports" />

      {pendingReps > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <button onClick={() => setTab("reports")} className="text-left border border-border rounded-xl p-3.5 hover:border-amber-500/50 hover:bg-accent transition-colors">
            <div className="flex justify-between items-start">
              <div><p className="text-sm font-medium">Daily reports</p><p className="text-xs text-muted-foreground mt-0.5">Awaiting approval</p></div>
              <span className="font-mono text-sm font-semibold text-amber-400 bg-amber-950 border border-amber-900 rounded px-1.5">{pendingReps}</span>
            </div>
          </button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="blocked">Blocked</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <ScheduleTab entries={entries as Entry[]} assistants={assistants as Assistant[]} />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab entries={entries as Entry[]} assistants={assistants as Assistant[]} qc={qc} />
        </TabsContent>
        <TabsContent value="blocked">
          <BlockedTab blocked={blocked as Blocked[]} qc={qc} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Schedule tab ──────────────────────────────────────────────
function ScheduleTab({ entries, assistants }: { entries: Entry[]; assistants: Assistant[] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = getWeekDates(weekOffset);
  const todayStr  = new Date().toISOString().split("T")[0];

  const weekEntries = entries.filter((e) => weekDates.includes(e.date as string) && e.reqStatus !== "rejected");

  const merged = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of weekEntries) {
      const key = `${e.date}|${e.startTime}|${e.endTime}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries())
      .map(([key, group]) => ({ key, group, date: group[0].date as string, startTime: group[0].startTime as string, endTime: group[0].endTime as string, hours: group[0].hours as number }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [weekEntries]);

  const aById = (id: string) => assistants.find((a) => a.id === id) as Assistant | undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => w - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : weekOffset === -1 ? "Last week" : `Week of ${formatDate(weekDates[0])}`}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => w + 1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs text-muted-foreground">Today</Button>
        </div>
        <a href="https://calendar.google.com" target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm"><Calendar className="w-3.5 h-3.5" />Google Calendar</Button>
        </a>
      </div>

      {merged.length === 0 ? <EmptyState message="No shifts this week" /> : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card">
              <tr>{["Assistant(s)","Date","Time","Hours","Schedule","Calendar"].map((h) => (
                <th key={h} className="text-left text-[11px] uppercase tracking-wide text-muted-foreground px-4 py-3 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {merged.map(({ key, group, date, startTime, endTime, hours }) => {
                const multi   = group.length > 1;
                const isToday = date === todayStr;
                return (
                  <tr key={key} className={`border-b border-border/50 last:border-0 hover:bg-accent/50 ${isToday ? "bg-primary/5" : ""}`}>
                    <td className="px-4 py-3">
                      {multi ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <AvatarStack assistants={group.map((e) => aById(e.assistantId as string)).filter((a): a is Assistant => !!a).map((a) => ({ id: a.id, initials: a.initials ?? "", color: a.color ?? "#6366f1", name: a.name }))} />
                            <Badge variant="info">{group.length} concurrent</Badge>
                          </div>
                          <div className="space-y-0.5 ml-1">
                            {group.map((e) => {
                              const a = aById(e.assistantId as string);
                              return (
                                <div key={e.id as string} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: a?.color as string ?? "#6366f1" }} />
                                  {a?.name as string}
                                  <ReqBadge status={e.reqStatus as "pending"|"approved"|"rejected"} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {(() => { const a = aById(group[0].assistantId as string); return <AssistantAvatar name={a?.name as string} initials={a?.initials as string} color={a?.color as string} size={28} />; })()}
                          <span className="text-sm">{aById(group[0].assistantId as string)?.name as string}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{formatDate(date)}{isToday && <Badge variant="info" className="ml-1.5 text-[10px]">Today</Badge>}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{startTime} – {endTime}</td>
                    <td className="px-4 py-3 font-mono text-xs">{hours}h{multi && <span className="text-muted-foreground"> ×{group.length}</span>}</td>
                    <td className="px-4 py-3">{multi ? <ReqBadge status={(group.every((e) => e.reqStatus === "approved") ? "approved" : "pending") as "pending"|"approved"|"rejected"} /> : <ReqBadge status={group[0].reqStatus as "pending"|"approved"|"rejected"} />}</td>
                    <td className="px-4 py-3"><CalBadge status={group[0].calStatus as "tentative"|"confirmed"|null} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Reports tab ───────────────────────────────────────────────
function ReportsTab({ entries, assistants, qc }: { entries: Entry[]; assistants: Assistant[]; qc: ReturnType<typeof useQueryClient> }) {
  const [filterAid, setFilterAid] = useState("all");

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => entriesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries"] }),
  });

  const filtered = entries
    .filter((e) => e.reqStatus !== "rejected" && (filterAid === "all" || e.assistantId === filterAid))
    .sort((a, b) => {
      const pri = (e: Entry) => e.reqStatus === "approved" && e.repStatus === "pending" ? 0 : e.reqStatus === "pending" ? 1 : e.repStatus === "approved" ? 2 : 3;
      return pri(a) - pri(b) || (a.date as string).localeCompare(b.date as string);
    });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">All reports ({filtered.length})</p>
        <Select value={filterAid} onValueChange={setFilterAid}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All assistants" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assistants</SelectItem>
            {assistants.map((a) => <SelectItem key={a.id as string} value={a.id as string}>{a.name as string}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? <EmptyState message="No reports to show" /> : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card">
              <tr>{["Assistant","Date","Time","Schedule","Report","Action"].map((h) => (
                <th key={h} className="text-left text-[11px] uppercase tracking-wide text-muted-foreground px-4 py-3 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const a        = assistants.find((x) => x.id === e.assistantId) as Assistant | undefined;
                const needsRep = e.reqStatus === "approved" && e.repStatus === "pending";
                const needsReq = e.reqStatus === "pending";
                return (
                  <tr key={e.id as string} className={`border-b border-border/50 last:border-0 hover:bg-accent/50 ${needsRep ? "bg-amber-950/10" : ""}`}>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><AssistantAvatar name={a?.name as string} initials={a?.initials as string} color={a?.color as string} size={26} /><span className="text-sm">{a?.name as string}</span></div></td>
                    <td className="px-4 py-3 text-sm">{formatDate(e.date as string)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{e.startTime} – {e.endTime}</td>
                    <td className="px-4 py-3"><ReqBadge status={e.reqStatus as "pending"|"approved"|"rejected"} /></td>
                    <td className="px-4 py-3"><RepBadge status={e.repStatus as "draft"|"pending"|"approved"|"rejected"} /></td>
                    <td className="px-4 py-3">
                      {needsRep && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="approve" onClick={() => update.mutate({ id: e.id as string, data: { rep_status: "approved" } })}>✓ Approve report</Button>
                          <Button size="sm" variant="reject"  onClick={() => update.mutate({ id: e.id as string, data: { rep_status: "rejected" } })}>✕</Button>
                        </div>
                      )}
                      {needsReq && <span className="text-xs text-muted-foreground">Awaiting schedule</span>}
                      {!needsRep && !needsReq && e.repStatus === "approved" && <Badge variant="success">✓ Done</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Blocked tab ───────────────────────────────────────────────
function BlockedTab({ blocked, qc }: { blocked: Blocked[]; qc: ReturnType<typeof useQueryClient> }) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ date: "", startTime: "", endTime: "", reason: "" });

  const del = useMutation({
    mutationFn: (id: string) => blockedApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked"] }),
  });
  const add = useMutation({
    mutationFn: (data: Record<string, unknown>) => blockedApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blocked"] }); setAddOpen(false); setForm({ date: "", startTime: "", endTime: "", reason: "" }); },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-sm font-medium">Blocked time</p>
          <p className="text-xs text-muted-foreground mt-0.5">Time when assistance is not needed</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}><Plus className="w-3.5 h-3.5" />Block time</Button>
      </div>
      {blocked.length === 0 ? <EmptyState message="No blocked time slots" /> : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card">
              <tr>{["Date","Time","Reason","Action"].map((h) => (
                <th key={h} className="text-left text-[11px] uppercase tracking-wide text-muted-foreground px-4 py-3 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {blocked.sort((a, b) => (a.date as string).localeCompare(b.date as string)).map((b) => (
                <tr key={b.id as string} className="border-b border-border/50 last:border-0 hover:bg-accent/50">
                  <td className="px-4 py-3">{formatDate(b.date as string)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.startTime} – {b.endTime}</td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">{b.reason || <em>No reason</em>}</td>
                  <td className="px-4 py-3"><Button size="sm" variant="ghost" onClick={() => del.mutate(b.id as string)}>↩ Unblock</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Block time</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Start</Label><Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>End</Label><Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Reason (optional)</Label><Input placeholder="e.g. Nap time" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div>
            <Button className="w-full" onClick={() => add.mutate({ date: form.date, start_time: form.startTime, end_time: form.endTime, reason: form.reason })} disabled={!form.date || !form.startTime || !form.endTime}>
              Block time
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
