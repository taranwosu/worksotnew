import { useEffect, useState } from "react";
import { Loader2, Plus, ChevronRight, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminListManagedClients,
  adminCreateManagedClient,
  adminUpdateManagedClient,
  adminListCharges,
  adminAddCharge,
  adminSetChargeStatus,
  adminDeleteCharge,
  type ManagedClientRow,
  type ManagedCharge,
} from "@/lib/api";
import { Button, Tag } from "@/components/primitives";
import { cn } from "@/lib/utils";

export function AdminClientsTab({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<ManagedClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminListManagedClients());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const changed = () => { load(); onChanged?.(); };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-cream/40" /></div>;
  }

  return (
    <div data-testid="admin-clients-tab">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-cream/70">
          {rows.length} managed client{rows.length === 1 ? "" : "s"} — billed off-platform; charges are logged here.
        </p>
        <Button tone="sun" size="sm" onClick={() => setCreating((v) => !v)} data-testid="client-add-toggle">
          <Plus className="h-3.5 w-3.5" /> {creating ? "Close" : "New managed client"}
        </Button>
      </div>

      {creating && <NewClientForm onCreated={() => { setCreating(false); changed(); }} />}

      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded border border-cream/10 p-8 text-center text-[13px] text-cream/60">
            No managed clients yet.
          </div>
        ) : rows.map((r) => (
          <ClientCard
            key={r.client.id}
            row={r}
            open={openId === r.client.id}
            onToggle={() => setOpenId((p) => (p === r.client.id ? null : r.client.id))}
            onChanged={changed}
          />
        ))}
      </div>
    </div>
  );
}

const inputCls = "mt-1 w-full rounded border border-cream/15 bg-ink px-3 py-2 text-[13px] text-cream placeholder:text-cream/40";
const labelCls = "block text-[11px] uppercase tracking-[0.14em] text-cream/60";

function NewClientForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [planType, setPlanType] = useState<"monthly_retainer" | "per_task">("monthly_retainer");
  const [planRate, setPlanRate] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      await adminCreateManagedClient({
        owner_email: email,
        company_name: company,
        plan_type: planType,
        plan_rate: Number(planRate),
        plan_notes: planNotes || undefined,
      });
      toast.success(`${company} set up on the managed plan`);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create client");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded border border-cream/10 bg-ink-2 p-5" data-testid="client-create-form">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-cream/60">New managed client</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelCls}>Owner account email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ops@company.com" data-testid="client-owner-email" className={inputCls} />
          <p className="mt-1 text-[11px] text-cream/50">Must be an existing WorkSoy account — this login gets the client portal.</p>
        </div>
        <div>
          <label className={labelCls}>Company name</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} data-testid="client-company" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Plan</label>
          <select value={planType} onChange={(e) => setPlanType(e.target.value as typeof planType)} className={inputCls}>
            <option value="monthly_retainer">Monthly retainer</option>
            <option value="per_task">Per task</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{planType === "monthly_retainer" ? "Monthly rate ($)" : "Rate per task ($)"}</label>
          <input type="number" min={1} value={planRate} onChange={(e) => setPlanRate(e.target.value)} data-testid="client-plan-rate" className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Plan notes (visible to client)</label>
          <input value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} placeholder="e.g. Includes up to 8 design tasks / month" className={inputCls} />
        </div>
      </div>
      <Button tone="sun" size="sm" className="mt-4" disabled={busy || !email || !company || !planRate} onClick={create} data-testid="client-create-confirm">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create client
      </Button>
    </div>
  );
}

function ClientCard({
  row,
  open,
  onToggle,
  onChanged,
}: {
  row: ManagedClientRow;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const c = row.client;
  const [busy, setBusy] = useState(false);

  const setStatus = async (status: "active" | "paused" | "churned") => {
    setBusy(true);
    try {
      await adminUpdateManagedClient(c.id, { status });
      toast.success(`${c.company_name} marked ${status}`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border border-cream/10 bg-ink-2" data-testid={`client-${c.id}`}>
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <div className="min-w-0">
          <p className="truncate font-display text-[14px] font-semibold text-cream">{c.company_name}</p>
          <p className="truncate text-[11.5px] text-cream/60">
            {row.owner?.email} · {c.plan_type === "monthly_retainer" ? `$${c.plan_rate.toLocaleString()}/mo retainer` : `$${c.plan_rate.toLocaleString()}/task`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {row.billing.unpaid > 0 && (
            <span className="font-mono text-[11px] text-rust">${row.billing.unpaid.toLocaleString()} unpaid</span>
          )}
          <span className="font-mono text-[11px] text-cream/60">${row.billing.paid.toLocaleString()} collected</span>
          {row.open_tasks > 0 && <Tag tone="sun" size="sm">{row.open_tasks} open</Tag>}
          <Tag tone={c.status === "active" ? "moss" : c.status === "paused" ? "sun" : "rust"} size="sm">{c.status}</Tag>
          <ChevronRight className={cn("h-4 w-4 text-cream/50 transition-transform", open && "rotate-90")} />
        </div>
      </button>

      {open && (
        <div className="border-t border-cream/10 p-5">
          <ChargesLedger clientId={c.id} onChanged={onChanged} />
          <div className="mt-4 flex flex-wrap gap-2">
            {c.status !== "active" && (
              <Button tone="outline" size="sm" disabled={busy} onClick={() => setStatus("active")}>Reactivate</Button>
            )}
            {c.status === "active" && (
              <Button tone="outline" size="sm" disabled={busy} onClick={() => setStatus("paused")} data-testid={`client-pause-${c.id}`}>Pause plan</Button>
            )}
            {c.status !== "churned" && (
              <Button tone="outline" size="sm" disabled={busy} onClick={() => setStatus("churned")}>Mark churned</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChargesLedger({ clientId, onChanged }: { clientId: string; onChanged: () => void }) {
  const [charges, setCharges] = useState<ManagedCharge[] | null>(null);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    adminListCharges(clientId).then(setCharges).catch(() => setCharges([]));
  };
  useEffect(load, [clientId]);

  const add = async () => {
    setBusy(true);
    try {
      await adminAddCharge(clientId, {
        description: desc,
        amount: Number(amount),
        due_date: due ? new Date(due).toISOString() : undefined,
      });
      setDesc(""); setAmount(""); setDue("");
      toast.success("Charge logged");
      load(); onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log charge");
    } finally {
      setBusy(false);
    }
  };

  const setChargeStatus = async (id: string, status: "unpaid" | "paid") => {
    await adminSetChargeStatus(id, status);
    load(); onChanged();
  };

  const remove = async (id: string) => {
    await adminDeleteCharge(id);
    load(); onChanged();
  };

  const overdue = (ch: ManagedCharge) =>
    ch.status === "unpaid" && ch.due_date && new Date(ch.due_date) < new Date();

  return (
    <div className="rounded border border-cream/10 bg-ink p-4" data-testid={`charges-${clientId}`}>
      <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-cream/60">
        <Receipt className="h-3.5 w-3.5" /> Charges (billed off-platform)
      </p>
      {charges === null ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-cream/40" /></div>
      ) : charges.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-cream/50">No charges logged yet.</p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {charges.map((ch) => (
            <div key={ch.id} className="flex items-center gap-3 rounded border border-cream/10 px-3 py-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate text-cream/90">{ch.description}</span>
              {overdue(ch) && <Tag tone="rust" size="sm">overdue</Tag>}
              <span className="font-mono text-cream">${ch.amount.toLocaleString()}</span>
              <Tag tone={ch.status === "paid" ? "moss" : "outline"} size="sm">{ch.status}</Tag>
              {ch.status === "unpaid" ? (
                <button onClick={() => setChargeStatus(ch.id, "paid")} data-testid={`charge-paid-${ch.id}`} className="rounded border border-cream/20 px-2 py-1 text-[11px] font-semibold text-cream hover:bg-cream/10">
                  Mark paid
                </button>
              ) : (
                <button onClick={() => setChargeStatus(ch.id, "unpaid")} className="rounded border border-cream/20 px-2 py-1 text-[11px] text-cream/70 hover:bg-cream/10">
                  Undo
                </button>
              )}
              <button onClick={() => remove(ch.id)} aria-label="Delete charge" className="text-cream/40 hover:text-rust">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_120px_170px_auto]">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="June retainer" data-testid="charge-desc" className="rounded border border-cream/15 bg-ink-2 px-3 py-2 text-[12.5px] text-cream placeholder:text-cream/40" />
        <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$" data-testid="charge-amount" className="rounded border border-cream/15 bg-ink-2 px-3 py-2 text-[12.5px] text-cream placeholder:text-cream/40" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded border border-cream/15 bg-ink-2 px-3 py-2 text-[12.5px] text-cream" />
        <Button tone="outline" size="sm" disabled={busy || !desc || !amount} onClick={add} data-testid="charge-add">
          Log charge
        </Button>
      </div>
    </div>
  );
}
