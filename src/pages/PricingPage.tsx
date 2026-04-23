import { Check, Minus } from "lucide-react";
import {
  Container,
  Eyebrow,
  LinkButton,
  Tag,
  SectionHeader,
} from "@/components/primitives";
import { cn } from "@/lib/utils";

type Plan = {
  id: "starter" | "practice" | "enterprise";
  name: string;
  price: string;
  period?: string;
  tagline: string;
  bestFor: string;
  fee: string;
  features: string[];
  cta: { label: string; to: string };
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    id: "starter",
    name: "Access",
    price: "$0",
    period: "/engagement",
    tagline: "A single named engagement.",
    bestFor: "First-time hirers, one-off projects",
    fee: "10% operator fee",
    features: [
      "One active brief at a time",
      "Shortlist in 48 hours",
      "Counter-signed SOW + escrow",
      "Standard 30-day rework window",
      "Email support, 1-business-day reply",
    ],
    cta: { label: "Post a brief", to: "/post-request" },
  },
  {
    id: "practice",
    name: "Practice",
    price: "$449",
    period: "/ month",
    tagline: "For teams staffing routinely.",
    bestFor: "Operators running 2–8 concurrent engagements",
    fee: "6% operator fee",
    features: [
      "Unlimited active briefs",
      "Priority matcher · 24-hr shortlist",
      "Dedicated operations lead",
      "Custom SOW + rate-card templates",
      "Quarterly rate benchmarking report",
      "Slack bridge + Notion workspace",
    ],
    cta: { label: "Start a trial", to: "/post-request" },
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Bench",
    price: "Bespoke",
    tagline: "A private network, your terms.",
    bestFor: "Group-level staffing, regulated industries",
    fee: "Negotiated fee",
    features: [
      "Volume-tier placements",
      "SSO, SCIM, audit log",
      "Legal counsel on SOW review",
      "Custom compliance pack (SOC 2, HIPAA)",
      "Dedicated matcher pod",
      "On-site bench activation",
    ],
    cta: { label: "Talk to bench ops", to: "/contact" },
  },
];

const comparison = [
  {
    section: "Matching",
    rows: [
      ["Shortlist SLA", "48 hrs", "24 hrs", "Same-day"],
      ["Redraw on miss", "Yes", "Yes", "Yes · unlimited"],
      ["Off-roster search", "Upgrade", "Included", "Included"],
    ],
  },
  {
    section: "Commercials",
    rows: [
      ["Operator fee", "10%", "6%", "Negotiated"],
      ["Escrow payments", "Yes", "Yes", "Yes"],
      ["Rate benchmarks", "Standard", "Quarterly report", "On-demand"],
    ],
  },
  {
    section: "Governance",
    rows: [
      ["Counter-signed SOW", "Yes", "Yes", "Yes"],
      ["Legal counsel review", "Self-serve", "Template library", "Named counsel"],
      ["SSO / SCIM / Audit log", "—", "Add-on", "Included"],
    ],
  },
  {
    section: "Support",
    rows: [
      ["Operations lead", "Shared pool", "Dedicated", "Dedicated pod"],
      ["Response time", "1 biz day", "2 hrs", "30 min · 24/7"],
      ["Onsite activation", "—", "—", "Global"],
    ],
  },
];

export function PricingPage() {
  return (
    <div className="bg-cream">
      {/* Title band */}
      <section className="border-b border-ink-12 pt-16 md:pt-20">
        <Container>
          <div className="flex items-center justify-between border-b border-ink-12 pb-6">
            <Eyebrow index="§ 01" accent>
              Rate card
            </Eyebrow>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
              USD · Effective 01.04.26
            </span>
          </div>
          <div className="grid grid-cols-1 gap-8 pt-10 md:grid-cols-12 md:pt-14">
            <div className="md:col-span-8">
              <h1 className="display-xl text-ink">
                Priced by engagement.
                <br className="hidden md:block" /> Paid on acceptance.
              </h1>
            </div>
            <div className="md:col-span-4 md:pt-4">
              <p className="prose-lede">
                No bidding, no per-seat traps, no platform fees dressed up as
                subscriptions. You see the contractor&rsquo;s rate, you see our
                operator fee, and you pay on milestone acceptance.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Plans */}
      <section className="py-16 md:py-24">
        <Container>
          <div className="grid gap-4 md:grid-cols-3 md:gap-6">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className={cn(
                  "relative flex flex-col justify-between border p-8 transition-colors",
                  plan.highlighted
                    ? "border-ink bg-ink text-cream"
                    : "border-ink-12 bg-white text-ink",
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-6">
                    <Tag tone="sun" size="sm">
                      ★ Most retained
                    </Tag>
                  </div>
                )}
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3
                      className={cn(
                        "font-display text-lg font-semibold tracking-[-0.015em]",
                      )}
                    >
                      {plan.name}
                    </h3>
                    <span
                      className={cn(
                        "font-mono text-[10px] uppercase tracking-[0.14em]",
                        plan.highlighted ? "text-cream/50" : "text-ink-40",
                      )}
                    >
                      {plan.id.padStart(2, "0")} · 03
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-[13px]",
                      plan.highlighted ? "text-cream/70" : "text-ink-60",
                    )}
                  >
                    {plan.tagline}
                  </p>

                  <div className="mt-8 flex items-baseline gap-1 border-b border-current/15 pb-6">
                    <span className="display-md font-medium tabular">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span
                        className={cn(
                          "text-[13px]",
                          plan.highlighted ? "text-cream/50" : "text-ink-40",
                        )}
                      >
                        {plan.period}
                      </span>
                    )}
                  </div>

                  <dl className="mt-6 space-y-2 text-[12.5px]">
                    <div className="flex items-baseline justify-between">
                      <dt
                        className={
                          plan.highlighted ? "text-cream/60" : "text-ink-40"
                        }
                      >
                        Best for
                      </dt>
                      <dd className="max-w-[60%] text-right">{plan.bestFor}</dd>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <dt
                        className={
                          plan.highlighted ? "text-cream/60" : "text-ink-40"
                        }
                      >
                        Operator fee
                      </dt>
                      <dd className="font-mono tabular">{plan.fee}</dd>
                    </div>
                  </dl>

                  <ul className="mt-6 space-y-2.5 text-[13.5px]">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            plan.highlighted ? "text-sun" : "text-ink",
                          )}
                          strokeWidth={2.5}
                        />
                        <span
                          className={
                            plan.highlighted ? "text-cream/90" : "text-ink"
                          }
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <LinkButton
                  to={plan.cta.to}
                  tone={plan.highlighted ? "sun" : "ink"}
                  size="lg"
                  arrow
                  className="mt-10 w-full"
                >
                  {plan.cta.label}
                </LinkButton>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* Comparison table */}
      <section className="border-y border-ink-12 bg-paper py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 02"
            kicker="Everything, compared"
            title={
              <>
                Line-item transparency — <em className="italic">rare</em> in
                this category.
              </>
            }
            lede="Because nobody closes a procurement review without a spreadsheet. Here is the spreadsheet."
            align="split"
          />

          <div className="mt-14 overflow-hidden rounded border border-ink-12 bg-white">
            <table className="w-full text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-ink-12 bg-cream text-ink">
                  <th className="w-[36%] px-5 py-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                    Capability
                  </th>
                  <th className="px-5 py-4 font-display font-semibold">
                    Access
                  </th>
                  <th className="bg-sun/20 px-5 py-4 font-display font-semibold">
                    Practice
                  </th>
                  <th className="px-5 py-4 font-display font-semibold">
                    Bench
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.flatMap((group) => [
                  <tr
                    key={`${group.section}-head`}
                    className="border-y border-ink-12 bg-cream-2"
                  >
                    <td
                      colSpan={4}
                      className="px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60"
                    >
                      {group.section}
                    </td>
                  </tr>,
                  ...group.rows.map(([cap, a, b, c]) => (
                    <tr
                      key={`${group.section}-${cap}`}
                      className="border-b border-ink-08 last:border-b-0"
                    >
                      <td className="px-5 py-4 text-ink">{cap}</td>
                      <td className="px-5 py-4 text-ink-60">{renderCell(a)}</td>
                      <td className="bg-sun/[0.08] px-5 py-4 font-medium text-ink">
                        {renderCell(b)}
                      </td>
                      <td className="px-5 py-4 text-ink-60">{renderCell(c)}</td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      {/* Rate benchmarks */}
      <section className="py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 03"
            kicker="Rate benchmarks"
            title={
              <>
                What the roster actually charges in 2026.
              </>
            }
            lede="Real placement data from the trailing 90 days. Ranges are P10–P90 — the absolute tails are clipped so you don&rsquo;t anchor on outliers."
            align="split"
          />

          <div className="mt-14 space-y-1 border-t border-ink-12">
            {[
              ["Fractional CFO", 180, 320, 420, 4.96],
              ["Senior product designer", 150, 215, 260, 4.92],
              ["SOC 2 compliance lead", 185, 235, 280, 4.94],
              ["Strategy consultant (ex-MBB)", 220, 310, 420, 4.89],
              ["Structural PE", 160, 195, 280, 4.97],
              ["Program director (PgMP)", 140, 185, 260, 4.91],
            ].map(([role, lo, mid, hi, rating]) => {
              const pct = ((mid as number) - (lo as number)) /
                ((hi as number) - (lo as number)) * 100;
              return (
                <div
                  key={role as string}
                  className="grid grid-cols-12 items-center gap-4 border-b border-ink-12 py-5"
                >
                  <div className="col-span-12 md:col-span-3">
                    <p className="font-display text-[15.5px] font-medium text-ink">
                      {role}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-60 tabular">
                      ★ {rating}
                    </p>
                  </div>
                  <div className="col-span-12 md:col-span-7">
                    <div className="relative h-2 w-full overflow-hidden rounded-pill bg-ink-08">
                      <div
                        className="absolute inset-y-0 left-0 h-full bg-ink/20"
                        style={{ width: "100%" }}
                      />
                      <div
                        className="absolute inset-y-0 h-full bg-ink"
                        style={{
                          left: `0%`,
                          width: `${pct}%`,
                        }}
                      />
                      <div
                        className="absolute -top-0.5 h-3 w-[3px] rounded-sm bg-sun"
                        style={{ left: `calc(${pct}% - 1px)` }}
                        aria-hidden
                      />
                    </div>
                  </div>
                  <div className="col-span-12 flex items-baseline justify-between md:col-span-2 md:justify-end md:gap-3">
                    <p className="font-mono text-[11px] text-ink-40 tabular">
                      ${lo}
                    </p>
                    <p className="font-display text-[17px] font-semibold tabular text-ink">
                      ${mid}
                    </p>
                    <p className="font-mono text-[11px] text-ink-40 tabular">
                      ${hi}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-6 border-t border-ink-12 pt-12">
            <div className="max-w-xl">
              <Eyebrow index="§ 04" accent>
                Right-size a plan
              </Eyebrow>
              <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.02] tracking-[-0.025em] text-ink">
                Unsure which plan fits? Tell us your volume — we will pick for
                you.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <LinkButton to="/contact" tone="ink" size="lg" arrow>
                Talk to bench ops
              </LinkButton>
              <LinkButton to="/post-request" tone="outline" size="lg">
                Or post a brief
              </LinkButton>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

function renderCell(value: string) {
  if (value === "—" || value === "-") {
    return (
      <span className="inline-flex items-center text-ink-40">
        <Minus className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (value === "Yes") {
    return (
      <span className="inline-flex items-center gap-1.5 text-ink">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Yes
      </span>
    );
  }
  return value;
}
