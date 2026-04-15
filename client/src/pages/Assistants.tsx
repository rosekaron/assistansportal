import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assistantsApi, invitesApi, profileApi, absenceApi } from "@/lib/api";
import type { AbsenceBalance } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Badge, Textarea, Separator } from "@/components/ui/inputs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, AssistantAvatar, SectionLabel, EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";
import { UserPlus, X, Pencil } from "lucide-react";

type Assistant = Record<string, string | number | boolean | null>;
type Invite    = Record<string, string | number | boolean | null>;

function AssistantAbsenceSummary({ assistantId }: { assistantId: string }) {
  const year = new Date().getFullYear();
  const { data: balance, isLoading } = useQuery<AbsenceBalance>({
    queryKey: ["absences", "balance", assistantId],
    queryFn:  () => absenceApi.balance(assistantId).then((r) => r.data),
  });

  const vabRemaining = isLoading ? null : (balance?.vabRemaining ?? 120);
  const sickDays     = isLoading ? null : (balance?.sickDays ?? 0);

  const vabColorClass =
    vabRemaining === null ? "text-muted-foreground" :
    vabRemaining >= 30    ? "text-emerald-600" :
    vabRemaining >= 10    ? "text-amber-600" :
    "text-red-600";

  return (
    <>
      <Separator className="my-3" />
      <SectionLabel>Absence {year}</SectionLabel>
      <div className="flex gap-6 text-sm">
        <span>
          <span className="text-muted-foreground">VAB remaining: </span>
          <span className={cn("font-semibold", vabColorClass)}>
            {vabRemaining === null ? "--" : `${vabRemaining} days`}
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">Sick leave: </span>
          <span className="font-semibold">
            {sickDays === null ? "--" : `${sickDays} days`}
          </span>
        </span>
      </div>
    </>
  );
}

export default function AssistantsPage() {
  const qc = useQueryClient();
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [removeId,    setRemoveId]    = useState<string | null>(null);
  const [editTarget,  setEditTarget]  = useState<Assistant | null>(null);
  const [editForm,    setEditForm]    = useState({ name: "", pno: "", phone: "", minWeeklyHours: "", isFlexible: false });
  const [inviteForm,  setInviteForm]  = useState({ name: "", email: "", minWeeklyHours: "", isFlexible: false, message: "" });
  const [inviteSent,  setInviteSent]  = useState(false);
  const [selfOpen,    setSelfOpen]    = useState(false);
  const [selfForm,    setSelfForm]    = useState({ name: "", pno: "", phone: "", minWeeklyHours: "", isFlexible: false });
  const [selfError,   setSelfError]   = useState<string | null>(null);

  const { data: profile }      = useQuery({ queryKey: ["profile"],    queryFn: () => profileApi.get().then((r) => r.data) });
  const { data: assistants = [] } = useQuery({ queryKey: ["assistants"], queryFn: () => assistantsApi.list().then((r) => r.data) });
  const { data: invites = [] }    = useQuery({ queryKey: ["invites"],    queryFn: () => invitesApi.list().then((r) => r.data) });

  const weekly   = profile?.weeklyHours ?? 129;
  const totalMin = (assistants as Assistant[]).reduce((s, a) => s + ((a.minWeeklyHours as number) ?? 0), 0);
  const pool     = weekly - totalMin;

  const deleteAssistant = useMutation({
    mutationFn: (id: string) => assistantsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assistants"] }); setRemoveId(null); },
  });

  const updateAssistant = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => assistantsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assistants"] }); setEditTarget(null); },
  });

  function openEdit(a: Assistant) {
    setEditForm({
      name:           (a.name as string) ?? "",
      pno:            (a.pno  as string) ?? "",
      phone:          (a.phone as string) ?? "",
      minWeeklyHours: String(a.minWeeklyHours ?? 0),
      isFlexible:     (a.isFlexible as boolean) ?? false,
    });
    setEditTarget(a);
  }

  const sendInvite = useMutation({
    mutationFn: (data: Record<string, unknown>) => invitesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invites"] }); setInviteSent(true); setTimeout(() => { setInviteSent(false); setInviteOpen(false); setInviteForm({ name: "", email: "", minWeeklyHours: "", isFlexible: false, message: "" }); }, 1800); },
  });

  const registerSelf = useMutation({
    mutationFn: (data: Record<string, unknown>) => assistantsApi.registerSelf(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistants"] });
      setSelfOpen(false);
      setSelfForm({ name: "", pno: "", phone: "", minWeeklyHours: "", isFlexible: false });
      setSelfError(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSelfError(msg ?? "Registration failed. You may already be registered as an assistant.");
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

  // Simulate accept for demo
  const acceptInvite = useMutation({
    mutationFn: async (invite: Invite) => {
      await assistantsApi.create({ name: invite.name, email: invite.email, minWeeklyHours: invite.minWeeklyHours, isFlexible: invite.isFlexible });
      await invitesApi.delete(invite.id as string);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assistants"] }); qc.invalidateQueries({ queryKey: ["invites"] }); },
  });

  const pendingCount = (invites as Invite[]).filter((i) => i.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Assistants"
        description="Manage your personal assistants and pending invitations"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setSelfError(null); setSelfOpen(true); }}>
              I'm also an assistant
            </Button>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="w-4 h-4" />Add assistant
            </Button>
          </div>
        }
      />

      {/* Weekly budget */}
      <Card className="mb-6">
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

      {/* Active assistants */}
      <SectionLabel>Active assistants ({(assistants as Assistant[]).length})</SectionLabel>
      {(assistants as Assistant[]).length === 0 ? (
        <EmptyState message="No active assistants yet — send an invite below" />
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-8">
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
                  <Badge variant="success" className="text-[10px]">● Active</Badge>
                  <AssistantAbsenceSummary assistantId={a.id as string} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invitations */}
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
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
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

      {/* Self-registration dialog */}
      <Dialog open={selfOpen} onOpenChange={(o) => { if (!registerSelf.isPending) { setSelfOpen(o); if (!o) { setSelfError(null); } } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Register yourself as an assistant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">As the guardian, you can also act as a personal assistant. Fill in your details to register yourself — no invite email needed.</p>
            <div className="space-y-1.5"><Label>Full name *</Label><Input placeholder="First Last" value={selfForm.name} onChange={(e) => setSelfForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Personnummer *</Label>
                <Input placeholder="ÅÅMMDD-XXXX" value={selfForm.pno} onChange={(e) => setSelfForm((f) => ({ ...f, pno: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="07X-XXX XX XX" value={selfForm.phone} onChange={(e) => setSelfForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Min hours/week *</Label>
              <div className="relative">
                <Input type="number" placeholder="20" className="pr-8" value={selfForm.minWeeklyHours} onChange={(e) => setSelfForm((f) => ({ ...f, minWeeklyHours: e.target.value }))} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={selfForm.isFlexible} onChange={(e) => setSelfForm((f) => ({ ...f, isFlexible: e.target.checked }))} className="rounded" />
              <span>Flexible — can take hours from the shared pool</span>
            </label>
            {selfError && (
              <p className="text-sm text-destructive">{selfError}</p>
            )}
            <Button
              className="w-full"
              disabled={!selfForm.name || !selfForm.pno || !selfForm.minWeeklyHours || registerSelf.isPending}
              onClick={() => registerSelf.mutate({ name: selfForm.name, pno: selfForm.pno, phone: selfForm.phone, minWeeklyHours: parseInt(selfForm.minWeeklyHours), isFlexible: selfForm.isFlexible })}
            >
              {registerSelf.isPending ? "Registering…" : "Register as assistant →"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add assistant / identity verification dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => !inviteSent && setInviteOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add a personal assistant</DialogTitle></DialogHeader>
          {inviteSent ? (
            <div className="text-center py-6 space-y-2">
              <div className="text-4xl">✉️</div>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit assistant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Full name *</Label><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Personnummer</Label>
                <Input placeholder="ÅÅMMDD-XXXX" value={editForm.pno} onChange={(e) => setEditForm((f) => ({ ...f, pno: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="07X-XXX XX XX" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Min hours/week</Label>
              <div className="relative">
                <Input type="number" className="pr-8" value={editForm.minWeeklyHours} onChange={(e) => setEditForm((f) => ({ ...f, minWeeklyHours: e.target.value }))} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={editForm.isFlexible} onChange={(e) => setEditForm((f) => ({ ...f, isFlexible: e.target.checked }))} className="rounded" />
              <span>Flexible — can take hours from the shared pool</span>
            </label>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button disabled={!editForm.name || updateAssistant.isPending}
                onClick={() => updateAssistant.mutate({ id: editTarget!.id as string, data: { name: editForm.name, pno: editForm.pno, phone: editForm.phone, minWeeklyHours: parseInt(editForm.minWeeklyHours), isFlexible: editForm.isFlexible } })}>
                Save changes
              </Button>
            </div>
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
    </div>
  );
}
