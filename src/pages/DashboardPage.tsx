import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Briefcase, FileText, MessageSquare, CircleDollarSign, Plus } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import {
  listMyBriefs,
  listMyProposals,
  listMyContracts,
  listConversations,
  fetchMyExpertProfile,
  type Brief,
  type Proposal,
  type Contract,
  type ConversationSummary,
} from "@/lib/api";
import { Container, Eyebrow, LinkButton, Tag } from "@/components/primitives";
import { usePageMeta } from "@/lib/seo";

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
    ])
      .then(([b, p, c, cv, ep]) => {
        setBriefs(b);
        setProposals(p);
        setContracts(c);
        setConvs(cv);
        setHasExpertProfile(Boolean(ep));
      })
      .finally(() => setLoading(false));
  }, [session]);

  if (isPending || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-40" />
      </div>
    );
  }

  const firstName = (session.user.name || session.user.email).split(" ")[0];
  const earnings = contracts
    .filter((c) => c.expert_user_id === session.user._id)
    .reduce((sum, c) => sum + (c.total_amount || 0), 0);

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
            <LinkButton to="/post-request" tone="ink" size="md" arrow>
              <Plus className="mr-1.5 h-4 w-4" /> Post a brief
            </LinkButton>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Your briefs" value={briefs.length} />
          <Stat label="Proposals received" value={briefs.reduce((s, b) => s + b.proposal_count, 0)} />
          <Stat label="Active contracts" value={contracts.filter((c) => c.status === "active").length} />
          <Stat label="Lifetime earnings" value={`$${earnings.toLocaleString()}`} prefix={hasExpertProfile ? "" : "—"} hide={!hasExpertProfile} />
        </div>

        <Section title="Your briefs" count={briefs.length} href="/post-request" cta="Post another">
          {loading ? <SkeletonRow /> : briefs.length === 0 ? (
            <Empty text="No briefs yet. Post your first one to meet 3 matched experts within 48 hours." />
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
              <Empty text="No proposals sent yet. Browse open briefs to send your first." />
            ) : (
              <div className="overflow-hidden rounded border border-ink-12 bg-white">
                {proposals.map((p) => (
                  <Link
                    key={p.id}
                    to="/briefs/$briefId"
                    params={{ briefId: p.brief_id }}
                    className="flex items-center justify-between gap-4 border-b border-ink-10 px-5 py-4 last:border-0 hover:bg-cream-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-[15px] font-semibold text-ink">Brief {p.brief_id}</p>
                      <p className="mt-0.5 text-[12px] text-ink-60">
                        ${p.proposed_rate.toLocaleString()} / {p.rate_type} · {p.estimated_duration_weeks}w
                      </p>
                    </div>
                    <Tag tone={p.status === "accepted" ? "sun" : p.status === "rejected" ? "outline" : "ink"} size="sm">
                      {p.status}
                    </Tag>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        )}

        <Section title="Active contracts" count={contracts.length}>
          {contracts.length === 0 ? (
            <Empty text="No active contracts. Accept a proposal on one of your briefs to start." />
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
            <Empty text="No conversations yet. Once a proposal is accepted, a thread opens automatically." />
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

function Stat({ label, value, hide }: { label: string; value: string | number; prefix?: string; hide?: boolean }) {
  if (hide) return <div className="hidden md:block" />;
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

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded border border-dashed border-ink-20 bg-white px-6 py-10 text-center text-[13px] text-ink-60">
      {text}
    </div>
  );
}

function SkeletonRow() {
  return <div className="h-24 animate-pulse rounded border border-ink-12 bg-white" />;
}
