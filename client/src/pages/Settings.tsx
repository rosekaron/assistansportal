import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileApi, settingsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/inputs";
import { Switch } from "@/components/ui/controls";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/controls";
import { PageHeader, SectionLabel } from "@/components/shared";
import { cn } from "@/lib/utils";

// ── These components are defined OUTSIDE SettingsPage so React doesn't
// ── recreate them on every render (which causes the one-letter-at-a-time bug)

interface FormState {
  guardianName: string; guardianPno: string; guardianEmail: string; guardianPhone: string;
  patientName: string;  patientPno: string;  address: string; city: string; zip: string;
  fkDecisionNo: string; weeklyHours: string;
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

export default function SettingsPage() {
  const qc = useQueryClient();
  const [saved,      setSaved]      = useState(false);
  const [gcalSaved,  setGcalSaved]  = useState(false);
  const [connecting, setConnecting] = useState(false);

  const { data: profile }  = useQuery({ queryKey: ["profile"],  queryFn: () => profileApi.get().then((r) => r.data) });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => settingsApi.get().then((r) => r.data) });

  const [form, setForm] = useState<FormState>({
    guardianName: "", guardianPno: "", guardianEmail: "", guardianPhone: "",
    patientName:  "", patientPno:  "", address: "",       city: "",        zip: "",
    fkDecisionNo: "", weeklyHours: "129",
  });

  const [gcal, setGcal] = useState({
    connected: false, email: "", calendarId: "",
    syncEnabled: true, reminders: true, reminderHours: "24",
  });

  const [sched, setSched] = useState({
    allowSelfBook: true, selfBookApproval: "require-approval", bookingWindowDays: "14",
  });

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
      setSched({
        allowSelfBook:     settings.allow_self_book !== "false",
        selfBookApproval:  settings.self_book_approval  ?? "require-approval",
        bookingWindowDays: settings.booking_window_days ?? "14",
      });
    }
  }, [settings]);

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

  const saveSched = useMutation({
    mutationFn: () => settingsApi.update({
      allow_self_book:     String(sched.allowSelfBook),
      self_book_approval:  sched.selfBookApproval,
      booking_window_days: sched.bookingWindowDays,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  function simulateConnect() {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      const email = form.guardianEmail || "guardian@gmail.com";
      setGcal((g) => ({ ...g, connected: true, email, calendarId: "primary" }));
      settingsApi.update({ gcal_connected: "true", gcal_email: email });
    }, 1800);
  }

  function disconnect() {
    setGcal((g) => ({ ...g, connected: false, email: "", calendarId: "" }));
    settingsApi.update({ gcal_connected: "false", gcal_email: "" });
  }

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account, integrations and care details" />

      {/* Google Calendar */}
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
                <Button variant="ghost" size="sm" onClick={disconnect}>Disconnect</Button>
              ) : (
                <Button size="sm" onClick={simulateConnect} disabled={connecting}>
                  {connecting
                    ? <><span className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Connecting…</>
                    : "Connect Google Calendar"}
                </Button>
              )}
            </div>
          </div>

          {gcal.connected && (
            <div className="border-t border-border pt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Calendar</Label>
                  <Select value={gcal.calendarId} onValueChange={(v) => setGcal((g) => ({ ...g, calendarId: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">{gcal.email} (primary)</SelectItem>
                      <SelectItem value="assistance">Assistance Schedule (shared)</SelectItem>
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
        </CardContent>
      </Card>

      {/* Scheduling */}
      <SectionLabel>Scheduling</SectionLabel>
      <Card className="mb-6">
        <CardContent className="pt-5 space-y-4">
          <ToggleRow
            label="Allow assistants to self-book open slots"
            sub="When enabled, assistants can see and claim available slots directly"
            value={sched.allowSelfBook}
            onChange={(v) => { setSched((s) => ({ ...s, allowSelfBook: v })); saveSched.mutate(); }}
          />
          {sched.allowSelfBook && (
            <div className="ml-10 pl-4 border-l-2 border-border space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">When an assistant self-books</p>
                {[
                  { val: "require-approval", label: "Require your approval",   sub: "You review each booking before it's confirmed" },
                  { val: "auto-confirm",     label: "Auto-confirm",            sub: "Bookings are immediately confirmed without review" },
                ].map((opt) => (
                  <label key={opt.val} className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio" value={opt.val}
                      checked={sched.selfBookApproval === opt.val}
                      onChange={() => { setSched((s) => ({ ...s, selfBookApproval: opt.val })); saveSched.mutate(); }}
                      className="mt-1 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.sub}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>Booking window</Label>
                <Select
                  value={sched.bookingWindowDays}
                  onValueChange={(v) => { setSched((s) => ({ ...s, bookingWindowDays: v })); saveSched.mutate(); }}
                >
                  <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["7","14","21","28"].map((d) => (
                      <SelectItem key={d} value={d}>Up to {d} days in advance</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile */}
      <SectionLabel>Account & care details</SectionLabel>
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guardian / Legal representative</p>
            <SettingsField label="Full name"            field="guardianName"  placeholder="Anna Johansson"  value={form.guardianName}  onChange={setField} />
            <SettingsField label="Personal ID (12 dig)" field="guardianPno"   placeholder="197506021234"    value={form.guardianPno}   onChange={setField} />
            <SettingsField label="Email"                field="guardianEmail" type="email"                  value={form.guardianEmail} onChange={setField} />
            <SettingsField label="Phone"                field="guardianPhone" placeholder="070-123 45 67"   value={form.guardianPhone} onChange={setField} />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardContent className="pt-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">The insured person</p>
              <SettingsField label="Full name"            field="patientName" placeholder="Lucas Johansson" value={form.patientName} onChange={setField} />
              <SettingsField label="Personal ID (12 dig)" field="patientPno"  placeholder="202001011234"   value={form.patientPno}  onChange={setField} />
              <SettingsField label="Street address"       field="address"     placeholder="Storgatan 12"   value={form.address}     onChange={setField} />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <SettingsField label="City" field="city" placeholder="Stockholm" value={form.city} onChange={setField} />
                </div>
                <SettingsField label="Zip" field="zip" placeholder="112 34" value={form.zip} onChange={setField} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Försäkringskassan</p>
              <SettingsField label="Decision number" field="fkDecisionNo" placeholder="2024-FK-001234" value={form.fkDecisionNo} onChange={setField} />
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
    </div>
  );
}
