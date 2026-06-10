import { useEffect, useState } from "react";
import { Loader2, UserPlus, Star, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import {
  adminListPool,
  adminListPoolEligible,
  adminAddPoolMember,
  adminUpdatePoolMember,
  adminSetPoolMemberStatus,
  type PoolMemberRow,
  type EligibleExpert,
} from "@/lib/api";
import { Button, Tag } from "@/components/primitives";
import { cn } from "@/lib/utils";

export function AdminPoolTab() {
  const [rows, setRows] = useState<PoolMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminListPool());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-cream/40" /></div>;
  }

  return (
    <div data-testid="admin-pool-tab">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-cream/70">
          {rows.length} pool member{rows.length === 1 ? "" : "s"} — vetted freelancers WorkSoy manages as contractors.
        </p>
        <Button tone="sun" size="sm" onClick={() => setAdding((v) => !v)} data-testid="pool-add-toggle">
          <UserPlus className="h-3.5 w-3.5" /> {adding ? "Close" : "Add from vetted experts"}
        </Button>
      </div>

      {adding && <EligiblePicker onAdded={() => { setAdding(false); load(); }} />}

      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded border border-cream/10 p-8 text-center text-[13px] text-cream/60">
            No pool members yet. Add vetted experts to start taking managed work.
          </div>
        ) : rows.map((r) => (
          <PoolMemberCard
            key={r.member.id}
            row={r}
            open={openId === r.member.id}
            onToggle={() => setOpenId((p) => (p === r.member.id ? null : r.member.id))}
            onChanged={load}
          />
        ))}
      </div>
    </div>
  );
}

function EligiblePicker({ onAdded }: { onAdded: () => void }) {
  const [eligible, setEligible] = useState<EligibleExpert[] | null>(null);
  const [selected, setSelected] = useState<EligibleExpert | null>(null);
  const [costRate, setCostRate] = useState("");
  const [rateType, setRateType] = useState<"hourly" | "per_task">("hourly");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminListPoolEligible().then(setEligible).catch(() => setEligible([]));
  }, []);

  const add = async () => {
    if (!selected || !costRate) return;
    setBusy(true);
    try {
      await adminAddPoolMember({
        expert_id: selected.id,
        cost_rate: Number(costRate),
        cost_rate_type: rateType,
        internal_notes: notes || undefined,
      });
      toast.success(`${selected.name} added to the pool`);
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded border border-cream/10 bg-ink-2 p-5" data-testid="pool-eligible-picker">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-cream/60">Add a vetted expert</p>
      {eligible === null ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-cream/40" /></div>
      ) : eligible.length === 0 ? (
        <p className="mt-3 text-[13px] text-cream/60">
          No eligible experts — everyone verified with a login is already in the pool.
        </p>
      ) : (
        <>
          <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
            {eligible.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                data-testid={`eligible-${e.id}`}
                className={cn(
                  "flex w-full items-center gap-3 rounded border px-3 py-2 text-left",
                  selected?.id === e.id ? "border-sun bg-sun/10" : "border-cream/10 hover:border-cream/30",
                )}
              >
                <img src={e.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-cream">{e.name}</p>
                  <p className="truncate text-[11px] text-cream/60">{e.headline} · {e.category}</p>
                </div>
                <span className="font-mono text-[11px] text-cream/60">${e.hourlyRate}/hr public</span>
              </button>
            ))}
          </div>
          {selected && (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-cream/60">Internal cost rate ($)</label>
                <input
                  type="number"
                  min={1}
                  value={costRate}
                  onChange={(e) => setCostRate(e.target.value)}
                  data-testid="pool-cost-rate"
                  className="mt-1 w-full rounded border border-cream/15 bg-ink px-3 py-2 text-[13px] text-cream"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-cream/60">Rate type</label>
                <select
                  value={rateType}
                  onChange={(e) => setRateType(e.target.value as "hourly" | "per_task")}
                  className="mt-1 w-full rounded border border-cream/15 bg-ink px-3 py-2 text-[13px] text-cream"
                >
                  <option value="hourly">Hourly</option>
                  <option value="per_task">Per task</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-cream/60">Internal notes</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Never shown to clients"
                  className="mt-1 w-full rounded border border-cream/15 bg-ink px-3 py-2 text-[13px] text-cream placeholder:text-cream/40"
                />
              </div>
              <div className="md:col-span-3">
                <Button tone="sun" size="sm" disabled={busy || !costRate} onClick={add} data-testid="pool-add-confirm">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  Add {selected.name} to pool
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PoolMemberCard({
  row,
  open,
  onToggle,
  onChanged,
}: {
  row: PoolMemberRow;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const m = row.member;
  const [costRate, setCostRate] = useState(String(m.cost_rate));
  const [notes, setNotes] = useState(m.internal_notes ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await adminUpdatePoolMember(m.id, {
        cost_rate: Number(costRate),
        internal_notes: notes || undefined,
      });
      toast.success("Pool member updated");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: "active" | "suspended" | "removed") => {
    setBusy(true);
    try {
      const res = await adminSetPoolMemberStatus(m.id, status);
      if (status !== "active" && res.in_flight_tasks > 0) {
        toast.warning(`${res.in_flight_tasks} in-flight task(s) still assigned — reassign them from the task board.`);
      } else {
        toast.success(`Status set to ${status}`);
      }
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border border-cream/10 bg-ink-2" data-testid={`pool-member-${m.id}`}>
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <div className="flex min-w-0 items-center gap-3">
          {row.expert?.image ? (
            <img src={row.expert.image} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cream/10 text-[12px] font-bold text-cream">
              {(row.user?.name || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-[14px] font-semibold text-cream">{row.user?.name ?? "—"}</p>
            <p className="truncate text-[11.5px] text-cream/60">
              {row.expert ? `${row.expert.headline} · ${row.expert.category}` : row.user?.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {m.performance_count > 0 && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-cream/70">
              <Star className="h-3.5 w-3.5 text-sun" /> {m.performance_score.toFixed(1)} ({m.performance_count})
            </span>
          )}
          <span className="font-mono text-[11px] text-cream/60">
            ${m.cost_rate}/{m.cost_rate_type === "hourly" ? "hr" : "task"} cost
          </span>
          {row.open_tasks > 0 && <Tag tone="sun" size="sm">{row.open_tasks} open</Tag>}
          <Tag tone={m.status === "active" ? "moss" : "rust"} size="sm">{m.status}</Tag>
          <ChevronRight className={cn("h-4 w-4 text-cream/50 transition-transform", open && "rotate-90")} />
        </div>
      </button>

      {open && (
        <div className="border-t border-cream/10 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.14em] text-cream/60">Internal cost rate ($)</label>
              <input
                type="number"
                min={1}
                value={costRate}
                onChange={(e) => setCostRate(e.target.value)}
                data-testid={`pool-edit-rate-${m.id}`}
                className="mt-1 w-full rounded border border-cream/15 bg-ink px-3 py-2 text-[13px] text-cream"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.14em] text-cream/60">Internal notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded border border-cream/15 bg-ink px-3 py-2 text-[13px] text-cream"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button tone="sun" size="sm" disabled={busy} onClick={save} data-testid={`pool-save-${m.id}`}>
              Save changes
            </Button>
            {m.status === "active" ? (
              <Button tone="outline" size="sm" disabled={busy} onClick={() => setStatus("suspended")} data-testid={`pool-suspend-${m.id}`}>
                Suspend
              </Button>
            ) : (
              <Button tone="outline" size="sm" disabled={busy} onClick={() => setStatus("active")} data-testid={`pool-activate-${m.id}`}>
                Reactivate
              </Button>
            )}
            <Button tone="outline" size="sm" disabled={busy} onClick={() => setStatus("removed")} data-testid={`pool-remove-${m.id}`}>
              <X className="h-3.5 w-3.5" /> Remove from pool
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
