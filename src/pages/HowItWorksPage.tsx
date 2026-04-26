import {
  FileText,
  Users,
  Handshake,
  CheckCircle2,
  Search,
  ScrollText,
  ShieldAlert,
  Scale,
  Sparkles,
} from "lucide-react";
import {
  Container,
  Eyebrow,
  LinkButton,
  Reveal,
  SectionHeader,
  Tag,
} from "@/components/primitives";
import { usePageMeta } from "@/lib/seo";

export function HowItWorksPage() {
  usePageMeta({
    title: "How it works",
    description:
      "Brief, shortlist, finalists, signed SOW, milestone escrow, and dispute support — the full WorkSoy engagement, end to end.",
    path: "/how-it-works",
  });
  const steps = [
    {
      num: "01",
      icon: FileText,
      title: "Write the brief",
      minutes: "~ 10 min",
      desc:
        "Scope, start date, budget band, named acceptance criteria. We ask for the decision you want the work to inform — not a wish-list.",
      detail:
        "Guided template that writes the SOW outline as you type. You can keep it private or stress-test it with our operations lead for free.",
    },
    {
      num: "02",
      icon: Search,
      title: "Matcher assembles the shortlist",
      minutes: "< 41 hrs",
      desc:
        "A human matcher — not a keyword algorithm — reads the brief, filters by availability and rate band, and hand-picks three.",
      detail:
        "Every candidate is interviewed in the last 90 days, references recent, and has passed our practice-specific work sample.",
    },
    {
      num: "03",
      icon: Users,
      title: "Meet three finalists",
      minutes: "< 15 min each",
      desc:
        "Short async intro videos plus a 15-minute live call with your choice. No agency filler decks, no mystery partners.",
      detail:
        "If none land, we redraw on us. If you need more than three, we will — but most briefs close with the first trio.",
    },
    {
      num: "04",
      icon: ScrollText,
      title: "Counter-signed SOW",
      minutes: "Same day",
      desc:
        "Milestones, acceptance, and change-order terms — signed by you, the contractor, and WorkSoy operations.",
      detail:
        "Escrow is funded to milestone #1. Rates are locked; scope changes go through a lightweight written approval flow.",
    },
    {
      num: "05",
      icon: Handshake,
      title: "The work runs",
      minutes: "Wks 1 → N",
      desc:
        "Workspace, messaging, shared files, and release-on-acceptance payments. Your operations lead is one message away.",
      detail:
        "Weekly pulse, month-end invoice package. Performance data feeds the contractor&rsquo;s network rating — real skin in the game.",
    },
    {
      num: "06",
      icon: CheckCircle2,
      title: "Close or renew",
      minutes: "Day-N + 30",
      desc:
        "Final acceptance, documented handover, and a private two-way review. Extend the SOW or book the next engagement.",
      detail:
        "30-day rework window covered on our ledger. Renewal rates held unless scope changes materially.",
    },
  ];

  const guardrails = [
    {
      icon: Scale,
      title: "Rate benchmarks",
      body: "Every contractor prices inside a published 2026 band. No bidding wars, no mystery meat.",
    },
    {
      icon: ShieldAlert,
      title: "Escrow by default",
      body: "Milestone payments are held in a segregated account until acceptance. No upfront wires.",
    },
    {
      icon: ScrollText,
      title: "Counter-signed SOWs",
      body: "Three signatures, not two. WorkSoy operations is on the hook alongside the contractor.",
    },
    {
      icon: Sparkles,
      title: "Rework window",
      body: "30 calendar days of acceptance rework — covered by our ledger, not yours.",
    },
  ];

  return (
    <div className="bg-cream">
      {/* Title */}
      <section className="border-b border-ink-12 pt-16 md:pt-20">
        <Container>
          <div className="flex items-center justify-between border-b border-ink-12 pb-6">
            <Eyebrow index="§ 01" accent>
              The playbook
            </Eyebrow>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
              41 hrs · 3 finalists · 1 signed SOW
            </span>
          </div>
          <div className="grid grid-cols-1 gap-10 pt-10 md:grid-cols-12 md:pt-14">
            <div className="md:col-span-8">
              <h1 className="display-xl text-ink">
                Brief on Monday.
                <br />
                Shipping by <span className="italic">Friday</span>.
              </h1>
            </div>
            <div className="md:col-span-4 md:pt-4">
              <p className="prose-lede">
                Six moves from first keystroke to signed SOW. Each step has a
                named owner on our side and a fixed SLA — so you always know
                who is holding the pen.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Tag tone="outline" size="sm">Guided brief</Tag>
                <Tag tone="outline" size="sm">Human matcher</Tag>
                <Tag tone="outline" size="sm">Counter-signed SOW</Tag>
                <Tag tone="outline" size="sm">Escrow</Tag>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Timeline — numbered editorial */}
      <section className="py-20 md:py-28">
        <Container>
          <ol className="divide-y divide-ink-12 border-y border-ink-12">
            {steps.map((s, i) => (
              <Reveal
                as="li"
                key={s.num}
                delay={i * 40}
                className="grid grid-cols-12 items-start gap-4 py-10 md:gap-8 md:py-14"
              >
                <div className="col-span-12 flex items-baseline justify-between md:col-span-2 md:block">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
                    Step
                  </p>
                  <p className="font-display text-[clamp(3rem,6vw,5rem)] font-medium leading-none text-ink tabular">
                    {s.num}
                  </p>
                </div>
                <div className="col-span-12 md:col-span-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-cream-2 text-ink">
                      <s.icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <Tag tone="outline" size="sm">
                      {s.minutes}
                    </Tag>
                  </div>
                  <h2 className="mt-4 font-display text-[clamp(1.75rem,3.2vw,2.5rem)] font-medium leading-[1.05] tracking-[-0.022em] text-ink">
                    {s.title}
                  </h2>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-60">
                    {s.desc}
                  </p>
                </div>
                <div className="col-span-12 md:col-span-4 md:border-l md:border-ink-12 md:pl-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
                    Inside the step
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-60">
                    {s.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </Container>
      </section>

      {/* Guardrails — contrast band */}
      <section className="border-y border-ink-12 bg-ink py-20 text-cream md:py-28">
        <Container>
          <SectionHeader
            index="§ 02"
            kicker="The guardrails"
            title={
              <span className="text-cream">
                Commercial safety that a
                <br className="hidden md:block" /> marketplace cannot match.
              </span>
            }
            lede={
              <span className="text-cream/70">
                Four structural protections that make a WorkSoy retainer
                fundamentally different from hiring off LinkedIn or from a
                generic marketplace.
              </span>
            }
            align="split"
          />

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {guardrails.map((g, i) => (
              <Reveal
                key={g.title}
                delay={i * 50}
                className="group rounded border border-cream/15 bg-cream/5 p-6 transition-colors hover:border-sun"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded bg-cream text-ink transition-colors group-hover:bg-sun">
                  <g.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-cream">
                  {g.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-cream/70">
                  {g.body}
                </p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 03"
            kicker="Frequently checked"
            title={
              <>
                Answers to the
                <br className="hidden md:block" /> operator-level questions.
              </>
            }
            align="split"
          />

          <div className="mt-14 divide-y divide-ink-12 border-y border-ink-12">
            {[
              {
                q: "What if the shortlist misses?",
                a: "We redraw — on us. If the second pass also misses, we refund the retainer and recommend an alternative. Over 90% of briefs close with the first trio.",
              },
              {
                q: "How is WorkSoy different from Toptal or Upwork?",
                a: "We are counter-signatories on every SOW, not a listings broker. That means when something drifts, our operations team is contractually in the room — not arbitrating at arms length.",
              },
              {
                q: "Who owns the work product and IP?",
                a: "You do. IP assignment is baked into the standard SOW at signature, with carve-outs handled explicitly if a contractor uses pre-existing open-source or proprietary tooling.",
              },
              {
                q: "Do you support on-site or hybrid engagements?",
                a: "Yes. Most engagements are remote-first, but roughly 20% include on-site weeks, especially in finance transformations, PE-stamped engineering, and regulated compliance audits.",
              },
              {
                q: "What happens if I need to pause or scope-down mid-engagement?",
                a: "A written change-order re-baselines milestones and escrow. No penalty — but notice periods for senior engagements are typically two weeks to keep contractors whole.",
              },
            ].map((f, i) => (
              <details
                key={i}
                className="group grid grid-cols-12 gap-4 py-6 md:py-8"
              >
                <summary className="col-span-12 flex cursor-pointer items-start justify-between gap-6 list-none">
                  <span className="font-display text-[clamp(1.125rem,2vw,1.5rem)] font-medium leading-snug tracking-[-0.015em] text-ink">
                    <span className="mr-3 font-mono text-[11px] tracking-[0.14em] text-ink-40">
                      Q.{String(i + 1).padStart(2, "0")}
                    </span>
                    {f.q}
                  </span>
                  <span
                    aria-hidden
                    className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-20 text-ink transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="col-span-12 mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-60 md:col-span-10 md:col-start-2">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-6 border-t border-ink-12 pt-12">
            <div className="max-w-xl">
              <Eyebrow index="§ 04" accent>
                Start the clock
              </Eyebrow>
              <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.02] tracking-[-0.025em] text-ink">
                Brief us. A matcher reads it within the hour.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <LinkButton to="/post-request" tone="ink" size="lg" arrow>
                Post a brief
              </LinkButton>
              <LinkButton to="/experts" tone="outline" size="lg">
                Browse the network
              </LinkButton>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
