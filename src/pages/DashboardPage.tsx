import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, FileText, Download, Heart } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import {
  listMyBriefs,
  listMyProposals,
  listMyContracts,
  listConversations,
  fetchMyExpertProfile,
  getMyEarnings,
  listMyInvoices,
  getMyVetting,
  listShortlists,
  removeShortlist,
  withdrawProposal,
  invoicePdfUrl,
  type Brief,
  type Proposal,
  type Contract,
  type ConversationSummary,
  type Earnings,
  type Invoice,
  type VettingApplication,
  type Shortlist,
  type PayoutStatus,
  type Payout,
} from "@/lib/api";
import { Container, Eyebrow, LinkButton, Tag } from "@/components/primitives";
import { usePageMeta } from "@/lib/seo";
import { toast } from "sonner";

export function DashboardPage() {
  usePageMeta({
    title: "Dashboard",
    path: "/dashboard",
    robots: "noindex,nofollow",
  });
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [convs, setConvs] = useState<ConversationSummary[]>([]);
  const [hasExpertProfile, setHasExpertProfile] = useState(false);
  const [vetting, setVetting] = useState<VettingApplication | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [shortlist, setShortlist] = useState<Shortlist[]>([]);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [onboarding, setOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/signin" });
  }, [isPending, session, navigate]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    Promise.all([
      listMyBriefs().catch(() => []),
      listMyProposals().catch(() => []),
      listMyContracts().catch(() => []),
      listConversations().catch(() => []),
      fetchMyExpertProfile().catch(() => null),
      getMyEarnings().catch(() => null),
      listMyInvoices().catch(() => []),
      getMyVetting().catch(() => null),
      listShortlists().catch(() => []),
      getPayoutStatus().catch(() => null),
      listMyPayouts().catch(() => []),
    ])
      .then(([b, p, c, cv, ep, ea, iv, vt, sl, ps, po]) => {
        setBriefs(b);
        setProposals(p);
        setContracts(c);
        setConvs(cv);
        setHasExpertProfile(Boolean(ep));
        setEarnings(ea);
        setInvoices(iv);
        setVetting(vt);
        setShortlist(sl);
        setPayoutStatus(ps);
        setPayouts(po);
      })
      .finally(() => setLoading(false));
  }, [session]);

  const handleSetUpPayouts = async () => {
    setOnboarding(true);
    try {
      const { url } = await startPayoutOnboarding();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payout setup");
      setOnboarding(false);
    }
  };

  if (isPending || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-40" />
      </div>
    );
  }

  const firstName = (session.user.name || session.user.email).split(" ")[0];
  const vettingInProgress = vetting && !["approved", "rejected"].includes(vetting.stage);

  const handleWithdraw = async (id: string) => {
    try {
      await withdrawProposal(id);
      setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: "withdrawn" } : p)));
      toast.success("Proposal withdrawn");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to withdraw proposal");
    }
  };

  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-12 pb-6">
          <div>
            <Eyebrow index="§ 02" accent>Dashboard</Eyebrow>
            <h1 className="mt-3 font-display text-[clamp(2.25rem,4vw,3rem)] font-medium tracking-[-0.02em] text-ink">
              Good to see you, {firstName}.
            </h1>
          </div>
          <div className="flex gap-3">
            {!hasExpertProfile && (
              <LinkButton to="/onboarding/expert" tone="outline" size="md">
                Become an expert
              </LinkButton>
            )}
            {vettingInProgress && (
              <LinkButton to="/vetting" tone="outline" size="md" data-testid="dashboard-continue-vetting">
                Continue vetting
              </LinkButton>
            )}
            <LinkButton to="/post-request" tone="ink" size="md" arrow>
              <Plus className="mr-1.5 h-4 w-4" /> Post a brief
            </LinkButton>
          </div>
        </div>

        {vettingInProgress && (
          <div className="mt-6 rounded border border-sun bg-sun/10 px-5 py-4 text-[13.5px] text-ink" data-testid="vetting-banner">
            <p className="font-semibold">You're in the vetting gauntlet — current stage: <span className="italic">{vetting!.stage.replace("_", " ")}</span>.</p>
            <p className="mt-1 text-ink-60">Until you're approved, your profile is hidden and proposals are disabled. <Link to="/vetting" className="underline">Continue →</Link></p>
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Your briefs" value={briefs.length} />
          <Stat label="Proposals received" value={briefs.reduce((s, b) => s + b.proposal_count, 0)} />
          <Stat label="Active contracts" value={contracts.filter((c) => c.status === "active").length} />
          <Stat label={hasExpertProfile ? "Lifetime earnings" : "Active conversations"}
            value={hasExpertProfile ? `$${(earnings?.lifetime_released ?? 0).toLocaleString()}` : convs.length} />
        </div>

        {!hasExpertProfile && shortlist.length > 0 && (
          <Section title="Saved experts" count={shortlist.length} href="/experts" cta="Browse more">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="shortlist-section">
              {shortlist.map((s) => (
                <div key={s.id} className="relative rounded border border-ink-12 bg-white p-4">
                  <button
                    type="button"
                    onClick={async () => {
                      await removeShortlist(s.expert_id);
                      setShortlist((prev) => prev.filter((x) => x.id !== s.id));
                    }}
                    aria-label="Remove from shortlist"
                    className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink-12 text-ink-60 hover:border-rust hover:text-rust"
                    data-testid={`shortlist-remove-${s.expert_id}`}
                  >
                    <Heart className="h-3.5 w-3.5 fill-rust text-rust" />
                  </button>
                  <Link to="/experts/$expertId" params={{ expertId: s.expert_id }} className="flex items-center gap-3">
                    {s.expert?.image ? (
                      <img src={s.expert.image} alt="" className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-cream-3" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-display text-[14px] font-semibold text-ink">{s.expert?.name ?? "Expert"}</p>
                      <p className="truncate text-[12px] text-ink-60">{s.expert?.headline}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-40">${s.expert?.hourlyRate}/hr · {s.expert?.category}</p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </Section>
        )}

        {hasExpertProfile && earnings && (
          <Section title="Earnings" count={undefined}>
            {payoutStatus && !payoutStatus.payouts_enabled && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded border border-sun bg-sun/10 px-5 py-4" data-testid="payout-setup-banner">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">
                    {payoutStatus.connected
                      ? "Finish setting up payouts to receive your earnings."
                      : "Set up payouts to receive your earnings."}
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-60">
                    {payoutStatus.queued_count > 0
                      ? `$${payoutStatus.queued_net_amount.toLocaleString()} is waiting for you — released funds are paid out as soon as your account is connected.`
                      : "Released milestone funds are paid straight to your bank via Stripe."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSetUpPayouts}
                  disabled={onboarding}
                  data-testid="payout-setup-button"
                  className="rounded bg-ink px-4 py-2 text-[13px] font-semibold text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {onboarding ? "Opening Stripe…" : payoutStatus.connected ? "Continue setup" : "Set up payouts"}
                </button>
              </div>
            )}
            {payoutStatus?.payouts_enabled && (
              <p className="mb-4 inline-flex items-center gap-2 rounded-pill border border-ink-12 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink" data-testid="payouts-active-chip">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Payouts active — released funds go straight to your bank
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded border border-ink-12 bg-white p-5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">Lifetime released</p>
                <p className="mt-3 font-display text-[26px] font-semibold tabular text-ink">${earnings.lifetime_released.toLocaleString()}</p>
              </div>
              <div className="rounded border border-ink-12 bg-white p-5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">In escrow</p>
                <p className="mt-3 font-display text-[26px] font-semibold tabular text-ink">${earnings.in_escrow.toLocaleString()}</p>
              </div>
              <div className="rounded border border-ink-12 bg-white p-5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">Pending</p>
                <p className="mt-3 font-display text-[26px] font-semibold tabular text-ink">${earnings.pending.toLocaleString()}</p>
              </div>
            </div>
          </Section>
        )}

        {hasExpertProfile && payouts.length > 0 && (
          <Section title="Payouts" count={payouts.length}>
            <div className="overflow-hidden rounded border border-ink-12 bg-white" data-testid="payouts-list">
              {payouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 border-b border-ink-10 px-5 py-4 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate font-display text-[14px] font-semibold text-ink">
                      {p.milestone_title || "Milestone"}{p.brief_title ? ` · ${p.brief_title}` : ""}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-60">
                      {new Date(p.created_at).toLocaleDateString()} · ${p.gross_amount.toLocaleString()} gross − ${p.platform_fee.toLocaleString()} fee
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono tabular text-[14px] font-semibold text-ink">${p.net_amount.toLocaleString()}</span>
                    <Tag tone={p.status === "paid" ? "sun" : p.status === "queued" ? "ink" : "outline"} size="sm">
                      {p.status === "queued" ? "awaiting setup" : p.status}
                    </Tag>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {hasExpertProfile && invoices.length > 0 && (
          <Section title="Invoices" count={invoices.length}>
            <div className="overflow-hidden rounded border border-ink-12 bg-white" data-testid="invoices-list">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-4 border-b border-ink-10 px-5 py-4 last:border-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-40" />
                    <div className="min-w-0">
                      <p className="truncate font-display text-[14px] font-semibold text-ink">{inv.brief_title}</p>
                      <p className="mt-0.5 text-[12px] text-ink-60">
                        From {inv.client_name} · {new Date(inv.issued_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular text-[14px] font-semibold text-ink">${inv.amount.toLocaleString()}</span>
                    <a
                      href={invoicePdfUrl(inv.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink hover:underline"
                      data-testid={`invoice-pdf-${inv.id}`}
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </a>
                    <Link to="/contracts/$contractId" params={{ contractId: inv.contract_id }} className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-60 hover:underline" data-testid={`invoice-link-${inv.id}`}>
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Your briefs" count={briefs.length} href="/post-request" cta="Post another">
          {loading ? <SkeletonRow /> : briefs.length === 0 ? (
            <Empty text="No briefs yet. Post your first one to meet 3 matched experts within 48 hours." cta={{ to: "/post-request", label: "Post a brief" }} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {briefs.map((b) => (
                <Link
                  key={b.id}
                  to="/briefs/$briefId"
                  params={{ briefId: b.id }}
                  className="group relative rounded border border-ink-12 bg-white p-5 transition-all hover:border-ink hover:shadow-[0_18px_40px_-22px_rgba(26,26,26,0.25)]"
                >
                  <div className="flex items-start justify-between">
                    <Tag tone={b.status === "open" ? "sun" : b.status === "awarded" ? "ink" : "outline"} size="sm">
                      {b.status}
                    </Tag>
                    <span className="font-mono text-[11px] text-ink-40">
                      {b.proposal_count} proposal{b.proposal_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
                    {b.title}
                  </h3>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-60">
                    {b.category} · ${b.budget_min.toLocaleString()}–${b.budget_max.toLocaleString()} · {b.duration_weeks}w
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Section>

        {hasExpertProfile && (
          <Section title="Your proposals" count={proposals.length}>
            {proposals.length === 0 ? (
              <Empty text="No proposals sent yet. Browse open briefs to send your first." cta={{ to: "/briefs", label: "Browse open briefs" }} />
            ) : (
              <div className="overflow-hidden rounded border border-ink-12 bg-white">
                {proposals.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-4 border-b border-ink-10 px-5 py-4 last:border-0"
                  >
                    <Link to="/briefs/$briefId" params={{ briefId: p.brief_id }} className="min-w-0 flex-1 hover:opacity-80">
                      <p className="truncate font-display text-[15px] font-semibold text-ink">Brief {p.brief_id}</p>
                      <p className="mt-0.5 text-[12px] text-ink-60">
                        ${p.proposed_rate.toLocaleString()} / {p.rate_type} · {p.estimated_duration_weeks}w
                      </p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-3">
                      <Tag tone={p.status === "accepted" ? "sun" : p.status === "pending" ? "ink" : "outline"} size="sm">
                        {p.status}
                      </Tag>
                      {p.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleWithdraw(p.id)}
                          data-testid={`withdraw-${p.id}`}
                          className="rounded border border-ink-20 px-2.5 py-1 text-[12px] font-semibold text-ink-60 transition-colors hover:border-rust hover:text-rust"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        <Section title="Active contracts" count={contracts.length}>
          {contracts.length === 0 ? (
            <Empty text="No active contracts. Accept a proposal on one of your briefs to start." cta={{ to: "/briefs", label: "View your briefs" }} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {contracts.map((c) => (
                <Link
                  key={c.id}
                  to="/contracts/$contractId"
                  params={{ contractId: c.id }}
                  className="group rounded border border-ink-12 bg-white p-5 hover:border-ink"
                >
                  <div className="flex items-center justify-between">
                    <Tag tone={c.status === "active" ? "sun" : "outline"} size="sm">{c.status}</Tag>
                    <span className="font-mono tabular text-[13px] font-semibold text-ink">
                      ${c.total_amount.toLocaleString()}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-[17px] font-semibold text-ink">{c.brief_title}</h3>
                  <p className="mt-1 text-[12.5px] text-ink-60">
                    {c.client_user_id === session.user._id ? `Expert: ${c.expert_name}` : `Client: ${c.client_name}`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="Messages" count={convs.length} href="/messages" cta="Open inbox">
          {convs.length === 0 ? (
            <Empty text="No conversations yet. Message an expert from their profile, or a thread opens automatically when a proposal is accepted." cta={{ to: "/experts", label: "Browse experts" }} />
          ) : (
            <div className="divide-y divide-ink-10 overflow-hidden rounded border border-ink-12 bg-white">
              {convs.slice(0, 3).map((c) => (
                <Link key={c.id} to="/messages" className="flex items-center gap-4 px-5 py-4 hover:bg-cream-2">
                  {c.other_user_image ? (
                    <img src={c.other_user_image} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-cream">
                      {c.other_user_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-display text-[14px] font-semibold text-ink">
                      {c.other_user_name}
                      {c.unread > 0 && <Tag tone="sun" size="sm">{c.unread} new</Tag>}
                    </p>
                    <p className="mt-0.5 truncate text-[12.5px] text-ink-60">{c.last_body || c.brief_title}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </Container>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-ink-12 bg-white p-5">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">{label}</p>
      <p className="mt-3 font-display text-[26px] font-semibold tabular text-ink">{value}</p>
    </div>
  );
}

function Section({
  title,
  count,
  href,
  cta,
  children,
}: {
  title: string;
  count?: number;
  href?: string;
  cta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-5 flex items-end justify-between border-b border-ink-12 pb-3">
        <h2 className="font-display text-[22px] font-medium tracking-[-0.01em] text-ink">
          {title}
          {typeof count === "number" && <span className="ml-2 font-mono text-[12px] text-ink-40">{String(count).padStart(2, "0")}</span>}
        </h2>
        {href && cta && (
          <LinkButton to={href} tone="outline" size="sm" arrow>
            {cta}
          </LinkButton>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ text, cta }: { text: string; cta?: { to: string; label: string } }) {
  return (
    <div className="rounded border border-dashed border-ink-20 bg-white px-6 py-10 text-center">
      <p className="mx-auto max-w-md text-[13px] leading-relaxed text-ink-60">{text}</p>
      {cta && (
        <LinkButton to={cta.to} tone="ink" size="sm" arrow className="mt-4">
          {cta.label}
        </LinkButton>
      )}
    </div>
  );
}

function SkeletonRow() {
  return <div className="h-24 animate-pulse rounded border border-ink-12 bg-white" />;
}
