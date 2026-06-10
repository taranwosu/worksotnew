import { useEffect, useState } from "react";
import { adminManagedStats, type ManagedStats } from "@/lib/api";
import { AdminPoolTab } from "./AdminPoolTab";
import { AdminClientsTab } from "./AdminClientsTab";
import { AdminTaskBoard } from "./AdminTaskBoard";
import { AdminPerformanceTab } from "./AdminPerformanceTab";
import { cn } from "@/lib/utils";

const SUB_TABS = [
  { key: "tasks", label: "Task board" },
  { key: "pool", label: "Pool" },
  { key: "clients", label: "Clients & billing" },
  { key: "performance", label: "Performance" },
] as const;

type SubTab = (typeof SUB_TABS)[number]["key"];

export function AdminManagedPanel() {
  const [tab, setTab] = useState<SubTab>("tasks");
  const [stats, setStats] = useState<ManagedStats | null>(null);

  const loadStats = () => {
    adminManagedStats().then(setStats).catch(() => setStats(null));
  };
  useEffect(loadStats, []);

  return (
    <div data-testid="admin-managed-panel">
      {stats && (
        <div className="mb-6 grid gap-3 md:grid-cols-6">
          <Stat label="Active pool" value={String(stats.pool_active)} />
          <Stat label="Active clients" value={String(stats.clients_active)} />
          <Stat label="New requests" value={String(stats.tasks_requested)} accent={stats.tasks_requested > 0} />
          <Stat label="Awaiting review" value={String(stats.tasks_submitted)} accent={stats.tasks_submitted > 0} />
          <Stat label="Billed unpaid" value={`$${stats.revenue_unpaid.toLocaleString()}`} />
          <Stat label="Collected" value={`$${stats.revenue_paid.toLocaleString()}`} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-cream/10 pb-1">
        {SUB_TABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            data-testid={`managed-tab-${s.key}`}
            className={cn(
              "border-b-2 px-3 py-2 text-[12.5px] font-semibold transition-colors",
              tab === s.key ? "border-sun text-cream" : "border-transparent text-cream/50 hover:text-cream/80",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "tasks" ? (
          <AdminTaskBoard onChanged={loadStats} />
        ) : tab === "pool" ? (
          <AdminPoolTab />
        ) : tab === "clients" ? (
          <AdminClientsTab onChanged={loadStats} />
        ) : (
          <AdminPerformanceTab />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded border p-4", accent ? "border-sun/40 bg-sun/10" : "border-cream/10 bg-ink-2")}>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-cream/60">{label}</p>
      <p className="mt-2 font-display text-[20px] font-semibold tabular">{value}</p>
    </div>
  );
}
