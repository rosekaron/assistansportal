import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { absenceApi, assistantsApi } from "@/lib/api";
import type { Absence, AbsenceType, AbsenceBalance } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Badge } from "@/components/ui/inputs";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, AssistantAvatar, SectionLabel, EmptyState } from "@/components/shared";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Helper: format "d MMM – d MMM yyyy" for a date range
function formatPeriod(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T12:00:00");
  const end   = new Date(endDate   + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const startStr = start.toLocaleDateString("en-GB", opts);
  const endStr   = end.toLocaleDateString("en-GB", { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}

// Helper: format "d MMM yyyy"
function formatCreated(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Helper: calendar days between two YYYY-MM-DD strings (inclusive)
function calDays(startDate: string, endDate: string): number {
  return (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000 + 1;
}

// VAB threshold color
function vabColor(remaining: number): string {
  if (remaining >= 30) return "text-emerald-600";
  if (remaining >= 10) return "text-amber-600";
  return "text-red-600";
}

// Absence type badge
function AbsenceTypeBadge({ type }: { type: AbsenceType }) {
  const map: Record<AbsenceType, { variant: "warning" | "info" | "success" | "slate"; label: string }> = {
    "sjukfrånvaro": { variant: "warning", label: "Sick leave" },
    "vab":          { variant: "info",    label: "VAB" },
    "semester":     { variant: "success", label: "Holiday" },
    "other":        { variant: "slate",   label: "Other" },
  };
  const { variant, label } = map[type] ?? { variant: "slate" as const, label: type };
  return <Badge variant={variant}>{label}</Badge>;
}

// Per-assistant balance card pair
function AssistantBalanceCards({
  assistant,
}: {
  assistant: { id: string; name: string; initials?: string; color?: string };
}) {
  const year = new Date().getFullYear();
  const { data: balance, isLoading } = useQuery<AbsenceBalance>({
    queryKey: ["absences", "balance", assistant.id],
    queryFn:  () => absenceApi.balance(assistant.id).then((r) => r.data),
  });

  const vabRemaining = balance?.vabRemaining ?? 120;
  const sickDays     = balance?.sickDays ?? 0;
  const usedVab      = 120 - vabRemaining;
  const pct          = Math.min(100, (usedVab / 120) * 100);

  return (
    <>
      {/* VAB balance card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <AssistantAvatar
              name={assistant.name}
              initials={assistant.initials as string | undefined}
              color={assistant.color as string | undefined}
              size={20}
            />
            {assistant.name}
          </CardTitle>
          <CardDescription>VAB remaining {year}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <p className="text-2xl font-bold text-muted-foreground">--</p>
          ) : (
            <>
              <p className={cn("text-2xl font-bold", vabColor(vabRemaining))}>
                {vabRemaining}
              </p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-1">days remaining of 120</p>
              <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sick YTD card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <AssistantAvatar
              name={assistant.name}
              initials={assistant.initials as string | undefined}
              color={assistant.color as string | undefined}
              size={20}
            />
            {assistant.name}
          </CardTitle>
          <CardDescription>Sick leave {year}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <p className="text-2xl font-bold text-muted-foreground">--</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-foreground">{sickDays}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-1">days recorded</p>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

type Assistant = Record<string, string | number | boolean | null>;

type FormState = {
  assistantId: string;
  absenceType: string;
  startDate: string;
  endDate: string;
};

export default function LeaveAbsencePage() {
  const qc = useQueryClient();
  const year = new Date().getFullYear();

  // Dialog
  const [dialogOpen,       setDialogOpen]       = useState(false);
  const [formState,        setFormState]         = useState<FormState>({
    assistantId: "",
    absenceType: "",
    startDate:   "",
    endDate:     "",
  });
  const [dateError,        setDateError]         = useState("");
  const [serverError,      setServerError]       = useState("");

  // Inline delete confirm
  const [confirmDeleteId,  setConfirmDeleteId]   = useState<string | null>(null);
  const [deleteError,      setDeleteError]        = useState("");

  // Filters
  const [filterAssistant, setFilterAssistant]   = useState("");
  const [filterType,      setFilterType]         = useState("");
  const [filterMonth,     setFilterMonth]        = useState("");

  // Data
  const { data: absenceList = [], isError: absenceListError } = useQuery<Absence[]>({
    queryKey: ["absences"],
    queryFn:  () => absenceApi.list().then((r) => r.data),
  });

  const { data: rawAssistants = [] } = useQuery<Assistant[]>({
    queryKey: ["assistants"],
    queryFn:  () => assistantsApi.list().then((r) => r.data),
  });
  const assistants = rawAssistants as Array<{
    id: string; name: string; initials?: string; color?: string;
  }>;

  // Mutations
  const createAbsence = useMutation({
    mutationFn: (data: Record<string, unknown>) => absenceApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["absences"] });
      assistants.forEach((a) =>
        qc.invalidateQueries({ queryKey: ["absences", "balance", a.id] })
      );
      setDialogOpen(false);
      setFormState({ assistantId: "", absenceType: "", startDate: "", endDate: "" });
      setDateError("");
      setServerError("");
    },
    onError: () => {
      setServerError("Could not save absence. Check the dates and try again.");
    },
  });

  const deleteAbsence = useMutation({
    mutationFn: (id: string) => absenceApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["absences"] });
      assistants.forEach((a) =>
        qc.invalidateQueries({ queryKey: ["absences", "balance", a.id] })
      );
      setConfirmDeleteId(null);
      setDeleteError("");
    },
    onError: () => {
      setDeleteError("Could not delete. Please try again.");
    },
  });

  // Client-side filtering
  const filtered = absenceList
    .filter((a) => !filterAssistant || a.assistantId === filterAssistant)
    .filter((a) => !filterType      || a.absenceType  === filterType)
    .filter((a) => !filterMonth     || a.startDate.startsWith(filterMonth));

  // Unique months for month filter
  const uniqueMonths = Array.from(
    new Set(absenceList.map((a) => a.startDate.slice(0, 7)))
  ).sort();

  function formatMonthLabel(ym: string): string {
    const [y, m] = ym.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  }

  function handleSubmit() {
    setDateError("");
    setServerError("");

    if (formState.startDate && formState.endDate && formState.endDate < formState.startDate) {
      setDateError("End date cannot be before start date.");
      return;
    }

    createAbsence.mutate({
      assistantId: formState.assistantId || null,
      absenceType: formState.absenceType,
      startDate:   formState.startDate,
      endDate:     formState.endDate,
    });
  }

  // Helper: find assistant by id
  function assistantById(id: string | null) {
    if (!id) return null;
    return assistants.find((a) => a.id === id) ?? null;
  }

  // Decide layout: <= 3 assistants → per-assistant pair of cards; > 3 → summary
  const showPerAssistant = assistants.length <= 3;
  const totalAbsencesYear = absenceList.filter(
    (a) => a.startDate.startsWith(String(year))
  ).length;

  return (
    <div>
      <PageHeader
        title="Leave"
        description="Record and track absence per assistant"
        action={
          <Button onClick={() => { setDialogOpen(true); setServerError(""); setDateError(""); }}>
            Record absence
          </Button>
        }
      />

      {/* Balance panel */}
      {assistants.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {showPerAssistant ? (
            <>
              {assistants.map((a) => (
                <AssistantBalanceCards key={a.id} assistant={a} />
              ))}
              {/* Fill remaining grid slots with total summary card if only 1 assistant */}
              {assistants.length === 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total absence</CardTitle>
                    <CardDescription>{year}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-2xl font-bold text-foreground">{totalAbsencesYear}</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-1">records registered</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            /* Summary for > 3 assistants */
            <Card className="col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Absence {year}</CardTitle>
                <CardDescription>Summary for all assistants</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold text-foreground">{totalAbsencesYear}</p>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-1">total records registered</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters */}
      <SectionLabel>Absence</SectionLabel>
      <div className="flex gap-3 mb-4">
        {/* Assistant filter */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <Label htmlFor="filter-assistant">Assistant</Label>
          <Select value={filterAssistant || "__all__"} onValueChange={(v) => setFilterAssistant(v === "__all__" ? "" : v)}>
            <SelectTrigger id="filter-assistant">
              <SelectValue placeholder="All assistants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All assistants</SelectItem>
              {assistants.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Type filter */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <Label htmlFor="filter-type">Type</Label>
          <Select value={filterType || "__all__"} onValueChange={(v) => setFilterType(v === "__all__" ? "" : v)}>
            <SelectTrigger id="filter-type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All types</SelectItem>
              <SelectItem value="sjukfrånvaro">Sick leave</SelectItem>
              <SelectItem value="vab">VAB (childcare)</SelectItem>
              <SelectItem value="semester">Holiday</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Month filter */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <Label htmlFor="filter-month">Month</Label>
          <Select value={filterMonth || "__all__"} onValueChange={(v) => setFilterMonth(v === "__all__" ? "" : v)}>
            <SelectTrigger id="filter-month">
              <SelectValue placeholder="All months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All months</SelectItem>
              {uniqueMonths.map((ym) => (
                <SelectItem key={ym} value={ym}>{formatMonthLabel(ym)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Absence table */}
      <Card>
        <CardContent className="pt-5 p-0 overflow-hidden">
          {absenceListError ? (
            <div className="px-4 py-3 text-sm text-destructive">
              Could not load absences. Check your connection and reload the page.
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              message={
                absenceList.length === 0
                  ? "No absences recorded. Click 'Record absence' to add one."
                  : "No records match the selected filters."
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card">
                <tr>
                  {["Assistant", "Period", "Days", "Type", "Recorded", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[11px] uppercase tracking-wide text-muted-foreground px-4 py-3 font-semibold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((absence) => {
                  const asst = assistantById(absence.assistantId);
                  const isConfirming = confirmDeleteId === absence.id;
                  return (
                    <tr
                      key={absence.id}
                      className="border-b border-border last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-4 py-3">
                        {asst ? (
                          <div className="flex items-center gap-2">
                            <AssistantAvatar
                              name={asst.name}
                              initials={asst.initials}
                              color={asst.color}
                              size={24}
                            />
                            <span className="text-foreground">{asst.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">All assistants</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground" style={{ width: 160 }}>
                        {formatPeriod(absence.startDate, absence.endDate)}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ width: 80 }}>
                        {calDays(absence.startDate, absence.endDate)}
                      </td>
                      <td className="px-4 py-3" style={{ width: 120 }}>
                        <AbsenceTypeBadge type={absence.absenceType} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs" style={{ width: 120 }}>
                        {formatCreated(absence.createdAt)}
                      </td>
                      <td className="px-4 py-3" style={{ width: 48 }}>
                        {isConfirming ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            {deleteError && <span className="text-xs text-destructive">{deleteError}</span>}
                            <span className="text-xs text-foreground">Confirm deletion?</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteAbsence.mutate(absence.id)}
                              disabled={deleteAbsence.isPending}
                            >
                              Yes, delete
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete absence"
                            className="hover:bg-red-50 hover:text-red-600"
                            onClick={() => setConfirmDeleteId(absence.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Record absence dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setDateError(""); setServerError(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record absence</DialogTitle>
            <DialogDescription>
              Select assistant, absence type and period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Assistant */}
            <div className="space-y-1.5">
              <Label htmlFor="dialog-assistant">Assistant</Label>
              <Select
                value={formState.assistantId || "__all__"}
                onValueChange={(v) => setFormState((f) => ({ ...f, assistantId: v === "__all__" ? "" : v }))}
              >
                <SelectTrigger id="dialog-assistant">
                  <SelectValue placeholder="All assistants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All assistants</SelectItem>
                  {assistants.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Absence type */}
            <div className="space-y-1.5">
              <Label htmlFor="dialog-type">Absence type</Label>
              <Select
                value={formState.absenceType}
                onValueChange={(v) => setFormState((f) => ({ ...f, absenceType: v }))}
              >
                <SelectTrigger id="dialog-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sjukfrånvaro">Sick leave</SelectItem>
                  <SelectItem value="vab">VAB (childcare)</SelectItem>
                  <SelectItem value="semester">Holiday</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start date */}
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                value={formState.startDate}
                onChange={(e) => setFormState((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>

            {/* End date */}
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End date</Label>
              <Input
                id="endDate"
                type="date"
                value={formState.endDate}
                onChange={(e) => {
                  setFormState((f) => ({ ...f, endDate: e.target.value }));
                  setDateError("");
                }}
              />
              {dateError && (
                <p className="text-xs text-destructive mt-1">{dateError}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={
                createAbsence.isPending ||
                !formState.absenceType ||
                !formState.startDate ||
                !formState.endDate
              }
            >
              {createAbsence.isPending ? "Saving..." : "Save absence"}
            </Button>

            {serverError && (
              <p className="text-xs text-destructive">{serverError}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
