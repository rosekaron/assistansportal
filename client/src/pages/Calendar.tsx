import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { blockedApi, entriesApi, assistantsApi, settingsApi, gcalApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/inputs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AssistantAvatar, PageHeader } from "@/components/shared";
import { getWeekDates, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Calendar, CheckCircle2, Lock, Users,
  ChevronLeft, ChevronRight, X, ExternalLink
} from "lucide-react";

type Entry   = Record<string, string | number | null | undefined>;
type Blocked = Record<string, string | number | null | undefined>;

// ── Hours displayed in the grid ──────────────────────────────
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 – 23:00
const DAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function hhmm(h: number) { return `${String(h).padStart(2,"0")}:00`; }

// ── Step indicator ────────────────────────────────────────────
function Steps({ current }: { current: number }) {
  const steps = [
    { n: 1, label: "Connect calendar",      icon: Calendar },
    { n: 2, label: "Block unavailable time", icon: Lock },
    { n: 3, label: "Assign assistants",     icon: Users },
  ];
  return (
    <div className="flex items-start gap-0 mb-8">
      {steps.map((s, i) => {
        const done    = current > s.n;
        const active  = current === s.n;
        const Icon    = s.icon;
        return (
          <div key={s.n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all border-2",
                done   ? "border-emerald-500 bg-emerald-50"
                : active ? "border-primary bg-primary"
                : "border-border bg-white"
              )}>
                {done
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  : <Icon className={cn("w-4 h-4", active ? "text-white" : "text-muted-foreground")} />
                }
              </div>
              <span className={cn(
                "text-xs font-medium text-center leading-tight px-1",
                active ? "text-primary" : done ? "text-emerald-600" : "text-muted-foreground"
              )}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-1 mb-5 transition-all",
                current > s.n ? "bg-emerald-400" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = getWeekDates(weekOffset);
  const todayStr  = new Date().toISOString().split("T")[0];

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn:  () => settingsApi.get().then((r) => r.data),
  });
  const { data: blocked  = [] } = useQuery({ queryKey: ["blocked"],    queryFn: () => blockedApi.list().then((r) => r.data) });
  const { data: entries  = [] } = useQuery({
    queryKey: ["entries", weekDates[0]],
    queryFn:  () => entriesApi.list({ start: weekDates[0], end: weekDates[6] }).then((r) => r.data),
  });
  const { data: assistants = [] } = useQuery({ queryKey: ["assistants"], queryFn: () => assistantsApi.list().then((r) => r.data) });

  const gcalConnected = (settings as Record<string,string>).gcal_connected === "true";
  const step = gcalConnected ? 2 : 1;

  // ── Connect Google Calendar (real OAuth) ───────────────────
  function connectGcal() {
    // Go directly to the server port for OAuth redirect
    // (Vite proxy doesn't handle full browser navigation redirects)
    const token = localStorage.getItem("token");
    window.location.href = `http://localhost:3001/api/gcal/connect?token=${token}`;
  }

  // Handle redirect back from Google with ?gcal_connected=true
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("gcal_connected") === "true") {
    qc.invalidateQueries({ queryKey: ["settings"] });
    window.history.replaceState({}, "", "/calendar");
  }

  // ── Block time ───────────────────────────────────────────────
  const [blockModal, setBlockModal] = useState<{ date: string; hour: number } | null>(null);
  const [blockForm,  setBlockForm]  = useState({ endHour: "", reason: "", fullDay: false });
  // Full-day block modal (separate from hour-based)
  const [fullDayModal, setFullDayModal] = useState(false);
  const [fullDayForm,  setFullDayForm]  = useState({ startDate: "", endDate: "", reason: "" });

  const addBlocked = useMutation({
    mutationFn: async (data: Record<string,unknown>) => {
      const result = await blockedApi.create(data);
      // Sync to Google Calendar if connected
      if (gcalConnected) {
        try {
          await gcalApi.createEvent({
            summary:     `🚫 ${data.reason || "Unavailable"}`,
            description: "Blocked time — assistance not needed",
            date:        data.date,
            startTime:   data.start_time,
            endTime:     data.end_time,
            colorId:     "11",  // Tomato red
          });
        } catch (e) { console.warn("GCal sync failed:", e); }
      }
      return result;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blocked"] }); setBlockModal(null); },
  });
  const removeBlocked = useMutation({
    mutationFn: (id: string) => blockedApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked"] }),
  });

  // ── Assign slot ──────────────────────────────────────────────
  const [actionModal, setActionModal] = useState<{ date: string; hour: number } | null>(null);
  const [slotModal, setSlotModal] = useState<{ date: string; hour: number } | null>(null);
  const [slotForm,  setSlotForm]  = useState({ endHour: "", assistantId: "" });

  const addEntry = useMutation({
    mutationFn: async (data: Record<string,unknown>) => {
      const result = await entriesApi.create(data);
      if (gcalConnected) {
        try {
          const assistant = (assistants as Entry[]).find(a => a.id === data.assistantId);
          await gcalApi.createEvent({
            summary:       `Assistance — ${(assistant?.name as string ?? "").split(" ")[0]}`,
            description:   `Assistance shift\nAssistant: ${assistant?.name ?? ""}`,
            date:          data.date,
            startTime:     data.startTime as string,
            endTime:       data.endTime   as string,
            attendeeEmail: assistant?.email as string,
            colorId:       "9",
          });
        } catch (e) { console.warn("GCal sync failed:", e); }
      }
      return result;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entries"] }); setSlotModal(null); },
  });

  // ── Grid helpers ─────────────────────────────────────────────
  // Drizzle returns camelCase keys (startTime, endTime) — use both for safety
  function getStart(r: Record<string, unknown>) {
    return parseInt((r.startTime ?? r.start_time) as string);
  }
  function getEnd(r: Record<string, unknown>) {
    return parseInt((r.endTime ?? r.end_time) as string);
  }

  function blockedAt(date: string, hour: number) {
    return (blocked as Blocked[]).find(b =>
      b.date === date &&
      getStart(b) <= hour &&
      getEnd(b) > hour
    );
  }
  function entryAt(date: string, hour: number) {
    return (entries as Entry[]).filter(e =>
      e.date === date &&
      getStart(e) <= hour &&
      getEnd(e) > hour &&
      (e.reqStatus ?? e.req_status) !== "rejected"
    );
  }
  function submitBlock() {
    if (!blockModal) return;
    if (blockForm.fullDay) {
      // Block entire day 00:00-23:59
      addBlocked.mutate({
        date:       blockModal.date,
        start_time: "00:00",
        end_time:   "23:59",
        reason:     blockForm.reason || "Full day unavailable",
      });
    } else {
      if (!blockForm.endHour) return;
      addBlocked.mutate({
        date:       blockModal.date,
        start_time: hhmm(blockModal.hour),
        end_time:   hhmm(parseInt(blockForm.endHour)),
        reason:     blockForm.reason || "Unavailable",
      });
    }
  }

  async function submitFullDay() {
    if (!fullDayForm.startDate) return;
    // Generate one blocked entry per day in the range
    const start = new Date(fullDayForm.startDate);
    const end   = fullDayForm.endDate ? new Date(fullDayForm.endDate) : new Date(fullDayForm.startDate);
    const days: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split("T")[0]);
    }
    for (const date of days) {
      await blockedApi.create({
        date,
        start_time: "00:00",
        end_time:   "23:59",
        reason: fullDayForm.reason || "Unavailable",
      });
    }
    qc.invalidateQueries({ queryKey: ["blocked"] });
    setFullDayModal(false);
    setFullDayForm({ startDate: "", endDate: "", reason: "" });
  }

  function submitSlot() {
    if (!slotModal || !slotForm.assistantId) return;
    const endHour = slotForm.endHour || String(slotModal.hour + 1);
    const hours   = parseInt(endHour) - slotModal.hour;
    addEntry.mutate({
      assistantId: slotForm.assistantId,
      date:        slotModal.date,
      startTime:   hhmm(slotModal.hour),
      endTime:     hhmm(parseInt(endHour)),
      hours,
      reqStatus:   "approved",
      repStatus:   "draft",
      source:      "proposal",
      calStatus:   "confirmed",
    });
  }

  return (
    <div>
      <PageHeader
        title="Schedule"
        description="Set up your weekly assistance calendar"
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : weekOffset === 1 ? "Next week" : `Week of ${formatDate(weekDates[0])}`}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            {weekOffset !== 0 && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>Today</Button>
            )}
            {/* Jump to a specific week by picking a date */}
            <input
              type="week"
              className="text-xs border border-border rounded-lg px-2 py-1 bg-white text-muted-foreground focus:outline-none focus:border-primary"
              onChange={e => {
                if (!e.target.value) return;
                const [year, week] = e.target.value.split("-W").map(Number);
                // Find Monday of that ISO week
                const jan4 = new Date(year, 0, 4);
                const startOfWeek1 = new Date(jan4);
                startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
                const target = new Date(startOfWeek1);
                target.setDate(startOfWeek1.getDate() + (week - 1) * 7);
                const now = new Date();
                const todayMonday = new Date(now);
                todayMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
                const diffMs = target.getTime() - todayMonday.getTime();
                const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
                setWeekOffset(diffWeeks);
              }}
              title="Jump to week"
            />
          </div>
        }
      />

      <Steps current={step} />

      {/* ── Step 1: Connect calendar ── */}
      {!gcalConnected && (
        <Card className="mb-6 border-2 border-primary/20 bg-blue-50/50">
          <CardContent className="pt-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white border border-border flex items-center justify-center shadow-sm shrink-0">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground mb-1">Connect your calendar</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect Google Calendar to sync schedules automatically, or use the manual grid below without connecting.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={connectGcal} className="gap-2">
                    <svg width="16" height="16" viewBox="0 0 48 48">
                      <rect x="6" y="6" width="36" height="36" rx="4" fill="white"/>
                      <rect x="6" y="6" width="36" height="14" rx="4" fill="#4285F4"/>
                      <rect x="6" y="12" width="36" height="8" fill="#4285F4"/>
                      <circle cx="15" cy="13" r="2.5" fill="white"/>
                      <circle cx="33" cy="13" r="2.5" fill="white"/>
                      <text x="24" y="37" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4285F4" fontFamily="Arial">CAL</text>
                    </svg>
                    Connect Google Calendar
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => window.open("https://cal.com", "_blank")}>
                    <ExternalLink className="w-4 h-4" />
                    Use cal.com instead
                  </Button>
                  <Button variant="ghost" onClick={() => {
                    settingsApi.update({ gcal_connected: "true", gcal_email: "manual" });
                    qc.invalidateQueries({ queryKey: ["settings"] });
                  }}>
                    Skip — use manual grid only
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {gcalConnected && (
        <div className="flex items-center gap-2 mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            {(settings as Record<string,string>).gcal_email !== "manual"
              ? <>Calendar connected as <strong>{(settings as Record<string,string>).gcal_email}</strong></>
              : <>Using manual schedule grid</>
            }
          </span>
          <button
            className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => { settingsApi.update({ gcal_connected: "false" }); qc.invalidateQueries({ queryKey: ["settings"] }); }}
          >
            Disconnect
          </button>
        </div>
      )}

      {/* ── Week grid ── */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-secondary/30 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Click a cell to:</span>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
              <span className="text-muted-foreground">Block (unavailable)</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
              <span className="text-muted-foreground">Assign assistant</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />
              <span className="text-muted-foreground">Confirmed shift</span>
            </div>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th className="w-14 px-2 py-2 text-xs text-muted-foreground font-medium text-right border-b border-r border-border bg-white sticky left-0 z-10" />
                  {weekDates.map((date, i) => {
                    const isToday = date === todayStr;
                    return (
                      <th key={date} className={cn(
                        "px-1 py-2 text-center border-b border-border",
                        isToday ? "bg-blue-50" : "bg-white"
                      )}>
                        <div className={cn("text-xs font-medium", isToday ? "text-primary" : "text-muted-foreground")}>
                          {DAY_NAMES[i]}
                        </div>
                        <div className={cn(
                          "text-sm font-bold mt-0.5",
                          isToday ? "text-primary" : "text-foreground"
                        )}>
                          {new Date(date).getDate()}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="group">
                    {/* Hour label */}
                    <td className="px-2 text-right text-xs text-muted-foreground border-r border-border bg-white sticky left-0 z-10 align-top pt-1" style={{ minWidth: 48 }}>
                      {hhmm(hour)}
                    </td>
                    {/* Day cells */}
                    {weekDates.map((date) => {
                      const isToday   = date === todayStr;
                      const blockHere = blockedAt(date, hour);
                      const dayEntries = entryAt(date, hour);

                      let cellClass = "bg-white hover:bg-blue-50 cursor-pointer";
                      let cellContent = null;

                      if (blockHere) {
                        cellClass = "bg-red-50 cursor-pointer";
                        if (getStart(blockHere) === hour) {
                          cellContent = (
                            <div className="flex items-start justify-between px-1 pt-0.5">
                              <span className="text-[10px] text-red-600 font-medium leading-tight">{blockHere.reason as string}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); removeBlocked.mutate(blockHere.id as string); }}
                                className="text-red-400 hover:text-red-600 ml-1 leading-none"
                              >
                                <X style={{ width: 10, height: 10 }} />
                              </button>
                            </div>
                          );
                        }
                      } else if (dayEntries.length > 0) {
                        const e = dayEntries[0];
                        const reqSt = (e.reqStatus ?? e.req_status) as string;
                        cellClass = reqSt === "approved"
                          ? "bg-emerald-50 cursor-default"
                          : "bg-blue-50 cursor-pointer";
                        if (getStart(e) === hour) {
                          const a = (assistants as Entry[]).find(a => a.id === (e.assistantId ?? e.assistant_id));
                          cellContent = (
                            <div className="px-1 pt-0.5">
                              {a && <div className="text-[10px] font-medium leading-tight text-emerald-700">{(a.name as string).split(" ")[0]}</div>}
                              {dayEntries.length > 1 && (
                                <div className="text-[9px] text-muted-foreground">+{dayEntries.length - 1} more</div>
                              )}
                            </div>
                          );
                        }
                      }

                      return (
                        <td
                          key={date}
                          onClick={() => {
                            if (blockHere || dayEntries.some(e => e.req_status === "approved")) return;
                            if (!blockHere && dayEntries.length === 0) {
                              setActionModal({ date, hour });
                            }
                          }}
                          className={cn(
                            "border-b border-r border-border align-top transition-colors",
                            cellClass,
                            isToday && !blockHere && dayEntries.length === 0 ? "bg-blue-50/30" : "",
                          )}
                          style={{ height: 36, minWidth: 80 }}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Week summary ── */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[
          { label: "Confirmed shifts", value: (entries as Entry[]).filter(e => weekDates.includes(e.date as string) && (e.reqStatus ?? e.req_status) === "approved").length, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
          { label: "Reports pending", value: (entries as Entry[]).filter(e => weekDates.includes(e.date as string) && (e.repStatus ?? e.rep_status) === "pending").length, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
          { label: "Blocked periods", value: (blocked as Blocked[]).filter(b => weekDates.includes(b.date as string)).length, color: "text-red-600", bg: "bg-red-50 border-red-200" },
        ].map(k => (
          <div key={k.label} className={cn("rounded-xl border px-4 py-3", k.bg)}>
            <p className={cn("text-2xl font-bold font-mono", k.color)}>{k.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Action chooser ── */}
      <Dialog open={!!actionModal} onOpenChange={(o) => !o && setActionModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>What do you want to do?</DialogTitle>
          </DialogHeader>
          {actionModal && (
            <div className="space-y-3 pt-1">
              <p className="text-sm text-muted-foreground">
                {formatDate(actionModal.date)} at {hhmm(actionModal.hour)}
              </p>
              <button
                onClick={() => {
                  setBlockModal({ date: actionModal.date, hour: actionModal.hour });
                  setBlockForm({ endHour: String(actionModal.hour + 1), reason: "", fullDay: false });
                  setActionModal(null);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-red-300 hover:bg-red-50 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Block this time</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Mark hours as unavailable — nap, medical, etc.</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setFullDayForm({ startDate: actionModal.date, endDate: "", reason: "" });
                  setFullDayModal(true);
                  setActionModal(null);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-red-300 hover:bg-red-50 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 text-lg">
                  🏖️
                </div>
                <div>
                  <p className="font-medium text-foreground">Block full day or vacation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Block one or more days — holiday, travel, hospital</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setSlotModal({ date: actionModal.date, hour: actionModal.hour });
                  setSlotForm({ endHour: String(actionModal.hour + 1), assistantId: "" });
                  setActionModal(null);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Assign assistant</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Directly assign an assistant to this time slot</p>
                </div>
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Block time modal ── */}
      <Dialog open={!!blockModal} onOpenChange={(o) => !o && setBlockModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block unavailable time</DialogTitle>
          </DialogHeader>
          {blockModal && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm font-medium text-foreground">{formatDate(blockModal.date)}</p>
                {!blockForm.fullDay && <p className="text-xs text-muted-foreground mt-0.5">Starting at {hhmm(blockModal.hour)}</p>}
              </div>

              {/* Full day toggle */}
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-border hover:bg-secondary/30 transition-colors">
                <input
                  type="checkbox"
                  checked={blockForm.fullDay}
                  onChange={e => setBlockForm(f => ({ ...f, fullDay: e.target.checked }))}
                  className="w-4 h-4 accent-red-500"
                />
                <div>
                  <p className="text-sm font-medium">Block entire day</p>
                  <p className="text-xs text-muted-foreground">All hours from 00:00 to midnight</p>
                </div>
              </label>

              {!blockForm.fullDay && (
                <div className="space-y-1.5">
                  <Label>Ends at</Label>
                  <select
                    className="w-full rounded-xl border-2 border-border bg-white px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    value={blockForm.endHour}
                    onChange={e => setBlockForm(f => ({ ...f, endHour: e.target.value }))}
                  >
                    <option value="">Select end time</option>
                    {HOURS.filter(h => h > blockModal.hour).map(h => (
                      <option key={h} value={String(h)}>{hhmm(h)} ({h - blockModal.hour}h)</option>
                    ))}
                    <option value="24">00:00 next day (midnight)</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Input
                  placeholder="e.g. Nap time, Medical appointment…"
                  value={blockForm.reason}
                  onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setBlockModal(null)}>Cancel</Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                  disabled={!blockForm.fullDay && !blockForm.endHour}
                  onClick={submitBlock}
                >
                  Block this time
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Full day / vacation modal ── */}
      <Dialog open={fullDayModal} onOpenChange={setFullDayModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block days or vacation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Block one or more full days — assistants won't be scheduled during this time.
            </p>
            <div className="space-y-1.5">
              <Label>From date</Label>
              <Input
                type="date"
                value={fullDayForm.startDate}
                onChange={e => setFullDayForm(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>To date <span className="text-muted-foreground font-normal">(leave blank for single day)</span></Label>
              <Input
                type="date"
                value={fullDayForm.endDate}
                min={fullDayForm.startDate}
                onChange={e => setFullDayForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input
                placeholder="e.g. Vacation, Hospital stay, Public holiday…"
                value={fullDayForm.reason}
                onChange={e => setFullDayForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
            {fullDayForm.startDate && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {fullDayForm.endDate && fullDayForm.endDate !== fullDayForm.startDate
                  ? `Blocking ${Math.round((new Date(fullDayForm.endDate).getTime() - new Date(fullDayForm.startDate).getTime()) / 86400000) + 1} days`
                  : `Blocking 1 day — ${new Date(fullDayForm.startDate).toLocaleDateString("en-GB", { weekday: "long", month: "long", day: "numeric" })}`
                }
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setFullDayModal(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                disabled={!fullDayForm.startDate}
                onClick={submitFullDay}
              >
                Block days
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Assign assistant modal ── */}
      <Dialog open={!!slotModal} onOpenChange={(o) => !o && setSlotModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign assistant</DialogTitle>
          </DialogHeader>
          {slotModal && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-sm font-medium">{formatDate(slotModal.date)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Starting at {hhmm(slotModal.hour)}</p>
              </div>

              <div className="space-y-1.5">
                <Label>Ends at</Label>
                <select
                  className="w-full rounded-xl border-2 border-border bg-white px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  value={slotForm.endHour}
                  onChange={e => setSlotForm(f => ({ ...f, endHour: e.target.value }))}
                >
                  {HOURS.filter(h => h > slotModal.hour).map(h => (
                    <option key={h} value={String(h)}>{hhmm(h)} ({h - slotModal.hour}h)</option>
                  ))}
                  <option value="24">00:00 next day (midnight)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Select assistant</Label>
                <div className="space-y-1.5">
                  {(assistants as Entry[]).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No assistants added yet — add them in the Assistants page first</p>
                  ) : (
                    (assistants as Entry[]).map(a => (
                      <button
                        key={a.id as string}
                        onClick={() => setSlotForm(f => ({ ...f, assistantId: a.id as string }))}
                        className={cn(
                          "w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all",
                          slotForm.assistantId === a.id ? "border-primary bg-primary/5" : "border-border bg-white hover:bg-secondary/30"
                        )}
                      >
                        <AssistantAvatar name={a.name as string} initials={a.initials as string} color={a.color as string} size={32} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{a.name as string}</p>
                          <p className="text-xs text-muted-foreground">{(a.minWeeklyHours ?? a.min_weekly_hours)}h/week</p>
                        </div>
                        {slotForm.assistantId === a.id && (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSlotModal(null)}>Cancel</Button>
                <Button
                  className="flex-1"
                  disabled={!slotForm.assistantId || addEntry.isPending}
                  onClick={submitSlot}
                >
                  Assign shift
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
