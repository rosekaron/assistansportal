import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { profileApi, assistantsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/inputs";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const COLORS = ["#6366f1","#0891b2","#059669","#d97706","#dc2626","#7c3aed","#0e7490","#b45309"];
const STEPS  = ["Guardian","Child & FK","Assistants","Done"];

interface AssistantRow {
  name: string; email: string; minWeeklyHours: string; isFlexible: boolean; color: string;
}

// ── Moved OUTSIDE component so React doesn't recreate it on every render ──
interface ProfileForm {
  guardianName: string; guardianPno: string; guardianEmail: string; guardianPhone: string;
  patientName: string;  patientPno: string;  address: string; city: string; zip: string;
  fkDecisionNo: string; weeklyHours: string;
}

function ProfileField({
  label, field, type = "text", placeholder = "", value, onChange,
}: {
  label: string;
  field: keyof ProfileForm;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (field: keyof ProfileForm, value: string) => void;
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

export default function SetupWizard() {
  const [step,   setStep]   = useState(0);
  const [saving, setSaving] = useState(false);
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [profile, setProfile] = useState<ProfileForm>({
    guardianName: "", guardianPno: "", guardianEmail: "", guardianPhone: "",
    patientName:  "", patientPno:  "", address: "",      city: "",        zip: "",
    fkDecisionNo: "", weeklyHours: "129",
  });

  const [rows, setRows] = useState<AssistantRow[]>([
    { name: "", email: "", minWeeklyHours: "", isFlexible: false, color: COLORS[0] },
  ]);

  const weekly   = parseInt(profile.weeklyHours) || 129;
  const totalMin = rows.reduce((s, r) => s + (parseInt(r.minWeeklyHours) || 0), 0);
  const pool     = weekly - totalMin;

  function setField(field: keyof ProfileForm, value: string) {
    setProfile((p) => ({ ...p, [field]: value }));
  }

  function addRow() {
    setRows((r) => [...r, { name: "", email: "", minWeeklyHours: "", isFlexible: false, color: COLORS[r.length % COLORS.length] }]);
  }
  function updateRow(i: number, field: keyof AssistantRow, val: string | boolean) {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function finish() {
    setSaving(true);
    try {
      await profileApi.update({ ...profile, weeklyHours: weekly, setup_done: true });
      for (const row of rows.filter((r) => r.name.trim())) {
        await assistantsApi.create({
          name: row.name, email: row.email,
          minWeeklyHours: parseInt(row.minWeeklyHours) || 0,
          isFlexible: row.isFlexible,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["assistants"] });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-8">

        {/* Logo */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-base font-semibold">Assistansportal</span>
          </div>
          <p className="text-sm text-muted-foreground">Let's get you set up — takes about 2 minutes</p>
          <button onClick={() => navigate("/dashboard")} className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Skip for now, go to dashboard
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all",
                  step > i   ? "bg-primary border-primary text-primary-foreground"
                  : step === i ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground"
                )}>
                  {step > i ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={cn("text-[11px]", step === i ? "text-primary font-medium" : "text-muted-foreground")}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-2 mb-4 transition-all", step > i ? "bg-primary" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">

            {/* Step 0: Guardian */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold text-foreground">About you</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Your details as the legal guardian</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ProfileField label="Full name *"          field="guardianName"  placeholder="Anna Johansson"    value={profile.guardianName}  onChange={setField} />
                  <ProfileField label="Personal ID (12 dig)" field="guardianPno"   placeholder="197506021234"      value={profile.guardianPno}   onChange={setField} />
                  <ProfileField label="Email *"              field="guardianEmail" type="email" placeholder="anna@example.com" value={profile.guardianEmail} onChange={setField} />
                  <ProfileField label="Phone"                field="guardianPhone" placeholder="070-123 45 67"     value={profile.guardianPhone} onChange={setField} />
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => setStep(1)} disabled={!profile.guardianName || !profile.guardianEmail}>
                    Next: Child details →
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: Child + FK */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold">Child & Försäkringskassan</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">The person receiving assistance</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ProfileField label="Child's full name *"  field="patientName" placeholder="Lucas Johansson" value={profile.patientName} onChange={setField} />
                  <ProfileField label="Personal ID (12 dig)" field="patientPno"  placeholder="202001011234"    value={profile.patientPno}  onChange={setField} />
                </div>
                <ProfileField label="Street address" field="address" placeholder="Storgatan 12" value={profile.address} onChange={setField} />
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <ProfileField label="City" field="city" placeholder="Stockholm" value={profile.city} onChange={setField} />
                  </div>
                  <ProfileField label="Postal code" field="zip" placeholder="112 34" value={profile.zip} onChange={setField} />
                </div>
                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">FK Decision</p>
                  <div className="grid grid-cols-2 gap-3">
                    <ProfileField label="Decision number *" field="fkDecisionNo" placeholder="2024-FK-001234" value={profile.fkDecisionNo} onChange={setField} />
                    <div className="space-y-1.5">
                      <Label>Weekly hours granted *</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={profile.weeklyHours}
                          onChange={(e) => setField("weeklyHours", e.target.value)}
                          className="pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h/wk</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
                  <Button onClick={() => setStep(2)} disabled={!profile.patientName || !profile.fkDecisionNo}>
                    Next: Assistants →
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Assistants */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold">Your assistants</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Add all assistants sharing the {weekly}h/week</p>
                </div>

                {/* Budget bar */}
                <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Weekly budget</span>
                    <span className={cn("font-mono font-medium",
                      pool < 0 ? "text-destructive" : pool === 0 ? "text-emerald-400" : "text-blue-400"
                    )}>
                      {totalMin}/{weekly}h · {pool >= 0 ? `${pool}h pool` : `${Math.abs(pool)}h over`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all",
                        pool < 0 ? "bg-destructive" : pool === 0 ? "bg-emerald-500" : "bg-blue-500"
                      )}
                      style={{ width: `${Math.min(100, (totalMin / weekly) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Assistant rows */}
                <div className="space-y-2">
                  {rows.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_80px_auto_auto] gap-2 items-center">
                      <div className="relative">
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: row.color }} />
                        <Input
                          placeholder="Full name"
                          value={row.name}
                          className="pl-7"
                          onChange={(e) => updateRow(i, "name", e.target.value)}
                        />
                      </div>
                      <Input
                        type="email"
                        placeholder="email"
                        value={row.email}
                        onChange={(e) => updateRow(i, "email", e.target.value)}
                      />
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="h/wk"
                          value={row.minWeeklyHours}
                          className="pr-6"
                          onChange={(e) => updateRow(i, "minWeeklyHours", e.target.value)}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">h</span>
                      </div>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={row.isFlexible}
                          onChange={(e) => updateRow(i, "isFlexible", e.target.checked)}
                          className="rounded border-border"
                        />
                        flex
                      </label>
                      {rows.length > 1 && (
                        <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-foreground text-base leading-none">✕</button>
                      )}
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="sm" onClick={addRow}>+ Add assistant</Button>
                <p className="text-[11px] text-muted-foreground">
                  <strong className="text-foreground">flex</strong> = can take hours from the shared pool beyond their minimum
                </p>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
                  <Button onClick={() => setStep(3)}>Review →</Button>
                </div>
              </div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <div className="text-center space-y-4 py-2">
                <div className="text-4xl">✅</div>
                <div>
                  <h2 className="text-lg font-semibold">You're all set!</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Managing assistance for <strong className="text-foreground">{profile.patientName}</strong> ·{" "}
                    <strong className="text-primary">{weekly}h/week</strong> granted by FK
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {rows.filter((r) => r.name).map((r, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-secondary rounded-lg px-3 py-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                      <span className="text-foreground">{r.name}</span>
                      <span className="text-muted-foreground">{r.minWeeklyHours || "?"}h{r.isFlexible ? "+" : ""}</span>
                    </span>
                  ))}
                </div>
                <Button className="px-8" onClick={finish} disabled={saving}>
                  {saving ? "Saving…" : "Enter the portal →"}
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
