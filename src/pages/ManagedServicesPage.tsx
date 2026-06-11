import { useState } from "react";
import {
  Inbox,
  Users,
  ShieldCheck,
  Receipt,
  ClipboardList,
  Eye,
  CalendarClock,
  Layers,
  Check,
} from "lucide-react";
import {
  Container,
  Eyebrow,
  LinkButton,
  Reveal,
  SectionHeader,
  Tag,
  Button,
  FieldInput,
  FieldLabel,
  FieldTextarea,
  FieldSelect,
  FieldHint,
} from "@/components/primitives";
import { submitContact } from "@/lib/api";
import { usePageMeta } from "@/lib/seo";

const steps = [
  {
    num: "01",
    icon: Inbox,
    title: "Onboard with a plan",
    timing: "Week 0",
    desc:
      "A 30-minute scoping call, then a plan — flat monthly retainer or per-task billing. No procurement maze, no per-seat licences.",
    detail:
      "Your account lands in the client portal the same day with a named operations lead and an agreed turnaround SLA.",
  },
  {
    num: "02",
    icon: ClipboardList,
    title: "Submit tasks, not job posts",
    timing: "Any day",
    desc:
      "Drop a task into the portal the way you'd brief an in-house teammate: context, deliverable, deadline. We take it from there.",
    detail:
      "No shortlists to review, no interviews to schedule, no rates to negotiate. The desk accepts the task and runs it.",
  },
  {
    num: "03",
    icon: Users,
    title: "We assign from the managed pool",
    timing: "< 24 hrs",
    desc:
      "Our operations team matches each task to a vetted specialist from the managed pool — contractors we already pay, rate, and re-vet continuously.",
    detail:
      "Every pool member has passed the full WorkSoy vetting bar plus a managed-desk trial period. You never see a stranger's work.",
  },
  {
    num: "04",
    icon: Eye,
    title: "Reviewed before it reaches you",
    timing: "Built-in",
    desc:
      "Deliverables pass an internal quality review before delivery. If it isn't right, we send it back for revision — on our clock, not yours.",
    detail:
      "You see clean statuses only: queued, in progress, delivered. The revision machinery stays on our side of the desk.",
  },
  {
    num: "05",
    icon: Receipt,
    title: "One ledger, one invoice",
    timing: "Month-end",
    desc:
      "Retainer clients get a flat predictable line. Per-task clients get an itemised charge ledger. Either way: one invoice, zero surprises.",
    detail:
      "Every charge is logged against a named task in the portal, so finance can reconcile in minutes — not meetings.",
  },
];

const benefits = [
  {
    icon: CalendarClock,
    title: "Zero hiring loop",
    body: "No briefs, shortlists, or interviews. Submit a task and it gets done. The hiring decision is our problem.",
  },
  {
    icon: ShieldCheck,
    title: "QA before delivery",
    body: "An operations reviewer signs off on every deliverable before you see it. Revisions happen behind the curtain.",
  },
  {
    icon: Receipt,
    title: "Predictable billing",
    body: "Flat monthly retainer or per-task charges — agreed up front, itemised in your ledger, invoiced once a month.",
  },
  {
    icon: Layers,
    title: "A bench, not a body",
    body: "Design today, data tomorrow, ops on Friday. One plan covers the whole managed pool — not a single hire.",
  },
];

const faqs = [
  {
    q: "How is this different from hiring on the WorkSoy marketplace?",
    a: "The marketplace is self-serve: you write a brief, meet finalists, and manage the contractor. Managed service inverts that — you submit tasks and our operations team handles assignment, quality review, and delivery. You never run a hiring loop.",
  },
  {
    q: "Who actually does the work?",
    a: "A curated pool of contractors who have passed the full WorkSoy vetting bar plus a managed-desk trial. We pay them directly, track their performance per task, and rotate the pool based on quality data.",
  },
  {
    q: "Monthly retainer or per-task — which should we pick?",
    a: "Retainer suits teams with a steady stream of work: one flat line, priority queueing. Per-task suits spikier demand: you pay only for what you submit, itemised on the ledger. You can switch plans at any month boundary.",
  },
  {
    q: "What if a deliverable isn't right?",
    a: "Tell us in the portal. Revision requests go straight back to the desk and re-enter internal review before redelivery. Revisions inside the agreed scope don't generate new charges.",
  },
  {
    q: "What kind of tasks fit the managed desk?",
    a: "Well-bounded knowledge work: design assets, data pulls and dashboards, research memos, copy, ops automations, finance hygiene. For open-ended senior engagements — fractional leadership, multi-month builds — the marketplace with a counter-signed SOW is the better instrument.",
  },
];

export function ManagedServicesPage() {
  usePageMeta({
    title: "Managed service",
    description:
      "WorkSoy's fully managed contractor desk — submit tasks, we assign vetted pool talent, review every deliverable, and bill one predictable line.",
    path: "/managed-services",
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    plan: "not_sure",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const planLabel =
      form.plan === "monthly_retainer"
        ? "Monthly retainer"
        : form.plan === "per_task"
          ? "Per-task billing"
          : "Not sure yet";
    try {
      await submitContact({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim() || undefined,
        topic: "managed",
        message: `Plan interest: ${planLabel}\n\n${form.message.trim()}`,
      });
      setSubmitted(true);
      setForm({ name: "", email: "", company: "", plan: "not_sure", message: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request");
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToForm = () => {
    document
      .getElementById("consultation")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="bg-cream" data-testid="managed-services-page">
      {/* Hero */}
      <section className="border-b border-ink-12 pt-16 md:pt-20">
        <Container>
          <div className="flex items-center justify-between border-b border-ink-12 pb-6">
            <Eyebrow index="§ 01" accent>
              The managed desk
            </Eyebrow>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
              Submit · Assigned &lt; 24 hrs · Reviewed · Delivered
            </span>
          </div>
          <div className="grid grid-cols-1 gap-10 pt-10 md:grid-cols-12 md:pt-14">
            <div className="md:col-span-8">
              <h1 className="display-xl text-ink">
                Stop hiring.
                <br />
                Start <em className="italic">submitting</em>.
              </h1>
            </div>
            <div className="md:col-span-4 md:pt-4">
              <p className="prose-lede">
                A fully managed contractor desk. You send tasks; we assign
                vetted pool specialists, review every deliverable before it
                reaches you, and bill one predictable line.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Tag tone="outline" size="sm">Curated pool</Tag>
                <Tag tone="outline" size="sm">QA before delivery</Tag>
                <Tag tone="outline" size="sm">Retainer or per-task</Tag>
                <Tag tone="outline" size="sm">One invoice</Tag>
              </div>
              <div className="mt-8">
                <Button
                  tone="ink"
                  size="lg"
                  arrow
                  onClick={scrollToForm}
                  data-testid="managed-hero-cta"
                >
                  Request a consultation
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 02"
            kicker="How the desk runs"
            title={
              <>
                Five moves.
                <br className="hidden md:block" /> None of them yours.
              </>
            }
            lede="From onboarding call to month-end invoice, every step has a named owner on our operations team — and a status you can read in the portal."
            align="split"
          />
          <ol className="mt-14 divide-y divide-ink-12 border-y border-ink-12">
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
                      {s.timing}
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

      {/* Benefits — contrast band */}
      <section className="border-y border-ink-12 bg-ink py-20 text-cream md:py-28">
        <Container>
          <SectionHeader
            index="§ 03"
            kicker="Why a desk, not a hire"
            title={
              <span className="text-cream">
                The overhead of contractors,
                <br className="hidden md:block" /> deleted.
              </span>
            }
            lede={
              <span className="text-cream/70">
                Four structural advantages over running your own freelancer
                bench — or burning senior time on sourcing, QA, and invoices.
              </span>
            }
            align="split"
          />
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b, i) => (
              <Reveal
                key={b.title}
                delay={i * 50}
                className="group rounded border border-cream/15 bg-cream/5 p-6 transition-colors hover:border-sun"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded bg-cream text-ink transition-colors group-hover:bg-sun">
                  <b.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-cream">
                  {b.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-cream/70">
                  {b.body}
                </p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Plans */}
      <section className="py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 04"
            kicker="Two ways to pay"
            title={
              <>
                Pick the meter
                <br className="hidden md:block" /> that fits your demand.
              </>
            }
            lede="Both plans run on the same desk, the same pool, and the same quality bar. The only difference is how the ledger ticks."
            align="split"
          />
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                name: "Monthly retainer",
                tagline: "For a steady stream of work",
                points: [
                  "One flat monthly line — agreed at onboarding",
                  "Priority queueing on every task",
                  "Unlimited task submissions within scope",
                  "Named operations lead, weekly pulse",
                ],
                note: "Most managed clients run on retainer.",
                featured: true,
              },
              {
                name: "Per-task billing",
                tagline: "For spiky, occasional demand",
                points: [
                  "Pay only for the tasks you submit",
                  "Each charge itemised on your ledger",
                  "Same vetted pool, same QA review",
                  "Switch to retainer at any month boundary",
                ],
                note: "No minimums, no monthly commitment.",
                featured: false,
              },
            ].map((p, i) => (
              <Reveal
                key={p.name}
                delay={i * 60}
                className={
                  p.featured
                    ? "rounded border-2 border-ink bg-white p-8"
                    : "rounded border border-ink-12 bg-white p-8"
                }
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
                    {p.tagline}
                  </p>
                  {p.featured && (
                    <Tag tone="sun" size="sm">
                      Most common
                    </Tag>
                  )}
                </div>
                <h3 className="mt-3 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-medium tracking-[-0.02em] text-ink">
                  {p.name}
                </h3>
                <ul className="mt-6 space-y-3">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-ink-60">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={2} />
                      {pt}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 border-t border-ink-12 pt-4 text-[12.5px] text-ink-40">
                  {p.note} Plan rates are set at your scoping call — sized to
                  your task mix, not a public sticker.
                </p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="border-t border-ink-12 py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 05"
            kicker="Frequently checked"
            title={
              <>
                The questions finance
                <br className="hidden md:block" /> and ops actually ask.
              </>
            }
            align="split"
          />
          <div className="mt-14 divide-y divide-ink-12 border-y border-ink-12">
            {faqs.map((f, i) => (
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

      {/* Consultation form */}
      <section id="consultation" className="scroll-mt-24 pb-24">
        <Container>
          <div className="grid grid-cols-1 gap-10 border-t border-ink-12 pt-16 md:grid-cols-12 md:gap-12">
            <div className="md:col-span-5">
              <Eyebrow index="§ 06" accent>
                Open the desk
              </Eyebrow>
              <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.02] tracking-[-0.025em] text-ink">
                Request a consultation.
              </h2>
              <p className="prose-lede mt-4">
                Tell us roughly what your team keeps outsourcing — design,
                data, research, ops. We reply within one business day with a
                scoping call slot and a draft plan shape.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  ["Reply", "< 1 business day"],
                  ["Scoping call", "30 minutes, no deck"],
                  ["Portal live", "Same day as signature"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between border-b border-ink-12 pb-3"
                  >
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                      {k}
                    </span>
                    <span className="font-display text-[15px] font-medium text-ink">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-7">
              <div className="rounded border border-ink-12 bg-white">
                <div className="flex items-center justify-between border-b border-ink-12 bg-cream-2 px-6 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                    Managed desk · Consultation
                  </p>
                  <p className="font-mono text-[11px] tabular text-ink-60">
                    05 fields
                  </p>
                </div>

                {submitted ? (
                  <div
                    className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center"
                    data-testid="managed-lead-success"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sun">
                      <Check className="h-6 w-6 text-ink" strokeWidth={2.5} />
                    </div>
                    <h3 className="font-display text-2xl font-medium text-ink">
                      Request filed.
                    </h3>
                    <p className="max-w-sm text-[14px] leading-relaxed text-ink-60">
                      Our operations lead will reply within one business day
                      with a scoping call slot and a first read on plan shape.
                    </p>
                    <Button
                      tone="outline"
                      size="md"
                      onClick={() => setSubmitted(false)}
                      data-testid="managed-lead-send-another"
                    >
                      Send another
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="grid grid-cols-2 gap-4 p-6"
                    data-testid="managed-lead-form"
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel htmlFor="ms-name">
                        Your name <span className="text-rust">*</span>
                      </FieldLabel>
                      <FieldInput
                        id="ms-name"
                        required
                        data-testid="managed-lead-name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel htmlFor="ms-email">
                        Work email <span className="text-rust">*</span>
                      </FieldLabel>
                      <FieldInput
                        id="ms-email"
                        type="email"
                        required
                        data-testid="managed-lead-email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel htmlFor="ms-company">Company</FieldLabel>
                      <FieldInput
                        id="ms-company"
                        data-testid="managed-lead-company"
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel htmlFor="ms-plan">Plan interest</FieldLabel>
                      <FieldSelect
                        id="ms-plan"
                        data-testid="managed-lead-plan"
                        value={form.plan}
                        onChange={(e) => setForm({ ...form, plan: e.target.value })}
                      >
                        <option value="not_sure">Not sure yet</option>
                        <option value="monthly_retainer">Monthly retainer</option>
                        <option value="per_task">Per-task billing</option>
                      </FieldSelect>
                    </div>
                    <div className="col-span-2">
                      <FieldLabel htmlFor="ms-message">
                        What does your team keep outsourcing?{" "}
                        <span className="text-rust">*</span>
                      </FieldLabel>
                      <FieldTextarea
                        id="ms-message"
                        required
                        rows={5}
                        data-testid="managed-lead-message"
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        placeholder="A short paragraph is plenty — the kinds of tasks, rough monthly volume, and when you'd want the desk live."
                      />
                      <FieldHint>
                        Confidential. Lands directly with the managed-desk
                        operations lead.
                      </FieldHint>
                    </div>
                    {error && (
                      <div
                        className="col-span-2 rounded border border-rust/40 bg-rust/5 px-4 py-3 text-[13px] text-rust"
                        data-testid="managed-lead-error"
                      >
                        {error}
                      </div>
                    )}
                    <div className="col-span-2 flex items-center justify-between gap-4 border-t border-ink-12 pt-5">
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                        No sales sequence · One reply
                      </p>
                      <Button
                        tone="ink"
                        size="lg"
                        arrow
                        type="submit"
                        disabled={submitting}
                        data-testid="managed-lead-submit"
                      >
                        {submitting ? "Sending…" : "Request consultation"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <p className="text-[13px] text-ink-60">
                  Prefer the self-serve marketplace instead?
                </p>
                <LinkButton to="/how-it-works" tone="outline" size="sm">
                  See how hiring works
                </LinkButton>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                <p className="text-[13px] text-ink-60">
                  Are you a contractor? The desk is hiring.
                </p>
                <LinkButton
                  to="/managed-talent"
                  tone="outline"
                  size="sm"
                  data-testid="managed-talent-crosslink"
                >
                  Join the managed pool
                </LinkButton>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
