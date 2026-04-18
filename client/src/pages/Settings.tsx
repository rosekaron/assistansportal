import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileApi, settingsApi, assistantsApi, invitesApi, gcalApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Badge, Textarea } from "@/components/ui/inputs";
import { Switch } from "@/components/ui/controls";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, SectionLabel, AssistantAvatar, EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";
import { UserPlus, X, Pencil, ChevronRight, ChevronDown, Users } from "lucide-react";

// ── These components are defined OUTSIDE SettingsPage so React doesn't
// ── recreate them on every render (which causes the one-letter-at-a-time bug)

interface FormState {
  guardianName: string; guardianPno: string; guardianEmail: string; guardianPhone: string;
  patientName: string;  patientPno: string;  address: string; city: string; zip: string;
  fkDecisionNo: string; weeklyHours: string;
  // v1.0.1 Phase 7 additions (SCHEMA-02)
  fkDecisionStart: string;
  fkDecisionEnd: string;
  patientRelationToGuardian: string;
  dubbelAssistansApproved: boolean;
  patientRequiresRepresentative: boolean;
}

const TAX_SCHEME_OPTIONS = [
  { value: "a-skatt", label: "A-skatt" },
  { value: "f-skatt", label: "F-skatt" },
];

const PATIENT_RELATION_OPTIONS = [
  { value: "parent-child",    label: "Förälder → barn"     },
  { value: "spouse",          label: "Make/maka"           },
  { value: "adult-child",     label: "Barn → vuxet barn"   },
  { value: "god_man",         label: "God man"             },
  { value: "legal-guardian",  label: "Förvaltare"          },
  { value: "other",           label: "Annan"               },
];

function CollapsibleSection({
  title, open, onToggle, children,
}: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const ChevronIcon = open ? ChevronDown : ChevronRight;
  return (
    <div className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 py-3 px-4 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">{title}</span>
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function SettingsField({
  label, field, type = "text", placeholder = "", value, onChange,
}: {
  label: string;
  field: keyof FormState;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (field: keyof FormState, val: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </div>
  );
}

function ToggleRow({
  label, sub, value, onChange,
}: {
  label: string; sub: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <Switch checked={value} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-sm text-foreground font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </label>
  );
}

type Assistant = Record<string, string | number | boolean | null>;
type Invite    = Record<string, string | number | boolean | null>;

export default function SettingsPage() {
  const qc             = useQueryClient();
  const navigate       = useNavigate();
  const setAssistantId = useAuthStore((s) => s.setAssistantId);
  const authAssistantId = useAuthStore((s) => s.assistantId);
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Account / profile state ────────────────────────────────────────────────
  const [saved,      setSaved]      = useState(false);
  const [gcalSaved,  setGcalSaved]  = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // ── Assistants section state ───────────────────────────────────────────────
  const [inviteOpen,    setInviteOpen]    = useState(false);
  const [removeId,      setRemoveId]      = useState<string | null>(null);
  const [editTarget,    setEditTarget]    = useState<Assistant | null>(null);
  const [editForm,      setEditForm]      = useState({
    name: "", pno: "", phone: "", minWeeklyHours: "", isFlexible: false, address: "",
    addressStreet: "", addressZip: "", addressCity: "",
    employmentStartDate: "", employmentEndDate: "",
    citizenship: "", residencePermitExpiry: "",
    notes: "",
    skattetabell: "",
    taxScheme: "a-skatt",
    bankClearing: "", bankAccount: "", iban: "",
    email: "",
  });
  const [editSectionOpen, setEditSectionOpen] = useState({ person: true, employment: false });  // D-11: Personuppgifter open by default
  const [inviteForm,    setInviteForm]    = useState({ name: "", email: "", minWeeklyHours: "", isFlexible: false, message: "" });
  const [inviteSent,    setInviteSent]    = useState(false);
  const [selfOpen,      setSelfOpen]      = useState(false);
  const [selfForm,      setSelfForm]      = useState({ name: "", pno: "", phone: "", minWeeklyHours: "0", isFlexible: false });
  const [selfError,     setSelfError]     = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: profile }             = useQuery({ queryKey: ["profile"],    queryFn: () => profileApi.get().then((r) => r.data) });
  const { data: settings }            = useQuery({ queryKey: ["settings"],   queryFn: () => settingsApi.get().then((r) => r.data) });
  const { data: assistants = [] }     = useQuery({ queryKey: ["assistants"], queryFn: () => assistantsApi.list().then((r) => r.data) });
  const { data: invites = [] }        = useQuery({ queryKey: ["invites"],    queryFn: () => invitesApi.list().then((r) => r.data) });

  // ── Derived assistant values ───────────────────────────────────────────────
  const weekly      = profile?.weeklyHours ?? 129;
  const totalMin    = (assistants as Assistant[]).reduce((s, a) => s + ((a.minWeeklyHours as number) ?? 0), 0);
  const pool        = weekly - totalMin;
  const pendingCount = (invites as Invite[]).filter((i) => i.status === "pending").length;

  // ── Form state (profile) ──────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({
    guardianName: "", guardianPno: "", guardianEmail: "", guardianPhone: "",
    patientName:  "", patientPno:  "", address: "",       city: "",        zip: "",
    fkDecisionNo: "", weeklyHours: "129",
    fkDecisionStart: "", fkDecisionEnd: "",
    patientRelationToGuardian: "parent-child",
    dubbelAssistansApproved: false,
    patientRequiresRepresentative: false,
  });
  const [profileSectionOpen, setProfileSectionOpen] = useState({ person: true, fk: false });  // D-11: Personuppgifter open by default

  const [gcal, setGcal] = useState({
    connected: false, email: "", calendarId: "",
    syncEnabled: true, reminders: true, reminderHours: "24",
  });

  const { data: calendarList = [] } = useQuery({ queryKey: ["gcal-calendars"], queryFn: () => gcalApi.calendars().then((r) => r.data), enabled: gcal.connected });

  const [prelimTaxRate, setPrelimTaxRate] = useState("30");
  // Stored as percentage integer string in UI (e.g. "30"), saved as decimal string "0.30" to settings

  const [reminderDay,   setReminderDay]   = useState<number>(1);
  const [reminderSaved, setReminderSaved] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  function setField(field: keyof FormState, val: string) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  useEffect(() => {
    if (profile) {
      setForm({
        guardianName:  profile.guardianName  ?? "",
        guardianPno:   profile.guardianPno   ?? "",
        guardianEmail: profile.guardianEmail ?? "",
        guardianPhone: profile.guardianPhone ?? "",
        patientName:   profile.patientName   ?? "",
        patientPno:    profile.patientPno    ?? "",
        address:       profile.address       ?? "",
        city:          profile.city          ?? "",
        zip:           profile.zip           ?? "",
        fkDecisionNo:  profile.fkDecisionNo  ?? "",
        weeklyHours:   String(profile.weeklyHours ?? 129),
        fkDecisionStart:               profile.fkDecisionStart ?? "",
        fkDecisionEnd:                 profile.fkDecisionEnd   ?? "",
        patientRelationToGuardian:     profile.patientRelationToGuardian ?? "parent-child",
        dubbelAssistansApproved:       Boolean(profile.dubbelAssistansApproved ?? false),
        patientRequiresRepresentative: Boolean(profile.patientRequiresRepresentative ?? false),
      });
    }
  }, [profile]);

  useEffect(() => {
    if (settings) {
      setGcal((g) => ({
        ...g,
        connected:     settings.gcal_connected === "true",
        email:         settings.gcal_email      ?? "",
        calendarId:    settings.gcal_calendar_id ?? "",
        syncEnabled:   settings.gcal_sync_enabled !== "false",
        reminders:     settings.gcal_reminders    !== "false",
        reminderHours: settings.gcal_reminder_hours ?? "24",
      }));
      // Read preliminary_tax_rate from settings (stored as "0.30" → display as "30")
      const rawPrelim = settings["preliminary_tax_rate"];
      if (rawPrelim) {
        const asPct = Math.round(parseFloat(rawPrelim) * 100);
        setPrelimTaxRate(String(asPct));
      }
      // Read reminder_day from settings (stored as integer string e.g. "5")
      const rawReminderDay = settings["reminder_day"];
      if (rawReminderDay) {
        const parsed = parseInt(rawReminderDay, 10);
        if (!isNaN(parsed)) setReminderDay(parsed);
      }
    }
  }, [settings]);

  // ── Profile mutations ─────────────────────────────────────────────────────
  const saveProfile = useMutation({
    mutationFn: () => profileApi.update({ ...form, weeklyHours: parseInt(form.weeklyHours) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const saveGcal = useMutation({
    mutationFn: () => settingsApi.update({
      gcal_sync_enabled:   String(gcal.syncEnabled),
      gcal_reminders:      String(gcal.reminders),
      gcal_reminder_hours: gcal.reminderHours,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setGcalSaved(true);
      setTimeout(() => setGcalSaved(false), 2000);
    },
  });

  const savePrelimTax = useMutation({
    mutationFn: () => settingsApi.update({
      preliminary_tax_rate: String(parseFloat(prelimTaxRate) / 100),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  function connectGcal() {
    const token = localStorage.getItem("token");
    window.location.href = `${window.location.origin}/api/gcal/connect?token=${token}`;
  }

  useEffect(() => {
    if (searchParams.get("gcal_connected") === "true") {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnectGcal = useMutation({
    mutationFn: () => gcalApi.disconnect(),
    onSuccess: () => {
      setGcal((g) => ({ ...g, connected: false, email: "", calendarId: "" }));
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["gcal-calendars"] });
    },
  });

  // ── Assistant mutations ───────────────────────────────────────────────────
  const deleteAssistant = useMutation({
    mutationFn: (id: string) => assistantsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assistants"] }); setRemoveId(null); },
  });

  const updateAssistant = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => assistantsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assistants"] }); setEditTarget(null); },
  });

  const registerSelfMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => assistantsApi.registerSelf(data),
    onSuccess: (res) => {
      const assistantId = (res.data as { assistantId: string }).assistantId;
      setAssistantId(assistantId);
      qc.invalidateQueries({ queryKey: ["assistants"] });
      setSelfOpen(false);
      setSelfError(null);
      setSelfForm({ name: "", pno: "", phone: "", minWeeklyHours: "0", isFlexible: false });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to register";
      setSelfError(msg);
    },
  });

  function openEdit(a: Assistant) {
    setEditForm({
      name:                  String(a.name ?? ""),
      pno:                   String(a.pno ?? ""),
      phone:                 String(a.phone ?? ""),
      minWeeklyHours:        String(a.minWeeklyHours ?? 0),
      isFlexible:            Boolean(a.isFlexible ?? false),
      address:               String(a.address ?? ""),
      addressStreet:         String(a.addressStreet ?? ""),
      addressZip:            String(a.addressZip ?? ""),
      addressCity:           String(a.addressCity ?? ""),
      employmentStartDate:   String(a.employmentStartDate ?? ""),
      employmentEndDate:     String(a.employmentEndDate ?? ""),
      citizenship:           String(a.citizenship ?? ""),
      residencePermitExpiry: String(a.residencePermitExpiry ?? ""),
      notes:                 String(a.notes ?? ""),
      skattetabell:          a.skattetabell == null ? "" : String(a.skattetabell),
      taxScheme:             String(a.taxScheme ?? "a-skatt"),
      bankClearing:          String(a.bankClearing ?? ""),
      bankAccount:           String(a.bankAccount ?? ""),
      iban:                  String(a.iban ?? ""),
      email:                 String(a.email ?? ""),
    });
    setEditSectionOpen({ person: true, employment: false }); // reset per-open
    setEditTarget(a);
  }

  const sendInvite = useMutation({
    mutationFn: (data: Record<string, unknown>) => invitesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invites"] });
      setInviteSent(true);
      setTimeout(() => {
        setInviteSent(false);
        setInviteOpen(false);
        setInviteForm({ name: "", email: "", minWeeklyHours: "", isFlexible: false, message: "" });
      }, 1800);
    },
  });

  const updateInvite = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => invitesApi.update(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });

  const deleteInvite = useMutation({
    mutationFn: (id: string) => invitesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });

  const acceptInvite = useMutation({
    mutationFn: async (invite: Invite) => {
      await assistantsApi.create({ name: invite.name, email: invite.email, minWeeklyHours: invite.minWeeklyHours, isFlexible: invite.isFlexible });
      await invitesApi.delete(invite.id as string);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistants"] });
      qc.invalidateQueries({ queryKey: ["invites"] });
    },
  });

  return (
    <div>
      <PageHeader title="Settings" description="Manage your assistants, integrations, scheduling and care details" />

      {/* ── 1. ASSISTANTS ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Assistants</SectionLabel>
        <div className="flex items-center gap-2">
          {!authAssistantId && (
            <Button size="sm" variant="outline" onClick={() => setSelfOpen(true)}>
              <Users className="w-4 h-4" />I'm also an assistant
            </Button>
          )}
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4" />Add assistant
          </Button>
        </div>
      </div>

      {/* Weekly budget bar */}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-sm font-medium">Weekly hours budget</p>
              <p className="text-xs text-muted-foreground mt-0.5">{weekly}h/week granted by FK</p>
            </div>
            <div className="text-right">
              <p className={cn("font-mono text-lg font-bold", pool < 0 ? "text-destructive" : pool === 0 ? "text-emerald-600" : "text-primary")}>
                {totalMin}h <span className="text-sm text-muted-foreground font-normal">/ {weekly}h</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pool >= 0 ? `${pool}h in flexible pool` : `${Math.abs(pool)}h over budget`}
              </p>
            </div>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
            <div
              className={cn("h-full rounded-full transition-all", pool < 0 ? "bg-destructive" : pool === 0 ? "bg-emerald-500" : "bg-primary")}
              style={{ width: `${Math.min(100, (totalMin / weekly) * 100)}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {(assistants as Assistant[]).map((a) => (
              <div key={a.id as string} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ background: a.color as string }} />
                <span>{(a.name as string).split(" ")[0]}: {a.minWeeklyHours}h{a.isFlexible ? "+" : ""}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active assistants grid */}
      <SectionLabel>Active assistants ({(assistants as Assistant[]).length})</SectionLabel>
      {(assistants as Assistant[]).length === 0 ? (
        <EmptyState message="No active assistants yet — send an invite below" />
      ) : (
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {(assistants as Assistant[]).map((a) => (
            <Card key={a.id as string} className="relative">
              <div className="absolute top-3 right-3 flex gap-1.5">
                <button onClick={() => openEdit(a)}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setRemoveId(a.id as string)}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 mb-3">
                  <AssistantAvatar name={a.name as string} initials={a.initials as string} color={a.color as string} size={42} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{a.name as string}</p>
                    <p className="text-xs text-muted-foreground">{a.email as string || "Personal assistant"}</p>
                  </div>
                </div>
                <div className="border-t border-border pt-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Min hours/week</span>
                    <span className="font-mono font-semibold text-primary">{a.minWeeklyHours}h{a.isFlexible ? " +flex" : ""}</span>
                  </div>
                  {(a.pno as string) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Personnummer</span>
                      <span className="font-mono text-xs">{a.pno as string}</span>
                    </div>
                  )}
                  {(a.phone as string) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="text-xs">{a.phone as string}</span>
                    </div>
                  )}
                  {authAssistantId === (a.id as string)
                    ? <Badge variant="info" className="text-[10px]">● You · Linked to your account</Badge>
                    : <Badge variant="success" className="text-[10px]">● Active</Badge>
                  }
                  {/* View leave link */}
                  <div className="pt-2 border-t border-border mt-2">
                    <button
                      onClick={() => navigate("/records")}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View leave <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pending invites */}
      {(invites as Invite[]).length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <SectionLabel>Pending verification</SectionLabel>
            {pendingCount > 0 && <Badge variant="warning" className="mb-3 text-[10px]">{pendingCount} pending</Badge>}
          </div>
          <div className="border border-border rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card">
                <tr>{["Name","Email","Hours/wk","Sent","Status","Actions"].map((h) => (
                  <th key={h} className="text-left text-[11px] uppercase tracking-wide text-muted-foreground px-4 py-3 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {(invites as Invite[]).map((inv) => (
                  <tr key={inv.id as string} className="border-b border-border/50 last:border-0 hover:bg-accent/50">
                    <td className="px-4 py-3 font-medium text-foreground">{inv.name as string}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{inv.email as string}</td>
                    <td className="px-4 py-3 font-mono text-xs">{inv.minWeeklyHours}h{inv.isFlexible ? "+" : ""}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(inv.sentAt as string).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3">
                      <Badge variant={inv.status === "pending" ? "warning" : inv.status === "declined" ? "destructive" : "slate"}>
                        {inv.status as string}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {inv.status === "pending" && (
                          <Button size="sm" variant="approve" onClick={() => acceptInvite.mutate(inv)}>✓ Accept (demo)</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => updateInvite.mutate({ id: inv.id as string, status: "pending" })}>Resend</Button>
                        <Button size="sm" variant="reject"  onClick={() => deleteInvite.mutate(inv.id as string)}>Revoke</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* How invitations work */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-8">
        <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">How invitations work</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { n: "1", t: "Enter details", s: "Name, email, hours" },
            { n: "2", t: "They receive email", s: "With account link" },
            { n: "3", t: "They accept", s: "Appear as active" },
            { n: "4", t: "They can self-book", s: "And submit reports" },
          ].map((s) => (
            <div key={s.n} className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</div>
              <div>
                <p className="text-xs text-foreground font-medium">{s.t}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.s}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. INTEGRATIONS ────────────────────────────────────────────────── */}
      <SectionLabel>Integrations</SectionLabel>
      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className={cn("flex items-center justify-between", gcal.connected ? "mb-5" : "")}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <rect x="6" y="6" width="36" height="36" rx="4" fill="#fff"/>
                  <rect x="6" y="6" width="36" height="12" rx="4" fill="#4285F4"/>
                  <rect x="6" y="12" width="36" height="6" fill="#4285F4"/>
                  <text x="24" y="36" textAnchor="middle" fontSize="13" fontWeight="700" fill="#4285F4" fontFamily="Arial">CAL</text>
                  <circle cx="15" cy="12" r="2.5" fill="#fff"/>
                  <circle cx="33" cy="12" r="2.5" fill="#fff"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold">Google Calendar</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {gcal.connected
                    ? <span>Connected as <span className="text-primary">{gcal.email}</span></span>
                    : "Sync schedules with Google Calendar"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {gcal.connected && (
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">● Connected</span>
              )}
              {gcal.connected ? (
                <Button variant="ghost" size="sm" onClick={() => disconnectGcal.mutate()} disabled={disconnectGcal.isPending}>
                  {disconnectGcal.isPending ? "Disconnecting…" : "Disconnect"}
                </Button>
              ) : (
                <Button size="sm" onClick={connectGcal}>Connect Google Calendar</Button>
              )}
            </div>
          </div>

          {gcal.connected && (
            <div className="border-t border-border pt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Calendar</Label>
                  <Select value={gcal.calendarId} onValueChange={(v) => { setGcal((g) => ({ ...g, calendarId: v })); settingsApi.update({ gcal_calendar_id: v }); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {calendarList.map((cal) => (
                        <SelectItem key={cal.id!} value={cal.id!}>
                          {cal.summary}{cal.primary ? " (primary)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Reminder (hours before shift)</Label>
                  <Select value={gcal.reminderHours} onValueChange={(v) => setGcal((g) => ({ ...g, reminderHours: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["1","2","6","12","24","48"].map((h) => (
                        <SelectItem key={h} value={h}>{h}h before</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-3">
                <ToggleRow
                  label="Sync approved shifts"
                  sub="Creates calendar events when schedules are confirmed"
                  value={gcal.syncEnabled}
                  onChange={(v) => setGcal((g) => ({ ...g, syncEnabled: v }))}
                />
                <ToggleRow
                  label="Send reminders"
                  sub="Push notifications to your Google account"
                  value={gcal.reminders}
                  onChange={(v) => setGcal((g) => ({ ...g, reminders: v }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                {gcalSaved && <span className="text-xs text-emerald-600 self-center">✓ Saved</span>}
                <Button size="sm" variant="outline" onClick={() => saveGcal.mutate()}>Save calendar settings</Button>
              </div>
            </div>
          )}

          {/* Setup guide (static — no API calls) */}
          <div className="mt-4 border-t border-border pt-4">
            <button
              onClick={() => setWizardOpen((w) => !w)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {wizardOpen ? "Hide setup guide ▴" : "Show setup guide ▾"}
            </button>
            {wizardOpen && (
              <ol className="mt-3 space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-semibold">1</span>
                  <div>
                    <p className="font-semibold">Connect Google Calendar</p>
                    <p className="text-muted-foreground text-xs">Use the Connect button above.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 font-semibold">2</span>
                  <div>
                    <p className="font-semibold">Shifts appear on Home</p>
                    <p className="text-muted-foreground text-xs">Once connected, this week's schedule shows on your Home page.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 font-semibold">3</span>
                  <div>
                    <p className="font-semibold">Assistants auto-matched</p>
                    <p className="text-muted-foreground text-xs">Shifts are matched to assistants by name.</p>
                  </div>
                </li>
              </ol>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 4. PAYROLL RATES ───────────────────────────────────────────────── */}
      <div className="mt-8 mb-3"><SectionLabel>Payroll rates</SectionLabel></div>
      <Card className="mb-6">
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prelim-tax-rate">Preliminary tax rate (preliminärskatt)</Label>
            <p className="text-xs text-muted-foreground">
              Tax withheld from each assistant's gross salary and remitted to Skatteverket.
              Used when generating blankett 4805. Enter as a percentage (e.g. 30 for 30%).
            </p>
            <div className="flex items-center gap-2 max-w-[180px]">
              <Input
                id="prelim-tax-rate"
                type="number"
                min="0"
                max="60"
                step="1"
                placeholder="30"
                value={prelimTaxRate}
                onChange={(e) => setPrelimTaxRate(e.target.value)}
              />
              <span className="text-sm text-muted-foreground shrink-0">%</span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => savePrelimTax.mutate()}
            disabled={savePrelimTax.isPending}
          >
            {savePrelimTax.isPending ? "Saving..." : "Save rate"}
          </Button>
        </CardContent>
      </Card>

      {/* ── 5. ACCOUNT ─────────────────────────────────────────────────────── */}
      <SectionLabel>Account & care details</SectionLabel>
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guardian / Legal representative</p>
            <SettingsField label="Full name"            field="guardianName"  placeholder=""  value={form.guardianName}  onChange={setField} />
            <SettingsField label="Personal ID (12 dig)" field="guardianPno"   placeholder=""  value={form.guardianPno}   onChange={setField} />
            <SettingsField label="Email"                field="guardianEmail" type="email"    value={form.guardianEmail} onChange={setField} />
            <SettingsField label="Phone"                field="guardianPhone" placeholder=""  value={form.guardianPhone} onChange={setField} />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardContent className="pt-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">The insured person</p>
              <SettingsField label="Full name"            field="patientName" placeholder="" value={form.patientName} onChange={setField} />
              <SettingsField label="Personal ID (12 dig)" field="patientPno"  placeholder="" value={form.patientPno}  onChange={setField} />
              <SettingsField label="Street address"       field="address"     placeholder="" value={form.address}     onChange={setField} />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <SettingsField label="City" field="city" placeholder="" value={form.city} onChange={setField} />
                </div>
                <SettingsField label="Zip" field="zip" placeholder="" value={form.zip} onChange={setField} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Försäkringskassan</p>
              <SettingsField label="Decision number" field="fkDecisionNo" placeholder="" value={form.fkDecisionNo} onChange={setField} />
              <div className="space-y-1.5">
                <Label>Weekly hours granted</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={form.weeklyHours}
                    className="pr-10"
                    onChange={(e) => setField("weeklyHours", e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h/wk</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-5">
        {saved && <span className="text-xs text-emerald-600">✓ Saved</span>}
        <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
          {saveProfile.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* ── 6. NOTIFICATIONS ───────────────────────────────────────────────── */}
      <div className="mt-8 mb-3"><SectionLabel>Notifications</SectionLabel></div>
      {/* ── Notifications (COMP-02) ──────────────────────────────────────── */}
      <Card className="mb-6">
        <CardContent className="pt-5">
          <p className="text-base font-semibold mb-4">Notifications</p>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">
                Monthly compliance reminder
              </p>
              <p
                id="reminder-day-desc"
                className="text-sm text-muted-foreground mb-3"
              >
                Email sent on this day each month with pending compliance steps.
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={reminderDay}
                  onChange={e => {
                    setReminderError(null);
                    setReminderDay(parseInt(e.target.value, 10) || 1);
                  }}
                  className="w-20"
                  aria-describedby="reminder-day-desc"
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    if (reminderDay < 1 || reminderDay > 28) {
                      setReminderError("Enter a day between 1 and 28");
                      return;
                    }
                    setReminderError(null);
                    try {
                      await settingsApi.update({ reminder_day: String(reminderDay) });
                      setReminderSaved(true);
                      setTimeout(() => setReminderSaved(false), 2000);
                    } catch {
                      setReminderError("Failed to save. Try again.");
                    }
                  }}
                >
                  Save reminder day
                </Button>
                {reminderSaved && (
                  <span className="text-sm text-emerald-600">Saved</span>
                )}
              </div>
              {reminderError && (
                <p className="text-sm text-destructive mt-1.5">{reminderError}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── DIALOGS ────────────────────────────────────────────────────────── */}

      {/* Add assistant / identity verification dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => !inviteSent && setInviteOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add a personal assistant</DialogTitle></DialogHeader>
          {inviteSent ? (
            <div className="text-center py-6 space-y-2">
              <div className="text-4xl">&#x2709;&#xFE0F;</div>
              <p className="font-semibold text-emerald-600">Verification email sent!</p>
              <p className="text-sm text-muted-foreground">{inviteForm.name} will receive an email to verify their identity and create their account.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">They'll receive an email to verify their identity and set up their account. They must confirm before appearing as an active assistant.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Full name *</Label><Input placeholder="First Last" value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div className="space-y-1.5">
                  <Label>Min hours/week *</Label>
                  <div className="relative">
                    <Input type="number" placeholder="25" className="pr-8" value={inviteForm.minWeeklyHours} onChange={(e) => setInviteForm((f) => ({ ...f, minWeeklyHours: e.target.value }))} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Email *</Label><Input type="email" placeholder="assistant@example.com" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={inviteForm.isFlexible} onChange={(e) => setInviteForm((f) => ({ ...f, isFlexible: e.target.checked }))} className="rounded" />
                <span>Flexible — can take hours from the shared pool</span>
              </label>
              <div className="space-y-1.5"><Label>Personal message (optional)</Label><Textarea placeholder="Hi, I'd like to invite you to assist with…" rows={3} value={inviteForm.message} onChange={(e) => setInviteForm((f) => ({ ...f, message: e.target.value }))} /></div>

              {/* Email preview */}
              {(inviteForm.name || inviteForm.email) && (
                <div className="bg-secondary/50 rounded-lg p-3 space-y-1 text-xs">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Email preview</p>
                  <p><strong className="text-foreground">To:</strong> <span className="text-muted-foreground">{inviteForm.email || "—"}</span></p>
                  <p><strong className="text-foreground">Subject:</strong> <span className="text-muted-foreground">Verify your identity — Assistansportal</span></p>
                  <p className="text-muted-foreground italic mt-1">{inviteForm.message || `Hi ${inviteForm.name || "there"}, you have been invited to join as a personal assistant.`}</p>
                </div>
              )}

              <Button className="w-full" disabled={!inviteForm.name || !inviteForm.email || !inviteForm.minWeeklyHours}
                onClick={() => sendInvite.mutate({ name: inviteForm.name, email: inviteForm.email, minWeeklyHours: parseInt(inviteForm.minWeeklyHours), isFlexible: inviteForm.isFlexible, message: inviteForm.message })}>
                Send verification email →
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit assistant dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Redigera assistent</DialogTitle></DialogHeader>
          <div className="-mx-6">
            <CollapsibleSection
              title="Personuppgifter"
              open={editSectionOpen.person}
              onToggle={() => setEditSectionOpen(s => ({ ...s, person: !s.person }))}
            >
              <div className="space-y-1.5">
                <Label>Fullständigt namn *</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Personnummer</Label>
                  <Input pattern="\d{6,8}-?\d{4}" placeholder="ÅÅÅÅMMDD-XXXX" value={editForm.pno} onChange={(e) => setEditForm(f => ({ ...f, pno: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefon</Label>
                  <Input type="tel" placeholder="07X-XXX XX XX" value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>E-post</Label>
                <Input type="email" placeholder="assistent@exempel.se" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Gatuadress</Label>
                <Input placeholder="Storgatan 1" value={editForm.addressStreet} onChange={(e) => setEditForm(f => ({ ...f, addressStreet: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Postnummer</Label>
                  <Input pattern="\d{3}\s?\d{2}" placeholder="123 45" value={editForm.addressZip} onChange={(e) => setEditForm(f => ({ ...f, addressZip: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ort</Label>
                  <Input placeholder="Stockholm" value={editForm.addressCity} onChange={(e) => setEditForm(f => ({ ...f, addressCity: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Min timmar/vecka</Label>
                <div className="relative">
                  <Input type="number" className="pr-8" value={editForm.minWeeklyHours} onChange={(e) => setEditForm(f => ({ ...f, minWeeklyHours: e.target.value }))} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={editForm.isFlexible} onChange={(e) => setEditForm(f => ({ ...f, isFlexible: e.target.checked }))} className="rounded" />
                <span>Flexibel — kan ta timmar från den delade poolen</span>
              </label>
            </CollapsibleSection>

            <CollapsibleSection
              title="Anställning & ekonomi"
              open={editSectionOpen.employment}
              onToggle={() => setEditSectionOpen(s => ({ ...s, employment: !s.employment }))}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Anställningsstart</Label>
                  <Input type="date" value={editForm.employmentStartDate} onChange={(e) => setEditForm(f => ({ ...f, employmentStartDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Anställning slutar</Label>
                  <Input type="date" placeholder="Lämna tomt om tillsvidare" value={editForm.employmentEndDate} onChange={(e) => setEditForm(f => ({ ...f, employmentEndDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Medborgarskap</Label>
                  <Input placeholder="Svenskt" value={editForm.citizenship} onChange={(e) => setEditForm(f => ({ ...f, citizenship: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Uppehållstillstånd giltigt t.o.m.</Label>
                  <Input type="date" placeholder="Endast om icke-EU/EES" value={editForm.residencePermitExpiry} onChange={(e) => setEditForm(f => ({ ...f, residencePermitExpiry: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Skattetabell</Label>
                  <Input type="number" min={29} max={40} placeholder="Lämna tomt — schablon 30% används" value={editForm.skattetabell} onChange={(e) => setEditForm(f => ({ ...f, skattetabell: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Skatteform</Label>
                  <Select value={editForm.taxScheme} onValueChange={(v) => setEditForm(f => ({ ...f, taxScheme: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TAX_SCHEME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Clearingnummer</Label>
                  <Input pattern="\d{4,5}" placeholder="1234" value={editForm.bankClearing} onChange={(e) => setEditForm(f => ({ ...f, bankClearing: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Kontonummer</Label>
                  <Input placeholder="12 34 56 78" value={editForm.bankAccount} onChange={(e) => setEditForm(f => ({ ...f, bankAccount: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>IBAN</Label>
                <Input pattern="[A-Z]{2}\d{2}.*" placeholder="SE00 0000 0000 0000 0000 0000" value={editForm.iban} onChange={(e) => setEditForm(f => ({ ...f, iban: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Anteckningar</Label>
                <Textarea rows={3} placeholder="Fri text — synlig endast för guardian" value={editForm.notes} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </CollapsibleSection>
          </div>

          <div className="flex justify-end gap-2 mt-4 px-1">
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Avbryt</Button>
            <Button
              disabled={!editForm.name || updateAssistant.isPending}
              onClick={() => updateAssistant.mutate({
                id: editTarget!.id as string,
                data: {
                  name:                  editForm.name,
                  pno:                   editForm.pno,
                  phone:                 editForm.phone,
                  email:                 editForm.email,
                  minWeeklyHours:        parseInt(editForm.minWeeklyHours) || 0,
                  isFlexible:            editForm.isFlexible,
                  address:               editForm.address,
                  addressStreet:         editForm.addressStreet,
                  addressZip:            editForm.addressZip,
                  addressCity:           editForm.addressCity,
                  employmentStartDate:   editForm.employmentStartDate || null,
                  employmentEndDate:     editForm.employmentEndDate   || null,
                  citizenship:           editForm.citizenship,
                  residencePermitExpiry: editForm.residencePermitExpiry || null,
                  notes:                 editForm.notes,
                  skattetabell:          editForm.skattetabell === "" ? null : parseInt(editForm.skattetabell, 10),
                  taxScheme:             editForm.taxScheme,
                  bankClearing:          editForm.bankClearing,
                  bankAccount:           editForm.bankAccount,
                  iban:                  editForm.iban,
                },
              })}
            >
              Spara ändringar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove confirm dialog */}
      <Dialog open={!!removeId} onOpenChange={(o) => !o && setRemoveId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove assistant</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove <strong className="text-foreground">{(assistants as Assistant[]).find((a) => a.id === removeId)?.name as string}</strong>? This won't delete their account.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => setRemoveId(null)}>Cancel</Button>
            <Button variant="reject" onClick={() => deleteAssistant.mutate(removeId!)}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* I'm also an assistant — self-registration dialog */}
      <Dialog open={selfOpen} onOpenChange={(o) => { setSelfOpen(o); if (!o) setSelfError(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register yourself as an assistant</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            This creates an assistant record linked to your account. You'll be able to switch between the guardian view and the assistant view from the sidebar.
          </p>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input
                placeholder="First Last"
                value={selfForm.name}
                onChange={(e) => setSelfForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Personnummer</Label>
                <Input
                  placeholder="ÅÅMMDD-XXXX"
                  value={selfForm.pno}
                  onChange={(e) => setSelfForm((f) => ({ ...f, pno: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="07X-XXX XX XX"
                  value={selfForm.phone}
                  onChange={(e) => setSelfForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Min hours/week</Label>
              <div className="relative">
                <Input
                  type="number"
                  className="pr-8"
                  value={selfForm.minWeeklyHours}
                  onChange={(e) => setSelfForm((f) => ({ ...f, minWeeklyHours: e.target.value }))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selfForm.isFlexible}
                onChange={(e) => setSelfForm((f) => ({ ...f, isFlexible: e.target.checked }))}
                className="rounded"
              />
              <span>Flexible — can take hours from the shared pool</span>
            </label>
            {selfError && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{selfError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => { setSelfOpen(false); setSelfError(null); }}>Cancel</Button>
              <Button
                disabled={!selfForm.name || registerSelfMutation.isPending}
                onClick={() => registerSelfMutation.mutate({
                  name:           selfForm.name,
                  pno:            selfForm.pno,
                  phone:          selfForm.phone,
                  minWeeklyHours: parseInt(selfForm.minWeeklyHours) || 0,
                  isFlexible:     selfForm.isFlexible,
                })}
              >
                {registerSelfMutation.isPending ? "Registering…" : "Register as assistant →"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
