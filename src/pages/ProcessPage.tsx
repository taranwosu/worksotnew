import { useEffect, useState } from "react";
import {
  Languages,
  Brain,
  PhoneCall,
  Hammer,
  Award,
  Shield,
  Clock,
  Users,
  TrendingDown,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Container,
  Eyebrow,
  LinkButton,
  Tag,
} from "@/components/primitives";
import { usePageMeta } from "@/lib/seo";
import { getProcessStats, type ProcessStats } from "@/lib/api";
import { cn } from "@/lib/utils";

const STAGES = [
  {
    key: "language_personality",
    label: "Language & personality",
    icon: Languages,
    duration: "10 min",
    description:
      "A written screen — communication style, working timezone, weekly availability, and a self-rated English level. We're looking for clarity under pressure, not native fluency.",
    you_show: [
      "How you communicate when a project goes off-track (we want a real example, not abstractions)",
      "What you actually want out of being on the roster",
    ],
    we_check: [
      "Hours overlap with your target client base",
      "Written communication is concise, owned, and outcomes-anchored",
    ],
  },
  {
    key: "skill_quiz",
    label: "Skill questionnaire",
    icon: Brain,
    duration: "45 min",
    description:
      "A case study of a recent engagement — your role, the outcome, and the trade-offs you defended. Plus your methodology for the first seven days of any new client relationship.",
    you_show: [
      "One recent engagement explained in 200+ words (you decide what to highlight)",
      "A portfolio or proof URL (optional but moves you up the queue)",
      "Your week-one playbook for any new client",
    ],
    we_check: [
      "Depth: do you sound senior, or are you reciting playbooks?",
      "Judgement: did you optimize for the right thing?",
      "Self-awareness: what did you defer or get wrong?",
    ],
  },
  {
    key: "screening_call",
    label: "Live screening call",
    icon: PhoneCall,
    duration: "30 min",
    description:
      "One of our senior matchers joins a 30-minute video call. No tricks, no whiteboarding — a conversation about your last three engagements, references, and the kind of work you want next.",
    you_show: [
      "Two reference contacts we can verify (we email a 4-question form, not a phone call)",
      "Your ideal-client profile in your own words",
    ],
    we_check: [
      "Reference signal: is the story consistent with what the client says?",
      "How you handle being pushed back on — gracefully or defensively?",
      "Whether your stated rate matches the seniority on display",
    ],
  },
  {
    key: "test_project",
    label: "Paid test project",
    icon: Hammer,
    duration: "1–2 weeks",
    description:
      "A real, scoped engagement — paid at your stated project rate. We've stockpiled briefs from past clients who agreed to be re-anonymised for screening. Your deliverable is reviewed by a two-person panel.",
    you_show: [
      "A self-contained deliverable (model, memo, code, design, plan) with a 1-page decision log",
      "A 5-minute Loom walking us through the choices you made",
    ],
    we_check: [
      "Quality of judgement on a problem you've never seen before",
      "Whether you communicate trade-offs proactively, or wait to be asked",
      "If you'd be embarrassed to hand this to a paying client — so would we",
    ],
  },
  {
    key: "approved",
    label: "Approved · on the roster",
    icon: Award,
    duration: "—",
    description:
      "Your profile goes public, the Verified badge unlocks, and matching briefs are routed to you first. We do an informal review of your first three engagements; after that, you ride on client reviews.",
    you_show: [
      "An updated bio + portrait that the platform can market with",
      "Your availability for the next four weeks",
    ],
    we_check: [
      "On-time delivery and client review NPS on first three projects",
      "Whether your scope creep handling matches what you described in the gauntlet",
    ],
  },
] as const;

const FAQS = [
  {
    q: "Why so many stages?",
    a: "Because every shortcut we've tried has bitten a client later. The whole point of a hard-gated marketplace is that the gate actually works. If our acceptance rate were 30% we'd just be a directory.",
  },
  {
    q: "Is the test project really paid?",
    a: "Yes — at your stated project rate, not a discounted screening rate. We invoice the original client (who has agreed to be re-anonymised) and pass payment to you on the same milestone-escrow system every other engagement uses.",
  },
  {
    q: "I failed at a stage. Can I reapply?",
    a: "Yes, after 12 months — sooner if you have new credentials (published case study, materially different references, or a step-change in seniority). Email hello@worksoy.com with what's changed.",
  },
  {
    q: "How long does the gauntlet take, end to end?",
    a: "Typical timeline is 3-5 weeks from application to decision, depending mostly on how fast you turn around the test project. We don't artificially delay reviews — every stage transition is a human decision logged the same day.",
  },
  {
    q: "Are stage results biased toward US/EU experts?",
    a: "We screen in English and currently route US/EU clients more often, so yes — that asymmetry exists. We don't apply different bars by region, but we know our roster skews. If you're based in LATAM/APAC/Africa, we want to hear about it.",
  },
];

export function ProcessPage() {
  usePageMeta({
    title: "Vetting · How we say 3%",
    description:
      "How WorkSoy says 'top 3%' — the five-stage vetting gauntlet, with live acceptance rates and median decision time.",
    path: "/process",
    robots: "index,follow",
  });

  const [stats, setStats] = useState<ProcessStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProcessStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-cream pb-28" data-testid="process-page">
      <Hero stats={stats} loading={loading} />
      <FunnelSection stats={stats} loading={loading} />
      <StagesSection />
      <PromiseSection />
      <FAQSection />
      <CTASection />
    </div>
  );
}

function Hero({ stats, loading }: { stats: ProcessStats | null; loading: boolean }) {
  const rate = stats?.acceptance_rate_pct;
  const hasRealRate = rate !== null && rate !== undefined;
  const headlinePct = hasRealRate ? `${rate}%` : "≈ 3%";
  return (
    <section className="relative overflow-hidden border-b border-ink-12 bg-cream pt-20 md:pt-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_-10%,rgba(232,184,76,0.18),transparent_55%)]" />
      <Container>
        <div className="grid items-end gap-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <Eyebrow index="§ V" accent>Vetting</Eyebrow>
            <h1 className="mt-4 font-display text-[clamp(2.5rem,6.2vw,5rem)] font-medium leading-[0.98] tracking-[-0.025em] text-ink">
              We say <span className="bg-sun/40 px-2 py-0.5">{headlinePct}</span>.<br />
              Here's the math.
            </h1>
            <p className="mt-6 max-w-xl text-[16.5px] leading-[1.55] text-ink-60">
              Toptal-style hard-gated marketplaces are a brand promise more than a product. We thought we'd show our working — the actual five-stage gauntlet, with live acceptance rate and median decision time, updated nightly.
            </p>
            {!loading && !hasRealRate && (
              <p
                data-testid="acceptance-rate-fallback"
                className="mt-4 max-w-xl text-[12.5px] italic leading-snug text-ink-60"
              >
                ≈ 3% is our target. We publish the live number once we've made at least {stats?.min_sample_size ?? 30} decisions — currently {stats?.decision_sample_size ?? 0}, so it would still be statistical noise.
              </p>
            )}
            <div className="mt-9 flex flex-wrap gap-3">
              <LinkButton to="/onboarding/expert" tone="ink" size="lg" arrow data-testid="process-cta-apply">
                Apply to the roster
              </LinkButton>
              <LinkButton to="/experts" tone="outline" size="lg" data-testid="process-cta-browse">
                Hire from the roster
              </LinkButton>
            </div>
          </div>
          <HeroStats stats={stats} loading={loading} />
        </div>
      </Container>
    </section>
  );
}

function HeroStats({ stats, loading }: { stats: ProcessStats | null; loading: boolean }) {
  const hasRate = stats?.acceptance_rate_pct !== null && stats?.acceptance_rate_pct !== undefined;
  const hasMedian = stats?.median_days_to_decision !== null && stats?.median_days_to_decision !== undefined;
  const cells = [
    {
      kicker: "Acceptance rate",
      value: loading ? "—" : hasRate ? `${stats?.acceptance_rate_pct}%` : "≈ 3%",
      foot: hasRate
        ? `Approved / decisions · n=${(stats?.decision_sample_size ?? 0).toLocaleString()}`
        : `Target · published when n ≥ ${stats?.min_sample_size ?? 30}`,
    },
    {
      kicker: "On the roster today",
      value: loading ? "—" : (stats?.roster_size ?? 0).toLocaleString(),
      foot: "Live public directory size",
    },
    {
      kicker: "In the gauntlet",
      value: loading ? "—" : (stats?.in_progress ?? 0).toLocaleString(),
      foot: "Applications mid-screening",
    },
    {
      kicker: "Median decision",
      value: loading ? "—" : hasMedian ? `${stats?.median_days_to_decision} days` : "3–5 weeks",
      foot: hasMedian
        ? "Apply → approval, last 200"
        : "Typical · published once sample grows",
    },
  ];
  return (
    <div className="rounded border border-ink-12 bg-white" data-testid="process-hero-stats">
      <div className="grid grid-cols-2">
        {cells.map((c, i) => (
          <div
            key={c.kicker}
            className={cn(
              "px-6 py-7",
              i % 2 === 0 ? "border-r border-ink-10" : "",
              i < 2 ? "border-b border-ink-10" : "",
            )}
          >
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
              {c.kicker}
            </p>
            <p className="mt-3 font-display text-[clamp(1.8rem,3vw,2.4rem)] font-medium tabular text-ink">
              {c.value}
            </p>
            <p className="mt-2 text-[11.5px] leading-snug text-ink-60">{c.foot}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunnelSection({ stats, loading }: { stats: ProcessStats | null; loading: boolean }) {
  const total = stats?.total_applications ?? 0;
  const inProgressByStage = STAGES.slice(0, 4).map((s) => {
    const count = stats?.by_stage?.[s.key] ?? 0;
    return { ...s, count };
  });
  const approved = stats?.approved ?? 0;
  const rejected = stats?.rejected ?? 0;
  const maxCount = Math.max(
    total,
    ...inProgressByStage.map((s) => s.count),
    approved,
    rejected,
    1,
  );

  return (
    <section className="border-b border-ink-12 py-20 md:py-28">
      <Container>
        <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:items-start">
          <div>
            <Eyebrow index="§ F" accent>The funnel</Eyebrow>
            <h2 className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
              Where applicants are right now.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-60">
              Bars are absolute counts. Drop-off between stages is by design — we'd rather lose a strong-on-paper candidate at the screening call than at the test-project review. The cost of a bad match falls on the client.
            </p>
            {loading && <p className="mt-6 text-[12.5px] text-ink-40">Loading live numbers…</p>}
          </div>
          <ol className="space-y-3" data-testid="process-funnel">
            {[
              { key: "applied", label: "Applied", count: total, icon: Users },
              ...inProgressByStage,
              { key: "approved", label: "Approved · on roster", count: approved, icon: CheckCircle2 },
              { key: "rejected", label: "Rejected", count: rejected, icon: XCircle, dim: true },
            ].map((row, idx) => {
              const Icon = row.icon as React.ComponentType<{ className?: string; strokeWidth?: number }>;
              const widthPct = total > 0 ? Math.max((row.count / maxCount) * 100, 4) : 4;
              return (
                <li
                  key={row.key}
                  data-testid={`funnel-row-${row.key}`}
                  className="grid grid-cols-[1.2fr_3fr_auto] items-center gap-4 border-b border-ink-08 pb-3 last:border-0"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[10.5px] tabular text-ink-40">{String(idx).padStart(2, "0")}</span>
                    <Icon className={cn("h-4 w-4 shrink-0", "dim" in row && row.dim ? "text-ink-40" : "text-ink")} strokeWidth={1.6} />
                    <span className={cn("font-display text-[13.5px] font-semibold", "dim" in row && row.dim ? "text-ink-60" : "text-ink")}>{row.label}</span>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-cream-3">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700",
                        row.key === "approved" ? "bg-sun" : row.key === "rejected" ? "bg-ink-12" : "bg-ink",
                      )}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="font-mono tabular text-[13px] font-semibold text-ink">
                    {row.count.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </Container>
    </section>
  );
}

function StagesSection() {
  return (
    <section className="border-b border-ink-12 bg-cream-2 py-20 md:py-28">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow index="§ S" accent>The five stages</Eyebrow>
          <h2 className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
            What we check, what you show.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-60">
            Every stage maps to a specific risk we'd otherwise be passing to the client. We don't keep the rubric a secret — what we look for, and the form your evidence should take, is below.
          </p>
        </div>

        <ol className="mt-14 space-y-12" data-testid="process-stages">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            return (
              <li
                key={s.key}
                data-testid={`process-stage-${s.key}`}
                className="grid gap-10 md:grid-cols-[180px_1fr] md:items-start"
              >
                <div className="md:sticky md:top-24">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-40">
                    Stage 0{i + 1}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <Icon className="h-6 w-6 text-ink" strokeWidth={1.5} />
                    <h3 className="font-display text-[18px] font-semibold leading-tight text-ink">
                      {s.label}
                    </h3>
                  </div>
                  <div className="mt-5 space-y-1.5">
                    <p className="font-mono text-[11px] text-ink-60">
                      <span className="text-ink-40">Time · </span>
                      <span className="text-ink">{s.duration}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[16px] leading-[1.6] text-ink">{s.description}</p>
                  <div className="mt-8 grid gap-6 md:grid-cols-2">
                    <div className="rounded border border-ink-12 bg-white p-5">
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                        You show
                      </p>
                      <ul className="mt-3 space-y-2.5 text-[13.5px] leading-snug text-ink">
                        {s.you_show.map((item, j) => (
                          <li key={j} className="flex gap-2.5">
                            <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-ink" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded border border-ink bg-ink p-5 text-cream">
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-cream/60">
                        We check
                      </p>
                      <ul className="mt-3 space-y-2.5 text-[13.5px] leading-snug">
                        {s.we_check.map((item, j) => (
                          <li key={j} className="flex gap-2.5">
                            <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-sun" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}

function PromiseSection() {
  const promises = [
    {
      icon: Shield,
      title: "Same gate for every applicant.",
      body: "No referrals, no warm intros, no waivers. The five stages run identically whether you applied via a partner link or stumbled in from Google.",
    },
    {
      icon: Clock,
      title: "Every transition is a human decision.",
      body: "No auto-rejects from a scoring model. A real reviewer logs the call, with notes shared back to you — even on rejection.",
    },
    {
      icon: TrendingDown,
      title: "We'd rather over-reject.",
      body: "Bad matches cost clients money and reputation, and they cost experts goodwill on the platform. We lean toward 'no' under uncertainty.",
    },
  ];
  return (
    <section className="border-b border-ink-12 bg-ink py-20 text-cream md:py-28">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow index="§ P" accent>The promise</Eyebrow>
          <h2 className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.02em] text-cream">
            Three things that don't bend.
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {promises.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded border border-cream/15 bg-ink-2 p-7">
                <Icon className="h-6 w-6 text-sun" strokeWidth={1.5} />
                <h3 className="mt-5 font-display text-[18px] font-semibold leading-snug text-cream">
                  {p.title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-cream/70">{p.body}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function FAQSection() {
  return (
    <section className="border-b border-ink-12 py-20 md:py-28">
      <Container>
        <div className="grid gap-14 md:grid-cols-[1fr_2fr]">
          <div>
            <Eyebrow index="§ Q" accent>FAQ</Eyebrow>
            <h2 className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
              The questions we actually get.
            </h2>
          </div>
          <dl className="divide-y divide-ink-12" data-testid="process-faqs">
            {FAQS.map((f, i) => (
              <details key={i} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-baseline justify-between gap-6 text-left">
                  <dt className="font-display text-[17px] font-semibold leading-snug text-ink">{f.q}</dt>
                  <span className="font-mono text-[13px] text-ink-40 transition-transform group-open:rotate-45">+</span>
                </summary>
                <dd className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-ink-60">{f.a}</dd>
              </details>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <div className="grid gap-10 md:grid-cols-2">
          <div className="rounded border border-ink bg-ink p-10 text-cream">
            <Tag tone="sun" size="sm">For experts</Tag>
            <h3 className="mt-5 font-display text-[clamp(1.5rem,2.8vw,2rem)] font-medium leading-[1.05] tracking-[-0.02em] text-cream">
              Apply — it's free, and you'll know inside a month.
            </h3>
            <p className="mt-4 text-[14.5px] leading-relaxed text-cream/70">
              We don't charge to apply. If you pass the test project, we pay you for it at your stated rate. If you don't, you'll get specific written feedback.
            </p>
            <div className="mt-8">
              <LinkButton to="/onboarding/expert" tone="sun" size="lg" arrow data-testid="process-cta-apply-bottom">
                Start application
              </LinkButton>
            </div>
          </div>
          <div className="rounded border border-ink-12 bg-white p-10 text-ink">
            <Tag tone="outline" size="sm">For clients</Tag>
            <h3 className="mt-5 font-display text-[clamp(1.5rem,2.8vw,2rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
              Hire from a list of people who've already passed.
            </h3>
            <p className="mt-4 text-[14.5px] leading-relaxed text-ink-60">
              Browse the roster, post a brief, or hand us your problem and we'll route it. Milestone escrow, transparent fees, fixed-price disputes if anything goes wrong.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/experts" tone="ink" size="lg" arrow data-testid="process-cta-roster">
                Browse the roster
              </LinkButton>
              <LinkButton to="/post-request" tone="outline" size="lg">
                Post a brief
              </LinkButton>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
