import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { assistantsApi, entriesApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/inputs";
import { PageHeader, AssistantAvatar } from "@/components/shared";
import { ArrowLeft } from "lucide-react";

type Entry = Record<string, string | number | null | undefined>;

function pad(n: number) { return String(n).padStart(2, "0"); }

export default function AssistantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: assistant, isLoading } = useQuery({
    queryKey: ["assistant", id],
    queryFn: () => assistantsApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["entries"],
    queryFn: () => entriesApi.list().then((r) => r.data),
  });

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const monthHours = (entries as Entry[])
    .filter((e) => e.assistantId === id && (e.date as string)?.startsWith(monthStr))
    .reduce((s, e) => s + ((e.hours as number) ?? 0), 0);

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">Loading…</div>
  );

  if (!assistant) return (
    <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">Assistant not found.</div>
  );

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/assistants")} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to assistants
        </Button>
      </div>

      <PageHeader title={assistant.name} description={assistant.email || "Personal assistant"} />

      <div className="grid grid-cols-2 gap-4 mt-6">
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <AssistantAvatar name={assistant.name} initials={assistant.initials} color={assistant.color} size={48} />
              <div>
                <p className="text-sm font-semibold">{assistant.name}</p>
                <Badge variant="success" className="text-[10px] mt-1">● Active</Badge>
              </div>
            </div>
            <div className="border-t border-border pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{assistant.email || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Personnummer</span>
                <span className="font-mono">{assistant.pno || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span>{assistant.phone || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min hours/week</span>
                <span className="font-mono font-semibold text-blue-400">
                  {assistant.minWeeklyHours}h{assistant.isFlexible ? " +flex" : ""}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Hours this month</p>
            <p className="text-3xl font-bold text-foreground">{monthHours}<span className="text-base font-normal text-muted-foreground ml-1">h</span></p>
            <p className="text-xs text-muted-foreground mt-1">
              {now.toLocaleString("en-GB", { month: "long", year: "numeric" })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
