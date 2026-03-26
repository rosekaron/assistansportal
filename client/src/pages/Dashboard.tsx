import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { profileApi, entriesApi, assistantsApi, pdfApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/inputs";
import { PageHeader, AssistantAvatar } from "@/components/shared";
import { getWeekDates } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FileDown, ChevronRight, AlertCircle, CheckCircle2, Clock } from "lucide-react";

type Entry     = Record<string, string | number | null | undefined>;
type Assistant = Record<string, string | number | null | undefined>;

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS    = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function pad(n: number) { return String(n).padStart(2, "0"); }

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: profile }         = useQuery({ queryKey: ["profile"],    queryFn: () => profileApi.get().then(r => r.data) });
  const { data: assistants = [] } = useQuery({ queryKey: ["assistants"], queryFn: () => assistantsApi.list().then(r => r.data) });
  const { data: entries    = [] } = useQuery({ queryKey: ["entries"],    queryFn: () => entriesApi.list().then(r => r.data) });

  const now      = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekDates = getWeekDates(0);
  const weekly    = (profile?.weeklyHours as number) ?? 129;

  // ── Week coverage ──────────────────────────────────────────
  const allEntries   = entries as Entry[];
  const weekEntries  = allEntries.filter(e => weekDates.includes(e.date as string));
  const scheduledHours = weekEntries
    .filter(e => e.reqStatus !== "rejected")
    .reduce((s, e) => s + ((e.hours as number) ?? 0), 0);

  const byDay = weekDates.map((date, i) => {
    const dayEntries = allEntries.filter(e =>
      e.date === date && e.reqStatus !== "rejected"
    );
    const totalHours   = dayEntries.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
    const assistantIds = [...new Set(dayEntries.map(e => e.assistantId as string).filter(Boolean))];
    const dayAssistants = assistantIds
      .map(aid => (assistants as Assistant[]).find(a => a.id === aid))
      .filter(Boolean) as Assistant[];
    return { date, dayName: DAY_NAMES[i], totalHours, dayAssistants };
  });

  // ── FK deadline ────────────────────────────────────────────
  // FK 3057/3059 is due the 5th of the 2nd month after the work month
  // e.g. January work → March 5 · February work → April 5
  // The invoice month is always the previous calendar month.
  const invoiceMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const invoiceYear     = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const dueDate         = new Date(now.getFullYear(), now.getMonth() + 1, 5); // 5th of next month
  const daysUntilDue    = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const invoiceMonthStr = `${invoiceYear}-${pad(invoiceMonthIdx + 1)}`;

  // ── Pending approvals (all months) ────────────────────────
  const pendingApprovals = allEntries.filter(e =>
    e.reqStatus === "approved" && e.repStatus === "pending"
  );

  // ── Invoice month FK status ────────────────────────────────
  const invoiceEntries  = allEntries.filter(e => (e.date as string)?.startsWith(invoiceMonthStr) && e.reqStatus === "approved");
  const invoiceReady    = invoiceEntries.filter(e => e.repStatus === "approved");
  const invoiceHours    = invoiceReady.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
  const invoiceTotalHrs = invoiceEntries.reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
  const invoicePending  = invoiceEntries.filter(e => e.repStatus === "pending").length;
  const invoiceIsReady  = invoicePending === 0 && invoiceReady.length > 0;

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

  const guardianFirst = (profile?.guardianName as string)?.split(" ")[0] ?? "";
  const patientName   = (profile?.patientName  as string) ?? "";

  return (
    <div>
      {/* Setup banner */}
      {!profile?.setupDone && (
        <div className="mb-5 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-blue-800">Welcome! Let's get you set up</p>
            <p className="text-xs text-blue-600 mt-0.5">Add care details, FK decision number, and assistants to unlock all features</p>
          </div>
          <a href="/setup">
            <button className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap font-medium shadow-sm">
              Complete setup →
            </button>
          </a>
        </div>
      )}

      <PageHeader
        title={`${greeting()}${guardianFirst ? `, ${guardianFirst}` : ""}`}
        description={`${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${patientName ? ` · Care for ${patientName}` : ""}`}
      />

      {/* ── This week's coverage ──────────────────────────────── */}
      <Card className="mb-5">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold">This week's coverage</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {scheduledHours}h scheduled · {weekly}h granted by FK
              </p>
            </div>
            <button
              onClick={() => navigate("/calendar")}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Open schedule <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {byDay.map(({ date, dayName, dayAssistants, totalHours }) => {
              const isToday = date === todayStr;
              const isEmpty = dayAssistants.length === 0;
              return (
                <div
                  key={date}
                  className={cn(
                    "rounded-xl p-2.5 text-center border transition-all",
                    isToday
                      ? "border-primary bg-primary/5"
                      : "border-border bg-secondary/30",
                    isEmpty && !isToday ? "opacity-50" : ""
                  )}
                >
                  <p className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide mb-1",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}>
                    {dayName}
                  </p>
                  <p className={cn(
                    "text-xs font-mono mb-2.5",
                    isToday ? "text-primary font-bold" : "text-muted-foreground"
                  )}>
                    {new Date(date + "T12:00:00").getDate()}
                  </p>

                  {isEmpty ? (
                    <div className="h-7 flex items-center justify-center">
                      <span className="text-base text-muted-foreground/30">—</span>
                    </div>
                  ) : (
                    <div className="flex justify-center gap-0.5 mb-1.5 flex-wrap">
                      {dayAssistants.slice(0, 2).map(a => (
                        <AssistantAvatar
                          key={a.id as string}
                          name={a.name    as string}
                          initials={a.initials as string}
                          color={a.color   as string}
                          size={24}
                        />
                      ))}
                      {dayAssistants.length > 2 && (
                        <div className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                          +{dayAssistants.length - 2}
                        </div>
                      )}
                    </div>
                  )}

                  {!isEmpty && (
                    <p className="text-xs font-mono font-semibold text-foreground">{totalHours}h</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hours fill bar */}
          <div className="space-y-1.5">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (scheduledHours / weekly) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round((scheduledHours / weekly) * 100)}% of weekly budget scheduled</span>
              <span>{Math.max(0, weekly - scheduledHours)}h remaining</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Action row ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-5">

        {/* Needs attention */}
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Needs your attention
            </p>

            {pendingApprovals.length === 0 && daysUntilDue > 7 ? (
              <div className="flex items-center gap-2.5 text-emerald-600 py-1">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p className="text-sm font-medium">All clear — nothing pending</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingApprovals.length > 0 && (
                  <button
                    onClick={() => navigate("/reports")}
                    className="w-full flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-left"
                  >
                    <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        {pendingApprovals.length} report{pendingApprovals.length > 1 ? "s" : ""} to approve
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">Tap to review in Reports →</p>
                    </div>
                  </button>
                )}

                {daysUntilDue <= 7 && (
                  <div className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border",
                    daysUntilDue <= 3
                      ? "bg-red-50 border-red-200"
                      : "bg-amber-50 border-amber-200"
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
          </CardContent>
        </Card>

        {/* FK invoice this month */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                FK invoice — {MONTHS[invoiceMonthIdx]}
              </p>
              {invoiceEntries.length > 0 && (
                <Badge variant={invoiceIsReady ? "success" : "warning"}>
                  {invoiceIsReady ? "Ready" : `${invoicePending} pending`}
                </Badge>
              )}
            </div>

            <p className="text-3xl font-mono font-bold text-blue-400 mb-1 mt-2">
              {invoiceHours}h
              <span className="text-xs font-normal text-muted-foreground ml-1">approved for FK</span>
            </p>

            {invoiceTotalHrs > 0 && (
              <div className="space-y-1 mb-4">
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
              disabled={fkDownload.isPending || invoiceHours === 0}
            >
              <FileDown className="w-3.5 h-3.5" />
              {fkDownload.isPending ? "Generating…" : "Download FK 3057"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Due {dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "long" })} · {daysUntilDue} days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Assistant quick-view ──────────────────────────────── */}
      {(assistants as Assistant[]).length > 0 && (
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your assistants
              </p>
              <button
                onClick={() => navigate("/assistants")}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Manage <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-wrap gap-5">
              {(assistants as Assistant[]).map(a => {
                const hoursThisWeek = weekEntries
                  .filter(e => e.assistantId === a.id && e.reqStatus !== "rejected")
                  .reduce((s, e) => s + ((e.hours as number) ?? 0), 0);
                return (
                  <div key={a.id as string} className="flex items-center gap-2.5">
                    <AssistantAvatar
                      name={a.name     as string}
                      initials={a.initials  as string}
                      color={a.color    as string}
                      size={34}
                    />
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {(a.name as string).split(" ")[0]}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{hoursThisWeek}h this week</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
