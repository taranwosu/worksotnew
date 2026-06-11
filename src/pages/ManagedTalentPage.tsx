import { useEffect, useState } from "react";
import {
  Inbox,
  ShieldCheck,
  Banknote,
  CalendarCheck,
  ClipboardList,
  BadgeCheck,
  FlaskConical,
  Users,
  Check,
  Clock,
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
  FieldHint,
} from "@/components/primitives";
import { useSession } from "@/lib/auth-client";
import {
  applyToPool,
  fetchMyPoolApplication,
  fetchMyPoolMembership,
  type PoolApplication,
  type PoolMember,
} from "@/lib/api";
import { usePageMeta } from "@/lib/seo";

const reasons = [
  {
    icon: Inbox,
    title: "Tasks land in your queue",
    body: "No pitching, no proposals, no bidding wars. Scoped tasks arrive assigned — you accept the work, not the sales cycle.",
  },
  {
    icon: ShieldCheck,
    title: "We handle the client",
    body: "Scope pushback, revision triage, and awkward conversations run through the operations desk. You talk craft, we talk client.",
  },
  {
    icon: Banknote,
    title: "Paid on your rate, reliably",
    body: "Your cost rate is agreed once — hourly or per-task — and every completed task lands on the ledger. No invoicing chase.",
  },
  {
    icon: CalendarCheck,
    title: "Fill the gaps between gigs",
    body: "Keep your marketplace engagements. The pool is steady fill-in work that flexes around your availability, not against it.",
  },
];

const path = [
  {
    num: "01",
    icon: ClipboardList,
    title: "Apply or opt in",
    desc: "Already on WorkSoy? Opt in below in two minutes. New here? You go through the standard WorkSoy expert application — same bar, same process.",
  },
  {
    num: "02",
    icon: BadgeCheck,
    title: "Pass the WorkSoy vetting",
    desc: "Identity, references, and a practice-specific work sample. Already-vetted experts skip straight past this step — you're fast-tracked.",
  },
  {
    num: "03",
    icon: FlaskConical,
    title: "Run a trial task",
    desc: "One paid, scoped managed task reviewed by the operations desk. It calibrates your rate, turnaround, and the kind of work we route to you.",
  },
  {
    num: "04",
    icon: Users,
    title: "You're in the pool",
    desc: "Tasks appear in your workspace, deliverables go through QA, and your per-task ratings compound into more (and better) assignments.",
  },
];

const faqs = [
  {
    q: "Do I have to leave the marketplace to join the pool?",
    a: "No. Pool membership sits alongside your normal WorkSoy profile. You can run marketplace engagements and managed tasks in parallel — many pool members use managed work to smooth the gaps between bigger contracts.",
  },
  {
    q: "How is my rate set?",
    a: "At onboarding the operations desk agrees a cost rate with you — hourly or per-task. It's your floor, not a bid. Clients never see it and never negotiate it; they pay the desk, the desk pays you.",
  },
  {
    q: "What kind of work will I get?",
    a: "Well-bounded knowledge tasks matched to your declared skills: design assets, data pulls, research memos, copy, ops automations. You see the full scope before anything is assigned to you.",
  },
  {
    q: "What happens if a deliverable gets a revision request?",
    a: "It comes back through the desk with specific, reviewed feedback — never a raw client rant. Reasonable revisions are part of the task; chronic scope creep is the desk's problem to push back on, not yours.",
  },
  {
    q: "How do ratings work?",
    a: "Each completed task gets an internal quality rating from the reviewing admin. Higher ratings mean priority on assignment and richer tasks. Ratings are internal — they never appear on your public profile.",
  },
];

export function ManagedTalentPage() {
  usePageMeta({
    title: "Join the managed pool",
    description:
      "Steady, scoped tasks without bizdev. Apply to join WorkSoy's managed contractor pool — we handle the client, you handle the craft.",
    path: "/managed-talent",
  });

  const { data: session, isPending } = useSession();
  const [membership, setMembership] = useState<PoolMember | null>(null);
  const [application, setApplication] = useState<PoolApplication | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      setMembership(null);
      setApplication(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    Promise.all([fetchMyPoolMembership(), fetchMyPoolApplication()]).then(
      ([m, a]) => {
        if (cancelled) return;
        setMembership(m);
        setApplication(a);
        setChecking(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [session?.user?._id, isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToApply = () => {
    document
      .getElementById("apply")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="bg-cream" data-testid="managed-talent-page">
      {/* Hero */}
      <section className="border-b border-ink-12 pt-16 md:pt-20">
        <Container>
          <div className="flex items-center justify-between border-b border-ink-12 pb-6">
            <Eyebrow index="§ 01" accent>
              The talent side
            </Eyebrow>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
              Apply · Vetted · Trial task · In the pool
            </span>
          </div>
          <div className="grid grid-cols-1 gap-10 pt-10 md:grid-cols-12 md:pt-14">
            <div className="md:col-span-8">
              <h1 className="display-xl text-ink">
                Do the work.
                <br />
                Skip the <em className="italic">bizdev</em>.
              </h1>
            </div>
            <div className="md:col-span-4 md:pt-4">
              <p className="prose-lede">
                The managed pool is WorkSoy's back-office bench: scoped tasks
                assigned straight to you, deliverables reviewed by our desk,
                and your rate paid on every completed task.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Tag tone="outline" size="sm">No pitching</Tag>
                <Tag tone="outline" size="sm">Your rate, agreed once</Tag>
                <Tag tone="outline" size="sm">Desk handles clients</Tag>
                <Tag tone="outline" size="sm">Flexes with your gigs</Tag>
              </div>
              <div className="mt-8">
                <Button
                  tone="ink"
                  size="lg"
                  arrow
                  onClick={scrollToApply}
                  data-testid="talent-hero-cta"
                >
                  Apply to join the pool
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Why join — contrast band */}
      <section className="border-b border-ink-12 bg-ink py-20 text-cream md:py-28">
        <Container>
          <SectionHeader
            index="§ 02"
            kicker="Why contractors join"
            title={
              <span className="text-cream">
                Everything you bill for,
                <br className="hidden md:block" /> nothing you don't.
              </span>
            }
            lede={
              <span className="text-cream/70">
                Independent work is 40% selling and chasing. The pool deletes
                that 40% — the desk sources, scopes, and collects, so your
                hours go to the craft.
              </span>
            }
            align="split"
          />
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {reasons.map((r, i) => (
              <Reveal
                key={r.title}
                delay={i * 50}
                className="group rounded border border-cream/15 bg-cream/5 p-6 transition-colors hover:border-sun"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded bg-cream text-ink transition-colors group-hover:bg-sun">
                  <r.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-cream">
                  {r.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-cream/70">
                  {r.body}
                </p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* The path in */}
      <section className="py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 03"
            kicker="The path in"
            title={
              <>
                Four steps.
                <br className="hidden md:block" /> Vetted experts skip one.
              </>
            }
            lede="Already passed WorkSoy vetting? You're fast-tracked — opt in below and the desk picks it up from your existing file."
            align="split"
          />
          <ol className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded border border-ink-12 bg-ink-12 md:grid-cols-2 lg:grid-cols-4">
            {path.map((s, i) => (
              <Reveal
                as="li"
                key={s.num}
                delay={i * 50}
                className="bg-white p-7"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-cream-2 text-ink">
                    <s.icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <span className="font-display text-[clamp(2rem,4vw,2.75rem)] font-medium leading-none text-ink-20 tabular">
                    {s.num}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink">
                  {s.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-60">
                  {s.desc}
                </p>
              </Reveal>
            ))}
          </ol>
        </Container>
      </section>

      {/* The bar */}
      <section className="border-y border-ink-12 bg-paper py-20 md:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <Eyebrow index="§ 04" accent>
                The bar
              </Eyebrow>
              <h2 className="mt-4 font-display text-[clamp(1.75rem,3.2vw,2.5rem)] font-medium leading-[1.05] tracking-[-0.022em] text-ink">
                The desk only works because the pool is small and sharp.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-60">
                Managed clients never see your name — they see WorkSoy's. That
                only holds if every deliverable holds. We'd rather route you
                three great tasks a month than ten mediocre ones.
              </p>
            </div>
            <div className="md:col-span-6 md:col-start-7">
              <ul className="divide-y divide-ink-12 border-y border-ink-12">
                {[
                  ["Turnaround", "Accept within 24h of assignment, deliver inside the task window."],
                  ["Communication", "Status comments in the workspace — the desk reads everything, daily."],
                  ["Quality", "Deliverables pass internal review before the client ever sees them."],
                  ["Availability", "Set it honestly. Declining a task is fine; ghosting one isn't."],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-start gap-5 py-5">
                    <span className="w-32 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                      {k}
                    </span>
                    <span className="text-[14.5px] leading-relaxed text-ink">
                      {v}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28">
        <Container>
          <SectionHeader
            index="§ 05"
            kicker="Frequently checked"
            title={
              <>
                What contractors
                <br className="hidden md:block" /> actually ask first.
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

      {/* Apply */}
      <section id="apply" className="scroll-mt-24 pb-24">
        <Container>
          <div className="grid grid-cols-1 gap-10 border-t border-ink-12 pt-16 md:grid-cols-12 md:gap-12">
            <div className="md:col-span-5">
              <Eyebrow index="§ 06" accent>
                Raise your hand
              </Eyebrow>
              <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.02] tracking-[-0.025em] text-ink">
                Apply to join the pool.
              </h2>
              <p className="prose-lede mt-4">
                Already vetted on WorkSoy? You're fast-tracked — the desk
                reviews your file, agrees a rate, and routes a trial task. New
                to WorkSoy? You'll go through the standard expert application
                first.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  ["Review", "< 1 week"],
                  ["Trial task", "Paid, scoped, reviewed"],
                  ["Vetted experts", "Fast-tracked"],
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
              <ApplyPanel
                signedIn={!!session}
                loading={isPending || checking}
                membership={membership}
                application={application}
                onApplied={setApplication}
              />
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

function ApplyPanel({
  signedIn,
  loading,
  membership,
  application,
  onApplied,
}: {
  signedIn: boolean;
  loading: boolean;
  membership: PoolMember | null;
  application: PoolApplication | null;
  onApplied: (a: PoolApplication) => void;
}) {
  if (loading) {
    return (
      <div className="h-64 animate-pulse rounded border border-ink-12 bg-white" />
    );
  }

  if (membership) {
    return (
      <PanelShell label="Managed pool · Member">
        <StatusCard
          testId="talent-pool-member-card"
          icon={<Check className="h-6 w-6 text-ink" strokeWidth={2.5} />}
          title="You're in the pool."
          body="Your membership is active. Assigned tasks appear in your pool workspace — the desk routes work matched to your declared skills."
        >
          <LinkButton to="/pool/tasks" tone="ink" size="md" arrow>
            Open my pool tasks
          </LinkButton>
        </StatusCard>
      </PanelShell>
    );
  }

  if (application && application.status === "pending") {
    return (
      <PanelShell label="Managed pool · Application">
        <StatusCard
          testId="talent-pending-card"
          icon={<Clock className="h-6 w-6 text-ink" strokeWidth={2.5} />}
          title="Application received."
          body="The operations desk reviews pool applications weekly. If your skills match current client demand, you'll hear back with a rate conversation and a trial task."
        />
      </PanelShell>
    );
  }

  if (signedIn) {
    return <ApplyForm onApplied={onApplied} reapplying={!!application} />;
  }

  return (
    <PanelShell label="Managed pool · Two ways in">
      <div className="grid grid-cols-1 gap-px bg-ink-12 sm:grid-cols-2">
        <div className="bg-white p-7">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
            Already on WorkSoy?
          </p>
          <h3 className="mt-2 font-display text-xl font-medium text-ink">
            Sign in to opt in.
          </h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-60">
            Two-minute opt-in form. Vetted experts are fast-tracked straight to
            the rate conversation.
          </p>
          <div className="mt-5">
            <LinkButton
              to="/signin"
              tone="ink"
              size="md"
              arrow
              data-testid="talent-signin-cta"
            >
              Sign in to apply
            </LinkButton>
          </div>
        </div>
        <div className="bg-white p-7">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
            New to WorkSoy?
          </p>
          <h3 className="mt-2 font-display text-xl font-medium text-ink">
            Apply to join WorkSoy.
          </h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-60">
            Same application as every WorkSoy expert — vetting, references,
            work sample. Mention the managed pool in your application.
          </p>
          <div className="mt-5">
            <LinkButton
              to="/onboarding/expert"
              tone="outline"
              size="md"
              data-testid="talent-onboarding-cta"
            >
              Start the application
            </LinkButton>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

function ApplyForm({
  onApplied,
  reapplying,
}: {
  onApplied: (a: PoolApplication) => void;
  reapplying: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ skills: "", rate: "", note: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const app = await applyToPool({
        skills: form.skills.trim(),
        rate_expectation: form.rate.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      onApplied(app);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PanelShell
      label="Managed pool · Opt-in"
      right={reapplying ? "Re-application" : "03 fields"}
    >
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-4 p-6"
        data-testid="talent-apply-form"
      >
        <div className="col-span-2">
          <FieldLabel htmlFor="pt-skills">
            Skills you'd take managed tasks in{" "}
            <span className="text-rust">*</span>
          </FieldLabel>
          <FieldInput
            id="pt-skills"
            required
            data-testid="talent-skills"
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
            placeholder="e.g. Brand design, Figma production, data dashboards"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel htmlFor="pt-rate">Rate expectation</FieldLabel>
          <FieldInput
            id="pt-rate"
            data-testid="talent-rate"
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: e.target.value })}
            placeholder="e.g. $90/hr or $400/task"
          />
          <FieldHint>Optional — a starting point, not a bid.</FieldHint>
        </div>
        <div className="col-span-2">
          <FieldLabel htmlFor="pt-note">Anything else?</FieldLabel>
          <FieldTextarea
            id="pt-note"
            rows={4}
            data-testid="talent-note"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Availability, portfolio link, the kind of tasks you want — anything that helps the desk route you well."
          />
        </div>
        {error && (
          <div
            className="col-span-2 rounded border border-rust/40 bg-rust/5 px-4 py-3 text-[13px] text-rust"
            data-testid="talent-apply-error"
          >
            {error}
          </div>
        )}
        <div className="col-span-2 flex items-center justify-between gap-4 border-t border-ink-12 pt-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
            Reviewed weekly · Internal only
          </p>
          <Button
            tone="ink"
            size="lg"
            arrow
            type="submit"
            disabled={submitting}
            data-testid="talent-submit"
          >
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </form>
    </PanelShell>
  );
}

function PanelShell({
  label,
  right,
  children,
}: {
  label: string;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded border border-ink-12 bg-white">
      <div className="flex items-center justify-between border-b border-ink-12 bg-cream-2 px-6 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
          {label}
        </p>
        {right && (
          <p className="font-mono text-[11px] tabular text-ink-60">{right}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function StatusCard({
  icon,
  title,
  body,
  children,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
  testId: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center"
      data-testid={testId}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sun">
        {icon}
      </div>
      <h3 className="font-display text-2xl font-medium text-ink">{title}</h3>
      <p className="max-w-sm text-[14px] leading-relaxed text-ink-60">{body}</p>
      {children}
    </div>
  );
}
