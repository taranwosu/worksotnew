import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Star,
  Quote,
  FileSignature,
  ShieldCheck,
  Banknote,
  Timer,
  Layers,
} from "lucide-react";
import type { Expert } from "@/data/experts";
import { fetchExperts } from "@/lib/api";
import { usePageMeta } from "@/lib/seo";
import { ExpertCard } from "@/components/ExpertCard";
import {
  Container,
  Eyebrow,
  LinkButton,
  Tag,
  Marquee,
  Reveal,
  SectionHeader,
} from "@/components/primitives";

const categories = [
  {
    num: "01",
    label: "Fractional finance",
    desc: "CFOs, controllers, FP&A, tax strategists",
    rateLow: 140,
    rateHigh: 310,
    count: 420,
  },
  {
    num: "02",
    label: "Strategy & operations",
    desc: "Ex-MBB consultants, COOs, growth leads",
    rateLow: 180,
    rateHigh: 420,
    count: 380,
  },
  {
    num: "03",
    label: "Product & brand design",
    desc: "Staff designers, research, design systems",
    rateLow: 150,
    rateHigh: 260,
    count: 640,
  },
  {
    num: "04",
    label: "Engineering",
    desc: "Platform, AI, mobile, structural PEs",
    rateLow: 160,
    rateHigh: 320,
    count: 510,
  },
  {
    num: "05",
    label: "Risk & compliance",
    desc: "SOC 2, HIPAA, ISO, GDPR, SOX",
    rateLow: 185,
    rateHigh: 280,
    count: 240,
  },
  {
    num: "06",
    label: "Program management",
    desc: "PMPs, transformation directors, PMOs",
    rateLow: 120,
    rateHigh: 260,
    count: 390,
  },
];

const logos = [
  "Ramp", "Notion", "Vercel", "Mercury", "Rippling", "Brex", "Anthropic",
  "Figma", "Linear", "Pilot", "Scale", "Retool",
];

const testimonial = {
  quote:
    "We briefed WorkSoy on a Tuesday. Three shortlists, a working-session with the finalist, and a signed SOW by Friday. The closest agency process took six weeks and twice the cost.",
  author: "Priya Raman",
  role: "COO, Northwind Labs (Series B, $42M ARR)",
};

const workflow = [
  {
    num: "01",
    title: "Write the brief",
    body:
      "Ten minutes. Scope, budget, start date, and the specific decision you need the work to inform.",
  },
  {
    num: "02",
    title: "Meet three finalists",
    body:
      "We hand-match — not a marketplace spray. Within 48 hours, three people your team can actually see being on the call tomorrow.",
  },
  {
    num: "03",
    title: "Kick off on a fixed SOW",
    body:
      "Milestone-based. Escrow-held. Counter-signed by our operations team so there is real accountability if something drifts.",
  },
];

const guarantees = [
  {
    icon: FileSignature,
    title: "Milestone SOWs",
    body: "Every engagement runs on a counter-signed statement of work with named deliverables, acceptance criteria, and dates.",
  },
  {
    icon: ShieldCheck,
    title: "30-day rework",
    body: "If a deliverable misses brief, we cover the rework window on our ledger — not yours. No dispute panels.",
  },
  {
    icon: Banknote,
    title: "Escrow by default",
    body: "Funds are held, released on acceptance. No upfront wires to unvetted vendors, no post-delivery chasing.",
  },
  {
    icon: Timer,
    title: "48-hour match SLA",
    body: "A real person reads your brief within the hour. Shortlists land inside two working days or the first retainer is on us.",
  },
];

export function HomePage() {
  usePageMeta({
    title: "WorkSoy — Premium contractors. Real accountability.",
    description:
      "Brief in, shortlist in 48 hours, contract signed by Friday. The premium network for vetted contractors, fractional leaders, and senior specialists.",
    path: "/",
  });
  const [featured, setFeatured] = useState<Expert[]>([]);
  const [avg, setAvg] = useState("4.96");

  useEffect(() => {
    fetchExperts({ sort: "top" })
      .then((list) => {
        setFeatured(list.slice(0, 3));
        if (list.length > 0) {
          const a = list.reduce((s, e) => s + e.rating, 0) / list.length;
          setAvg(a.toFixed(2));
        }
      })
      .catch(() => {
        /* gracefully leave defaults */
      });
  }, []);

  return (
    <div className="bg-cream">
      {/* ───────────── HERO ───────────── */}
      <section className="relative isolate overflow-hidden pt-16 md:pt-20">
        {/* Sun arc backdrop — editorial, not a gradient wash */}
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[720px] w-[720px] text-sun/40"
          viewBox="0 0 720 720"
        >
          <defs>
            <radialGradient id="sunglow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="360" cy="360" r="300" fill="url(#sunglow)" />
        </svg>

        <Container>
          <div className="grid grid-cols-1 gap-10 pt-10 md:grid-cols-12 md:gap-8 md:pt-14 lg:pt-16">
            {/* Left column — headline & meta */}
            <div className="md:col-span-8">
              <Reveal>
                <h1 className="display-2xl text-ink">
                  Serious work.
                  <br />
                  Sent out to the
                  <br />
                  <span className="relative inline-block">
                    <span className="relative z-10">right hands</span>
                    <span
                      aria-hidden
                      className="absolute inset-x-[-4px] bottom-[8%] z-0 h-[22%] bg-sun"
                    />
                  </span>
                  .
                </h1>
              </Reveal>
              <Reveal delay={80} className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-12">
                <p className="prose-lede md:col-span-7">
                  WorkSoy is where operators staff consequential work — fractional
                  CFOs, SOC 2 leads, staff product designers, PEs. Every
                  contractor is interviewed by a human, rate-benchmarked, and
                  placed under a milestone SOW with escrow.
                </p>
                <div className="md:col-span-5 md:border-l md:border-ink-12 md:pl-6">
                  <p className="text-[13px] leading-relaxed text-ink-60">
                    <span className="eyebrow text-ink">Not</span> a job board.
                    Not a marketplace. We read your brief, hand-match three
                    finalists within 48 hours, and counter-sign the SOW so
                    there is a named party accountable if the work drifts.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={140} className="mt-10 flex flex-wrap items-center gap-3">
                <LinkButton to="/post-request" tone="ink" size="lg" arrow>
                  Post a brief
                </LinkButton>
                <LinkButton to="/experts" tone="cream" size="lg">
                  Meet the network
                </LinkButton>
                <span className="ml-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
                  · ~10 min · No account required
                </span>
              </Reveal>
            </div>

            {/* Right column — portrait collage + ticker */}
            <div className="md:col-span-4">
              <div className="relative md:sticky md:top-24">
                <div className="relative aspect-[4/5] overflow-hidden rounded border border-ink-12 bg-cream-3">
                  <img
                    src={experts[1].image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute left-4 top-4 flex flex-col gap-1.5">
                    <Tag tone="sun" size="sm" dot>
                      Available this week
                    </Tag>
                    <Tag tone="ink" size="sm">
                      Shortlist #04-A
                    </Tag>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-ink/70 to-transparent p-4 text-cream">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cream/70">
                        Candidate 01
                      </p>
                      <p className="mt-0.5 font-display text-[17px] font-medium leading-tight">
                        {experts[1].name.split(",")[0]}
                      </p>
                      <p className="text-[11px] text-cream/80">
                        {experts[1].specialty}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[11px] text-cream/60">USD/hr</p>
                      <p className="font-display text-[22px] font-medium leading-none tabular">
                        {experts[1].hourlyRate}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Small overlap card */}
                <div className="absolute -left-4 -bottom-6 hidden w-[180px] rotate-[-3deg] border border-ink-12 bg-cream p-3 shadow-[0_12px_32px_-14px_rgba(26,26,26,0.35)] md:block">
                  <div className="flex items-center gap-2">
                    <img
                      src={experts[3].image}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-display text-[12px] font-semibold">
                        {experts[3].name.split(",")[0]}
                      </p>
                      <p className="truncate text-[10px] text-ink-60">
                        {experts[3].title}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-ink-60">
                    <span className="flex items-center gap-1">
                      <Star className="h-2.5 w-2.5 fill-sun text-sun" />
                      {experts[3].rating} · {experts[3].reviewCount}
                    </span>
                    <span className="font-mono">${experts[3].hourlyRate}/hr</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Editorial stats strip */}
          <div className="mt-20 grid grid-cols-2 divide-y divide-ink-12 border-y border-ink-12 md:grid-cols-4 md:divide-x md:divide-y-0">
            {[
              { label: "Vetted contractors", value: "3,812" },
              { label: "Avg. time to shortlist", value: "41h" },
              { label: "Avg. network rating", value: avg },
              { label: "Repeat client rate", value: "78%" },
            ].map((s) => (
              <div key={s.label} className="px-2 py-6 md:px-6 md:py-8">
                <p className="eyebrow text-ink-60">{s.label}</p>
                <p className="mt-3 font-display text-[clamp(2.25rem,4.5vw,3.75rem)] font-medium leading-none tracking-[-0.035em] text-ink tabular">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ───────────── LOGO MARQUEE ───────────── */}
      <section className="border-b border-ink-12 bg-cream py-10">
        <Container className="mb-5 flex items-baseline justify-between">
          <Eyebrow index="§ 02" accent>
            In rotation with operators at
          </Eyebrow>
          <p className="hidden text-[11px] text-ink-60 md:block">
            (Select · last 90 days)
          </p>
        </Container>
        <Marquee className="[mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
          {logos.map((l) => (
            <span
              key={l}
              className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-medium tracking-[-0.03em] text-ink-40 transition-colors hover:text-ink"
            >
              {l}
              <span className="ml-12 text-ink-20" aria-hidden>
                ✦
              </span>
            </span>
          ))}
        </Marquee>
      </section>

      {/* ───────────── CATEGORIES (editorial index) ───────────── */}
      <section className="py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 03"
            kicker="The practice areas"
            title={
              <>
                Staffed across the work that actually
                <br className="hidden md:block" /> moves the quarter.
              </>
            }
            lede="Six disciplines. Every person is current, referenced, and interviewed twice. Rate bands reflect real 2026 placement data — not marketplace bids."
            align="split"
          />

          <div className="mt-14 grid grid-cols-1 divide-y divide-ink-12 border-t border-ink-12 md:grid-cols-2 md:divide-x">
            {categories.map((c, i) => (
              <Reveal
                key={c.label}
                delay={i * 40}
                className={[
                  "group relative p-6 md:p-8",
                  i < categories.length - 2 ? "md:border-b md:border-ink-12" : "",
                ].join(" ")}
              >
                <Link
                  to="/experts"
                  className="flex h-full flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="eyebrow text-ink-60">{c.num}</p>
                      <h3 className="mt-4 font-display text-[clamp(1.5rem,2.2vw,2.125rem)] font-medium leading-[1.05] tracking-[-0.022em] text-ink">
                        {c.label}
                      </h3>
                      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-60">
                        {c.desc}
                      </p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-ink-40 transition-transform duration-[var(--dur-base)] ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                  </div>
                  <div className="mt-8 flex items-end justify-between border-t border-ink-10 pt-4">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-40">
                        Typical rate (USD/hr)
                      </p>
                      <p className="mt-1 font-display text-lg font-medium text-ink tabular">
                        ${c.rateLow}
                        <span className="mx-1 text-ink-40">—</span>${c.rateHigh}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-ink-60 tabular">
                      {c.count} active
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ───────────── HOW WE WORK (numbered) ───────────── */}
      <section className="border-y border-ink-12 bg-paper py-20 md:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="md:col-span-4">
              <Eyebrow index="§ 04" accent>
                The process
              </Eyebrow>
              <h2 className="display-lg mt-4 text-ink">
                Three moves.
                <br />
                From brief to <span className="italic">shipping</span>.
              </h2>
              <p className="prose-lede mt-6 max-w-sm">
                Every engagement moves through the same disciplined path — so
                the work starts before the week ends.
              </p>
              <LinkButton
                to="/how-it-works"
                tone="outline"
                size="md"
                className="mt-8"
                arrow
              >
                Read the full playbook
              </LinkButton>
            </div>

            <ol className="md:col-span-8 md:pl-8 md:border-l md:border-ink-12">
              {workflow.map((w, i) => (
                <Reveal
                  as="li"
                  delay={i * 80}
                  key={w.num}
                  className={[
                    "grid grid-cols-12 items-start gap-4 py-8 md:py-10",
                    i > 0 ? "border-t border-ink-12" : "",
                  ].join(" ")}
                >
                  <div className="col-span-2 md:col-span-1">
                    <span className="font-mono text-[11px] tracking-[0.14em] text-ink-60">
                      {w.num}
                    </span>
                  </div>
                  <div className="col-span-10 md:col-span-11">
                    <h3 className="font-display text-[clamp(1.5rem,2.6vw,2.25rem)] font-medium leading-[1.05] tracking-[-0.022em] text-ink">
                      {w.title}
                    </h3>
                    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-60">
                      {w.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* ───────────── FEATURED EXPERTS ───────────── */}
      <section className="py-20 md:py-28">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Eyebrow index="§ 05" accent>
                This week&rsquo;s dispatch
              </Eyebrow>
              <h2 className="display-lg mt-4 max-w-2xl text-ink">
                People you could brief
                <br className="hidden md:block" /> by Monday.
              </h2>
            </div>
            <Link
              to="/experts"
              className="link-sweep inline-flex items-center gap-1.5 font-medium text-ink"
            >
              Full network directory
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((e, i) => (
              <Reveal key={e.id} delay={i * 60}>
                <ExpertCard expert={e} />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ───────────── PULL QUOTE ───────────── */}
      <section className="relative overflow-hidden bg-ink py-20 text-cream md:py-28">
        <div className="grain pointer-events-none absolute inset-0" />
        <Container className="relative">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <Eyebrow index="§ 06" className="text-cream/60" accent>
                The case files
              </Eyebrow>
              <blockquote className="mt-6">
                <Quote
                  className="h-8 w-8 text-sun"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <p className="mt-4 font-display text-[clamp(1.75rem,3.6vw,3rem)] font-medium leading-[1.08] tracking-[-0.022em] text-cream">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <footer className="mt-8 flex items-center gap-4">
                  <span className="h-px w-10 bg-sun" aria-hidden />
                  <div>
                    <p className="font-display text-base font-semibold text-cream">
                      {testimonial.author}
                    </p>
                    <p className="text-[13px] text-cream/60">
                      {testimonial.role}
                    </p>
                  </div>
                </footer>
              </blockquote>
            </div>

            <aside className="md:col-span-4 md:col-start-9">
              <div className="rounded border border-cream/15 bg-cream/5 p-6">
                <p className="eyebrow text-cream/60">Engagement 042</p>
                <h3 className="mt-3 font-display text-[22px] font-medium leading-tight text-cream">
                  SOC 2 Type II in 13 weeks, capped at $68k.
                </h3>
                <ul className="mt-6 space-y-3 text-[13px] text-cream/80">
                  <li className="flex items-baseline justify-between border-b border-cream/10 pb-3">
                    <span className="text-cream/60">Brief received</span>
                    <span className="font-mono tabular">Tue · 09:14</span>
                  </li>
                  <li className="flex items-baseline justify-between border-b border-cream/10 pb-3">
                    <span className="text-cream/60">Shortlist sent</span>
                    <span className="font-mono tabular">Wed · 18:40</span>
                  </li>
                  <li className="flex items-baseline justify-between border-b border-cream/10 pb-3">
                    <span className="text-cream/60">SOW counter-signed</span>
                    <span className="font-mono tabular">Fri · 11:02</span>
                  </li>
                  <li className="flex items-baseline justify-between">
                    <span className="text-cream/60">Audit letter issued</span>
                    <span className="font-mono tabular">Wk 13 · on-time</span>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* ───────────── GUARANTEES ───────────── */}
      <section className="py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 07"
            kicker="Why this isn't a marketplace"
            title={
              <>
                Accountability is not a <em className="italic">feature</em>.
                <br className="hidden md:block" /> It is the product.
              </>
            }
            lede="Every retainer is backed by four operational guarantees that a typical marketplace will not, and a staffing agency cannot match without doubling your line-item."
            align="split"
          />

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {guarantees.map((g, i) => (
              <Reveal
                key={g.title}
                delay={i * 50}
                className="group flex h-full flex-col justify-between rounded border border-ink-12 bg-white p-6 transition-all duration-[var(--dur-base)] ease-out hover:-translate-y-[2px] hover:border-ink"
              >
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded bg-cream-2 text-ink transition-colors group-hover:bg-sun">
                    <g.icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold leading-snug text-ink">
                    {g.title}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-60">
                    {g.body}
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-ink-40">
                  <Layers className="h-3 w-3" />
                  Built into every SOW
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ───────────── CTA CLOSER ───────────── */}
      <section className="pb-24 md:pb-32">
        <Container>
          <div className="relative overflow-hidden border border-ink">
            <div className="grid grid-cols-1 md:grid-cols-12">
              <div className="bg-cream p-8 md:col-span-7 md:p-14">
                <Eyebrow index="§ 08" accent>
                  Open for briefs
                </Eyebrow>
                <h2 className="mt-6 font-display text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[0.98] tracking-[-0.03em] text-ink">
                  Brief it Monday.
                  <br />
                  Meet three by Wednesday.
                  <br />
                  <span className="text-ink-40">Signed</span> by Friday.
                </h2>
                <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-60">
                  Ten-minute brief, zero obligation. You won&rsquo;t be in a
                  funnel — a real matcher reads it and replies by end-of-day.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <LinkButton to="/post-request" tone="ink" size="lg" arrow>
                    Post a brief
                  </LinkButton>
                  <LinkButton to="/pricing" tone="ghost" size="lg">
                    See pricing →
                  </LinkButton>
                </div>
              </div>
              <div className="relative flex flex-col justify-between bg-ink p-8 text-cream md:col-span-5 md:p-14">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                >
                  <svg
                    viewBox="0 0 400 400"
                    className="absolute -right-10 -top-10 h-[380px] w-[380px] text-sun/70"
                  >
                    <defs>
                      <radialGradient id="ctaSun" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <circle cx="200" cy="200" r="180" fill="url(#ctaSun)" />
                  </svg>
                </div>
                <div className="relative">
                  <p className="eyebrow text-cream/60">On call</p>
                  <p className="mt-3 font-display text-[28px] font-medium leading-tight text-cream">
                    A matcher reads every brief in under an hour, 09:00–19:00 ET.
                  </p>
                </div>
                <div className="relative mt-10 border-t border-cream/15 pt-6">
                  <ul className="space-y-3 text-[13px] text-cream/80">
                    <li className="flex items-baseline justify-between">
                      <span className="text-cream/60">Avg. reply</span>
                      <span className="font-mono tabular">38 min</span>
                    </li>
                    <li className="flex items-baseline justify-between">
                      <span className="text-cream/60">First shortlist</span>
                      <span className="font-mono tabular">~41 hrs</span>
                    </li>
                    <li className="flex items-baseline justify-between">
                      <span className="text-cream/60">To contract</span>
                      <span className="font-mono tabular">~4 days</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
