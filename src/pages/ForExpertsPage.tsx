import { useEffect, useState } from "react";
import {
  Wallet,
  ShieldCheck,
  Briefcase,
  Compass,
  Clock,
  Inbox,
  FileText,
  PhoneCall,
  CheckCircle2,
} from "lucide-react";
import type { Expert } from "@/data/experts";
import { fetchExperts } from "@/lib/api";
import { usePageMeta } from "@/lib/seo";
import {
  Container,
  Eyebrow,
  LinkButton,
  Tag,
  Marquee,
  Reveal,
  SectionHeader,
} from "@/components/primitives";

const perks = [
  {
    num: "01",
    icon: Wallet,
    title: "8% operator fee, and it is the only fee",
    body:
      "No lead charges, no payout fees, no bidding credits. Your rate stays your rate; we take a transparent cut on milestone acceptance.",
  },
  {
    num: "02",
    icon: Compass,
    title: "Curated briefs, not job-board noise",
    body:
      "Every brief is pre-qualified by a human matcher. You opt in or pass — no applying, no undercutting, no proposal templates.",
  },
  {
    num: "03",
    icon: ShieldCheck,
    title: "Escrow-backed payment on every milestone",
    body:
      "Funds are held before work starts. Acceptance releases inside 48 hours. Late-payment disputes are our problem, not yours.",
  },
  {
    num: "04",
    icon: Briefcase,
    title: "Counter-signed SOWs — our name next to yours",
    body:
      "When a client tries to expand scope, we are contractually in the conversation. Change-orders are written, or they do not happen.",
  },
];

const timeline = [
  {
    num: "01",
    icon: Inbox,
    title: "Apply in 15 minutes",
    body: "Practice area, rate band, portfolio, two references. We read everything.",
  },
  {
    num: "02",
    icon: PhoneCall,
    title: "Two reference calls",
    body: "We actually dial the numbers — we do not harvest LinkedIn recommendations.",
  },
  {
    num: "03",
    icon: FileText,
    title: "Work-sample review",
    body: "A practice-specific exercise scored by two practitioners already on the roster.",
  },
  {
    num: "04",
    icon: CheckCircle2,
    title: "Onboarded in 14 days",
    body: "Profile goes live, matcher sends first-fit briefs, and you&rsquo;re working inside a month.",
  },
];

const stats = [
  { v: "8%", l: "Operator fee — flat" },
  { v: "<7%", l: "Applicant acceptance rate" },
  { v: "48 h", l: "Acceptance-to-payout" },
  { v: "$264k", l: "Median annual network billings" },
];

export function ForExpertsPage() {
  usePageMeta({
    title: "For experts",
    description:
      "Apply to join the WorkSoy roster. Real briefs, escrow-funded milestones, transparent fees — built for senior independents.",
    path: "/for-experts",
  });
  const [experts, setExperts] = useState<Expert[]>([]);
  useEffect(() => {
    fetchExperts().then(setExperts).catch(() => setExperts([]));
  }, []);

  return (
    <div className="bg-cream">
      {/* ───────────── HERO — dark slab ───────────── */}
      <section className="relative overflow-hidden border-b border-ink-12 bg-ink text-cream">
        <div className="grain pointer-events-none absolute inset-0" />
        <svg
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-40 h-[720px] w-[720px] text-sun/30"
          viewBox="0 0 720 720"
        >
          <defs>
            <radialGradient id="sunForExperts" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.85" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="360" cy="360" r="300" fill="url(#sunForExperts)" />
        </svg>

        <Container className="relative pt-16 md:pt-20">
          <div className="flex items-center justify-between border-b border-cream/15 pb-6">
            <Eyebrow index="§ 01" className="text-cream/60" accent>
              For experts
            </Eyebrow>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-cream/60">
              Applications open · Spring 2026 intake
            </span>
          </div>
          <div className="grid grid-cols-1 gap-10 pt-16 md:grid-cols-12 md:gap-8 md:pt-20">
            <div className="md:col-span-8">
              <Reveal>
                <h1 className="display-2xl text-cream">
                  Own the
                  <br />
                  practice.
                  <br />
                  Skip the
                  <br />
                  <span className="relative inline-block">
                    <span className="relative z-10">sales cycle</span>
                    <span
                      aria-hidden
                      className="absolute inset-x-[-6px] bottom-[8%] z-0 h-[22%] bg-sun"
                    />
                  </span>
                  .
                </h1>
              </Reveal>
            </div>
            <div className="md:col-span-4 md:pt-6">
              <p className="text-[17px] leading-relaxed text-cream/75">
                Join a network of senior operators who have replaced cold
                outbound with a curated feed of pre-qualified briefs, backed by
                escrow and counter-signed SOWs.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row md:flex-col">
                <LinkButton to="/onboarding/expert" tone="sun" size="lg" arrow>
                  Apply to the network
                </LinkButton>
                <LinkButton to="/how-it-works" tone="ghost" size="lg" className="text-cream hover:bg-cream/10">
                  Read the standards →
                </LinkButton>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-20 grid grid-cols-2 divide-cream/15 border-t border-cream/15 md:grid-cols-4 md:divide-x">
            {stats.map((s) => (
              <div key={s.l} className="px-2 py-6 md:px-6 md:py-8">
                <p className="eyebrow text-cream/60">{s.l}</p>
                <p className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] font-medium leading-none tracking-[-0.03em] text-cream tabular">
                  {s.v}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ───────────── ROSTER MARQUEE ───────────── */}
      <section className="border-b border-ink-12 py-14">
        <Container className="mb-6 flex items-baseline justify-between">
          <Eyebrow index="§ 02" accent>
            Currently on the roster
          </Eyebrow>
          <p className="hidden text-[11px] text-ink-60 md:block">
            Names shown with permission
          </p>
        </Container>
        <Marquee speed="slow" className="[mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
          {experts.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 whitespace-nowrap"
            >
              <img
                src={e.image}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
              <div className="leading-tight">
                <p className="font-display text-[15px] font-semibold text-ink">
                  {e.name}
                </p>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-60">
                  {e.specialty}
                </p>
              </div>
              <span className="mx-6 text-ink-20" aria-hidden>
                ✦
              </span>
            </div>
          ))}
        </Marquee>
      </section>

      {/* ───────────── PERKS — numbered editorial rows ───────────── */}
      <section className="py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 03"
            kicker="What you get"
            title={
              <>
                The terms are
                <br className="hidden md:block" />
                built for your practice.
              </>
            }
            lede="Four commitments that add up to a practice-grade partnership. Built by ex-operators for ex-operators."
            align="split"
          />

          <div className="mt-14 grid grid-cols-1 divide-y divide-ink-12 border-y border-ink-12 md:grid-cols-2 md:divide-y-0 md:divide-x">
            {perks.map((p, i) => (
              <Reveal
                key={p.num}
                delay={i * 50}
                className={[
                  "group p-8 md:p-10",
                  i < 2 ? "md:border-b md:border-ink-12" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-ink-60">
                    {p.num}
                  </span>
                  <p.icon
                    className="h-6 w-6 text-ink-40 transition-colors group-hover:text-sun-2"
                    strokeWidth={1.75}
                  />
                </div>
                <h3 className="mt-6 font-display text-[clamp(1.375rem,2.4vw,2rem)] font-medium leading-[1.1] tracking-[-0.018em] text-ink">
                  {p.title}
                </h3>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-60">
                  {p.body}
                </p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ───────────── APPLICATION PATH ───────────── */}
      <section className="border-y border-ink-12 bg-paper py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 04"
            kicker="The path in"
            title={<>Four gates, honest odds.</>}
            lede="Fewer than 7% of applicants are placed on the live roster. Everyone who passes receives the standards pack on day one — no gatekeeping."
            align="split"
          />

          <ol className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-4">
            {timeline.map((t, i) => (
              <Reveal
                as="li"
                key={t.num}
                delay={i * 60}
                className="relative rounded border border-ink-12 bg-white p-6"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-ink-60">
                    {t.num}
                  </span>
                  <span className="flex-1 border-t border-ink-12" aria-hidden />
                  <Clock className="h-3.5 w-3.5 text-ink-40" />
                </div>
                <div className="mt-5 flex h-10 w-10 items-center justify-center rounded bg-cream-2 text-ink">
                  <t.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 font-display text-[17px] font-semibold leading-snug text-ink">
                  {t.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-60">
                  {t.body}
                </p>
              </Reveal>
            ))}
          </ol>
        </Container>
      </section>

      {/* ───────────── QUOTE FROM A CONTRACTOR ───────────── */}
      <section className="py-20 md:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-10 border-y border-ink-12 py-14 md:grid-cols-12 md:gap-8 md:py-20">
            <div className="md:col-span-7">
              <Eyebrow index="§ 05" accent>
                Field notes
              </Eyebrow>
              <blockquote className="mt-6">
                <p className="display-md text-ink">
                  &ldquo;I replaced three months of outbound with one form.
                  Matcher asks two good questions, and I get a brief a week
                  that I would have picked out of a pile anyway.&rdquo;
                </p>
                <footer className="mt-8 flex items-center gap-4">
                  {experts.length > 0 && (
                    <>
                      <img
                        src={experts[0].image}
                        alt=""
                        className="h-12 w-12 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-display text-base font-semibold text-ink">
                          {experts[0].name}
                        </p>
                        <p className="text-[13px] text-ink-60">
                          {experts[0].title}
                        </p>
                      </div>
                    </>
                  )}
                </footer>
              </blockquote>
            </div>
            <aside className="md:col-span-4 md:col-start-9">
              <div className="rounded border border-ink-12 bg-white p-6">
                <p className="eyebrow text-ink-60">Since joining</p>
                <ul className="mt-4 space-y-3 text-[13px]">
                  <li className="flex items-baseline justify-between border-b border-ink-08 pb-3">
                    <span className="text-ink-60">Engagements closed</span>
                    <span className="font-mono tabular text-ink">24</span>
                  </li>
                  <li className="flex items-baseline justify-between border-b border-ink-08 pb-3">
                    <span className="text-ink-60">Avg. engagement</span>
                    <span className="font-mono tabular text-ink">11 wks</span>
                  </li>
                  <li className="flex items-baseline justify-between border-b border-ink-08 pb-3">
                    <span className="text-ink-60">Repeat clients</span>
                    <span className="font-mono tabular text-ink">62%</span>
                  </li>
                  <li className="flex items-baseline justify-between">
                    <span className="text-ink-60">Avg. payout SLA</span>
                    <span className="font-mono tabular text-ink">1.4 days</span>
                  </li>
                </ul>
                <Tag tone="sun" size="sm" className="mt-5">
                  Top 5% of roster
                </Tag>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* ───────────── CTA ───────────── */}
      <section className="pb-24">
        <Container>
          <div className="relative overflow-hidden border border-ink bg-cream p-10 md:p-14">
            <svg
              aria-hidden
              className="pointer-events-none absolute -right-32 -top-32 h-[560px] w-[560px] text-sun/50"
              viewBox="0 0 560 560"
            >
              <defs>
                <radialGradient id="sunCTA" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="280" cy="280" r="240" fill="url(#sunCTA)" />
            </svg>
            <div className="relative grid grid-cols-1 items-end gap-10 md:grid-cols-12">
              <div className="md:col-span-8">
                <Eyebrow index="§ 06" accent>
                  Take the first step
                </Eyebrow>
                <h2 className="mt-6 font-display text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[0.98] tracking-[-0.03em] text-ink">
                  Apply in 15 minutes.
                  <br />
                  Matcher reads it this week.
                </h2>
              </div>
              <div className="md:col-span-4 md:text-right">
                <LinkButton to="/onboarding/expert" tone="ink" size="lg" arrow>
                  Start application
                </LinkButton>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
                  Or email hello@worksoy.com
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
