import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assistantsApi, payrollApi, paymentsApi } from "@/lib/api";
import type { PayrollRecord, Payment } from "@/lib/api";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Badge, Separator } from "@/components/ui/inputs";
import { PageHeader, SectionLabel, EmptyState, AssistantAvatar } from "@/components/shared";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Format SEK amount using sv-SE locale. Output: "15 234 kr" or "15 234,50 kr" */
function formatSek(amount: number): string {
  const formatted = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} kr`;
}

/** Format hours: integer or one decimal, no space before "h". E.g. "87h" or "87,5h" */
function formatHours(hours: number): string {
  const val = Number.isInteger(hours) ? hours : parseFloat(hours.toFixed(1));
  return `${String(val).replace(".", ",")}h`;
}

/** Parse absenceBreakdownJson into a display string.
 *  Input: '{"sjukfrånvaro":8,"vab":0,"semester":16,"other":0}'
 *  Output: "sjukfrånvaro 8h, semester 16h" (omit types with 0 hours; "0h" if all zero)
 */
function formatAbsenceBreakdown(json: string | null): string {
  if (!json) return "0h";
  try {
    const breakdown = JSON.parse(json) as Record<string, number>;
    const parts = Object.entries(breakdown)
      .filter(([, h]) => h > 0)
      .map(([type, h]) => `${type} ${formatHours(h)}`);
    return parts.length > 0 ? parts.join(", ") : "0h";
  } catch {
    return "0h";
  }
}

/** YYYY-MM month helpers */
function monthLabel(month: string): string {
  const [year, mon] = month.split("-");
  const d = new Date(parseInt(year), parseInt(mon) - 1, 1);
  return d.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
}

function prevMonth(month: string): string {
  const [year, mon] = month.split("-");
  const d = new Date(parseInt(year), parseInt(mon) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(month: string): string {
  const [year, mon] = month.split("-");
  const d = new Date(parseInt(year), parseInt(mon), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function PayrollCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Laddar löneunderlag..."
      className="animate-pulse bg-muted rounded-xl h-48 w-full"
    />
  );
}

type AssistantPayrollCardProps = {
  record: PayrollRecord;
  assistantName: string;
  assistantInitials?: string;
  assistantColor?: string;
};

function AssistantPayrollCard({
  record,
  assistantName,
  assistantInitials,
  assistantColor,
}: AssistantPayrollCardProps) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newMethod, setNewMethod] = useState<"bankgiro" | "swish" | "kontant">("bankgiro");

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["payments", record.id],
    queryFn:  () => paymentsApi.list(record.id).then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: () => payrollApi.approve(record.id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["payroll"] }),
  });

  const createPaymentMutation = useMutation({
    mutationFn: () => paymentsApi.create({
      payrollRecordId: record.id,
      assistantId:     record.assistantId,
      date:            newDate,
      amountSek:       parseFloat(newAmount.replace(",", ".")),
      method:          newMethod,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", record.id] });
      setNewDate(""); setNewAmount(""); setNewMethod("bankgiro");
      setShowAddForm(false);
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.delete(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["payments", record.id] }),
  });

  const totalPaid = payments.reduce((sum, p) => sum + p.amountSek, 0);
  const outstanding = Math.max(0, record.grossPay - totalPaid);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <AssistantAvatar name={assistantName} initials={assistantInitials} color={assistantColor} size={36} />
          <div>
            <h3 className="text-xl font-semibold text-foreground">{assistantName}</h3>
            {record.status === "draft"
              ? <Badge variant="slate">Utkast</Badge>
              : <Badge variant="success">Godkänd</Badge>
            }
          </div>
        </div>
        {record.status === "draft" ? (
          <Button
            variant="default"
            size="sm"
            disabled={approveMutation.isPending}
            onClick={() => approveMutation.mutate()}
            className={cn(approveMutation.isPending && "opacity-50")}
          >
            {approveMutation.isPending ? "..." : "Godkänn"}
          </Button>
        ) : (
          <Button
            variant="approve"
            size="sm"
            disabled
            aria-label="Löneunderlag godkänt"
          >
            Godkänd ✓
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stat grid — 5 columns */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: "Fakturerbara timmar", value: formatHours(record.billableHours) },
            { label: "Frånvarotimmar",      value: formatAbsenceBreakdown(record.absenceBreakdownJson) },
            { label: "Bruttolön",           value: <span aria-label={`${Math.round(record.grossPay)} kronor`}>{formatSek(record.grossPay)}</span> },
            { label: `Arbetsgivaravgift (${String((record.taxRateSnapshot * 100).toFixed(2)).replace(".", ",")}%)`, value: <span aria-label={`${Math.round(record.employerContributions)} kronor`}>{formatSek(record.employerContributions)}</span> },
            { label: "Total kostnad",       value: <span aria-label={`${Math.round(record.totalEmployerCost)} kronor`}>{formatSek(record.totalEmployerCost)}</span> },
          ].map(({ label, value }) => (
            <div key={label} className="bg-secondary rounded-lg p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
              <p className="text-xl font-semibold font-mono tabular-nums text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Payment history */}
        <SectionLabel>Betalningar</SectionLabel>
        {payments.length === 0 ? (
          <EmptyState message="Inga betalningar registrerade ännu." />
        ) : (
          <ul className="space-y-1">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm group">
                <span className="font-mono tabular-nums">{p.date}</span>
                <span className="font-mono tabular-nums">{formatSek(p.amountSek)}</span>
                <Badge variant="slate">{p.method}</Badge>
                <button
                  onClick={() => {
                    if (window.confirm(`Ta bort den här betalningen på ${formatSek(p.amountSek)}? Det går inte att ångra.`)) {
                      deletePaymentMutation.mutate(p.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                  aria-label={`Ta bort betalning ${formatSek(p.amountSek)}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add payment toggle + form */}
        <Button variant="ghost" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          Lägg till betalning
        </Button>

        {showAddForm && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor={`date-${record.id}`}>Datum</Label>
                <Input
                  id={`date-${record.id}`}
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`amount-${record.id}`}>Belopp (SEK)</Label>
                <Input
                  id={`amount-${record.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`method-${record.id}`}>Metod</Label>
                <select
                  id={`method-${record.id}`}
                  value={newMethod}
                  onChange={(e) => setNewMethod(e.target.value as "bankgiro" | "swish" | "kontant")}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="bankgiro">Bankgiro</option>
                  <option value="swish">Swish</option>
                  <option value="kontant">Kontant</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                disabled={!newDate || !newAmount || createPaymentMutation.isPending}
                onClick={() => createPaymentMutation.mutate()}
              >
                {createPaymentMutation.isPending ? "..." : "Spara betalning"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowAddForm(false); setNewDate(""); setNewAmount(""); }}>
                Avbryt
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <p className={cn(
          "text-sm font-mono",
          outstanding === 0 ? "text-emerald-700" : "text-amber-700"
        )}>
          Utestående saldo:{" "}
          <span aria-label={`${Math.round(outstanding)} kronor`}>
            {outstanding === 0 ? "Betald i sin helhet" : formatSek(outstanding)}
          </span>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function PayrollPage() {
  const [month, setMonth] = useState(currentMonth());
  const queryClient = useQueryClient();

  const { data: assistants = [] } = useQuery({
    queryKey: ["assistants"],
    queryFn:  () => assistantsApi.list().then((r) => r.data),
  });

  const { data: records, isLoading } = useQuery<PayrollRecord[]>({
    queryKey: ["payroll", month],
    queryFn:  () => payrollApi.list(month).then((r) => r.data),
  });

  const generateMutation = useMutation({
    mutationFn: () => payrollApi.generate(month),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["payroll", month] }),
  });

  const monthSelector = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => setMonth(prevMonth(month))}>
        <ChevronLeft size={16} />
      </Button>
      <span className="text-sm font-semibold text-foreground min-w-[140px] text-center capitalize">
        {monthLabel(month)}
      </span>
      <Button variant="ghost" size="icon" onClick={() => setMonth(nextMonth(month))}>
        <ChevronRight size={16} />
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Löneunderlag"
        description="Månatlig lönekalkyl per assistent"
        action={monthSelector}
      />

      {isLoading ? (
        <div className="space-y-6">
          <PayrollCardSkeleton />
          <PayrollCardSkeleton />
        </div>
      ) : !records || records.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <EmptyState message="Inga löneunderlag för denna månad" />
          <Button
            variant="default"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? "Genererar..." : "Generera löneunderlag"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {records.map((record) => {
            const asst = assistants.find((a: { id: string; name: string; initials?: string; color?: string }) => a.id === record.assistantId);
            return (
              <AssistantPayrollCard
                key={record.id}
                record={record}
                assistantName={asst?.name ?? record.assistantId}
                assistantInitials={asst?.initials}
                assistantColor={asst?.color}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
