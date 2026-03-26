import { cn } from "@/lib/utils";
import { activityById } from "@/lib/activities";
import { Badge } from "./ui/inputs";

// ── Avatar ────────────────────────────────────────────────────
export function AssistantAvatar({
  name, initials, color, size = 32,
}: { name?: string; initials?: string; color?: string; size?: number }) {
  return (
    <div
      title={name}
      style={{
        width: size, height: size, background: (color ?? "#6366f1") + "33",
        color: color ?? "#6366f1", border: `1.5px solid ${(color ?? "#6366f1")}55`,
        fontSize: size * 0.38,
      }}
      className="rounded-full flex items-center justify-center font-semibold shrink-0 select-none"
    >
      {initials ?? "?"}
    </div>
  );
}

// Overlapping avatar stack for concurrent shifts
export function AvatarStack({
  assistants, size = 26,
}: { assistants: { id: string; initials?: string; color?: string; name?: string }[]; size?: number }) {
  return (
    <div className="flex items-center">
      {assistants.map((a, i) => (
        <div
          key={a.id}
          title={a.name}
          style={{
            width: size, height: size,
            background: (a.color ?? "#6366f1") + "33",
            color: a.color ?? "#6366f1",
            border: `2px solid hsl(var(--card))`,
            fontSize: size * 0.38,
            marginLeft: i > 0 ? -size * 0.3 : 0,
            zIndex: assistants.length - i,
          }}
          className="rounded-full flex items-center justify-center font-semibold shrink-0 relative"
        >
          {a.initials ?? "?"}
        </div>
      ))}
    </div>
  );
}

// ── Activity pill ─────────────────────────────────────────────
export function ActivityPill({
  activityId, showCapacity = false, size = "sm",
}: { activityId?: string | null; showCapacity?: boolean; size?: "sm" | "md" }) {
  if (!activityId) return null;
  const act = activityById(activityId);
  return (
    <span
      style={{ background: act.color + "22", color: act.color, borderColor: act.color + "44" }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      )}
    >
      <span>{act.icon}</span>
      <span>{act.label}</span>
      {showCapacity && act.capacity > 1 && (
        <span style={{ background: act.color + "33" }} className="ml-1 rounded-full px-1 text-[10px] font-bold">
          ×{act.capacity}
        </span>
      )}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────
type ReqStatus = "pending" | "approved" | "rejected";
type RepStatus = "draft" | "pending" | "approved" | "rejected";
type CalStatus = "tentative" | "confirmed" | null | undefined;

export function ReqBadge({ status }: { status: ReqStatus }) {
  const map: Record<ReqStatus, { variant: "warning" | "success" | "destructive"; label: string }> = {
    pending:  { variant: "warning",     label: "Pending" },
    approved: { variant: "success",     label: "Approved" },
    rejected: { variant: "destructive", label: "Rejected" },
  };
  const { variant, label } = map[status] ?? { variant: "warning" as const, label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function RepBadge({ status }: { status: RepStatus }) {
  const map: Record<RepStatus, { variant: "slate" | "warning" | "success" | "destructive"; label: string }> = {
    draft:    { variant: "slate",       label: "Draft" },
    pending:  { variant: "warning",     label: "Pending" },
    approved: { variant: "success",     label: "Approved" },
    rejected: { variant: "destructive", label: "Rejected" },
  };
  const { variant, label } = map[status] ?? { variant: "slate" as const, label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function CalBadge({ status }: { status: CalStatus }) {
  if (!status) return <Badge variant="slate">No event</Badge>;
  if (status === "tentative") return <Badge variant="warning">📅 Tentative</Badge>;
  return <Badge variant="success">📅 Confirmed</Badge>;
}

// ── Page header ───────────────────────────────────────────────
export function PageHeader({
  title, description, action,
}: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </p>
  );
}

// ── Empty state ───────────────────────────────────────────────
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">{message}</div>
  );
}

// ── Hours fill bar ────────────────────────────────────────────
export function FillBar({ filled, capacity }: { filled: number; capacity: number }) {
  const pct = Math.min(100, Math.round((filled / capacity) * 100));
  const full = filled >= capacity;
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", full ? "bg-emerald-500" : filled > 0 ? "bg-blue-500" : "bg-slate-600")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-xs font-mono tabular-nums", full ? "text-emerald-400" : filled > 0 ? "text-blue-400" : "text-muted-foreground")}>
        {filled}/{capacity}
      </span>
    </div>
  );
}
