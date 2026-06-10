import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useSession, signOutUser } from "@/lib/auth-client";
import {
  adminStats,
  adminListExperts,
  adminVerifyExpert,
  adminUnverifyExpert,
  adminTogglePublish,
  adminListBriefs,
  adminListDisputes,
  adminListPayouts,
  adminRetryPayout,
  type AdminStats,
  type Brief,
  type Dispute,
  type Payout,
} from "@/lib/api";
import { DisputeThread } from "@/components/DisputeThread";
import { AdminVettingPanel } from "@/components/AdminVettingPanel";
import { AdminManagedPanel } from "@/components/managed/AdminManagedPanel";
import { Container, Tag, Button } from "@/components/primitives";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";

type ApiExpert = {
  id: string;
  name: string;
  headline: string;
  category: string;
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  verified: boolean;
  isPublished?: boolean;
  image: string;
};

export function AdminPage() {
  usePageMeta({
    title: "Admin",
    path: "/admin",
    robots: "noindex,nofollow",
  });
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [experts, setExperts] = useState<ApiExpert[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [tab, setTab] = useState<"queue" | "all" | "briefs" | "disputes" | "payouts" | "vetting" | "managed">("vetting");
  const [loading, setLoading] = useState(true);
  const [openDispute, setOpenDispute] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session || session.user.role !== "admin") {
      navigate({ to: "/admin/login" });
    }
  }, [isPending, session, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const [s, eAll, bs, ds, po] = await Promise.all([
        adminStats(),
        adminListExperts(),
        adminListBriefs(),
        adminListDisputes().catch(() => [] as Dispute[]),
        adminListPayouts().catch(() => [] as Payout[]),
      ]);
      setStats(s);
      setExperts(eAll as ApiExpert[]);
      setBriefs(bs);
      setDisputes(ds);
      setPayouts(po);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user.role === "admin") load();
  }, [session]);

  if (isPending || !session || session.user.role !== "admin") {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-40" /></div>;
  }

  const unverified = experts.filter((e) => !e.verified);
  const shown = tab === "queue" ? unverified : tab === "all" ? experts : [];

  const handleVerify = async (id: string, verified: boolean) => {
    if (verified) await adminUnverifyExpert(id);
    else await adminVerifyExpert(id);
    load();
  };
  const handlePublish = async (id: string) => {
    await adminTogglePublish(id);
    load();
  };
  const handleRetryPayout = async (id: string) => {
    setRetrying(id);
    try {
      const updated = await adminRetryPayout(id);
      setPayouts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch {
      load();
    } finally {
      setRetrying(null);
    }
  };
  const handleSignOut = async () => {
    await signOutUser();
    navigate({ to: "/admin/login" });
  };

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="border-b border-cream/10 bg-ink-2">
        <Container className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-sun" />
            <span className="font-display text-[16px] font-semibold">WorkSoy Admin</span>
            <Tag tone="sun" size="sm">Internal</Tag>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <span className="text-cream/60">{session.user.email}</span>
            <button data-testid="admin-signout" onClick={handleSignOut} className="rounded border border-cream/20 px-3 py-1.5 text-[12px] font-medium hover:bg-cream/10">
              Sign out
            </button>
          </div>
        </Container>
      </header>

      <Container className="py-10">
        {stats && (
          <div className="grid gap-3 md:grid-cols-4">
            <AdminStat label="Users" value={stats.users} />
            <AdminStat label="Experts" value={stats.experts} />
            <AdminStat label="Pending vetting" value={stats.pending_vetting} accent />
            <AdminStat label="Open briefs" value={stats.briefs_open} />
            <AdminStat label="Awarded briefs" value={stats.briefs_awarded} />
            <AdminStat label="Active contracts" value={stats.contracts_active} />
            <AdminStat label="Milestones funded" value={stats.milestones_funded} />
            <AdminStat label="Milestones released" value={stats.milestones_released} />
          </div>
        )}

        <div className="mt-10 flex gap-2 border-b border-cream/10">
          {(["vetting", "managed", "queue", "all", "briefs", "disputes", "payouts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              data-testid={`admin-tab-${t}`}
              className={cn(
                "border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors",
                tab === t ? "border-sun text-cream" : "border-transparent text-cream/50 hover:text-cream/80",
              )}
            >
              {t === "vetting"
                ? "Vetting pipeline"
                : t === "managed"
                ? "Managed service"
                : t === "queue"
                ? `Legacy vet queue (${unverified.length})`
                : t === "all"
                ? `All experts (${experts.length})`
                : t === "briefs"
                ? `Briefs (${briefs.length})`
                : t === "disputes"
                ? `Disputes (${disputes.length})`
                : `Payouts (${payouts.filter((p) => p.status !== "paid").length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-cream/40" /></div>
        ) : tab === "vetting" ? (
          <div className="mt-8"><AdminVettingPanel /></div>
        ) : tab === "managed" ? (
          <div className="mt-8"><AdminManagedPanel /></div>
        ) : tab === "briefs" ? (
          <div className="mt-8 overflow-hidden rounded border border-cream/10">
            {briefs.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-cream/60">No briefs posted yet.</div>
            ) : briefs.map((b) => (
              <div key={b.id} className="flex items-center justify-between border-b border-cream/10 px-5 py-3 last:border-0">
                <div>
                  <p className="font-display text-[14px] font-semibold">{b.title}</p>
                  <p className="text-[11.5px] text-cream/60">{b.category} · ${b.budget_min.toLocaleString()}–${b.budget_max.toLocaleString()} · {b.proposal_count} proposal{b.proposal_count === 1 ? "" : "s"}</p>
                </div>
                <Tag tone={b.status === "open" ? "sun" : "outline"} size="sm">{b.status}</Tag>
              </div>
            ))}
          </div>
        ) : tab === "disputes" ? (
          <div className="mt-8 space-y-4">
            {disputes.length === 0 ? (
              <div className="rounded border border-cream/10 p-8 text-center text-[13px] text-cream/60">No disputes filed. 🎉</div>
            ) : disputes.map((d) => (
              <div key={d.id} className="rounded border border-cream/10 bg-ink-2 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cream/60">
                      Contract {d.contract_id} · Milestone {d.milestone_id}
                    </p>
                    <p className="mt-1 font-display text-[15px] font-semibold">
                      Filed by {d.opened_by_name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12.5px] text-cream/70">{d.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag tone={d.status === "open" ? "sun" : "outline"} size="sm">{d.status}</Tag>
                    <Button
                      tone="outline"
                      size="sm"
                      data-testid={`admin-open-thread-${d.id}`}
                      onClick={() => setOpenDispute((p) => (p === d.id ? null : d.id))}
                    >
                      {openDispute === d.id ? "Hide thread" : "Open thread"}
                    </Button>
                  </div>
                </div>
                {openDispute === d.id && (
                  <div className="mt-4" data-testid={`admin-dispute-thread-${d.id}`}>
                    <DisputeThread
                      disputeId={d.id}
                      theme="ink"
                      onResolved={() => { setOpenDispute(null); load(); }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : tab === "payouts" ? (
          <div className="mt-8 overflow-hidden rounded border border-cream/10">
            {payouts.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-cream/60">No payouts yet. They appear when a client releases a milestone.</div>
            ) : payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 border-b border-cream/10 px-5 py-4 last:border-0" data-testid={`admin-payout-${p.id}`}>
                <div className="min-w-0">
                  <p className="truncate font-display text-[14px] font-semibold">
                    {p.milestone_title || "Milestone"}{p.brief_title ? ` · ${p.brief_title}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-cream/60">
                    {new Date(p.created_at).toLocaleDateString()} · ${p.gross_amount.toLocaleString()} gross − ${p.platform_fee.toLocaleString()} fee · expert {p.expert_user_id}
                  </p>
                  {p.error && <p className="mt-1 truncate text-[11.5px] text-rust">{p.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono tabular text-[14px] font-semibold">${p.net_amount.toLocaleString()}</span>
                  <Tag tone={p.status === "paid" ? "sun" : "outline"} size="sm">{p.status}</Tag>
                  {p.status !== "paid" && (
                    <Button
                      tone="outline"
                      size="sm"
                      disabled={retrying === p.id}
                      onClick={() => handleRetryPayout(p.id)}
                      data-testid={`admin-retry-payout-${p.id}`}
                    >
                      {retrying === p.id ? "Retrying…" : "Retry"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded border border-cream/10">
            {shown.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-cream/60">Nothing to review — all caught up.</div>
            ) : shown.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-4 border-b border-cream/10 px-5 py-4 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={e.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-display text-[14px] font-semibold">
                      {e.name}
                      {e.verified && <CheckCircle2 className="h-4 w-4 text-sun" />}
                    </p>
                    <p className="truncate text-[11.5px] text-cream/60">{e.headline} · {e.category} · ${e.hourlyRate}/hr</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button tone={e.verified ? "outline" : "sun"} size="sm" onClick={() => handleVerify(e.id, e.verified)} data-testid={`verify-${e.id}`}>
                    {e.verified ? "Unverify" : "Verify"}
                  </Button>
                  <Button tone="outline" size="sm" onClick={() => handlePublish(e.id)}>
                    {e.isPublished === false ? "Publish" : "Hide"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}

function AdminStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn("rounded border p-4", accent ? "border-sun/40 bg-sun/10" : "border-cream/10 bg-ink-2")}>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-cream/60">{label}</p>
      <p className="mt-2 font-display text-[22px] font-semibold tabular">{value}</p>
    </div>
  );
}
