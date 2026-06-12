import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  CheckCircle2,
  Languages,
  Brain,
  PhoneCall,
  Hammer,
  Award,
  ArrowRight,
  Clock,
  XCircle,
  Paperclip,
  Upload,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import {
  fetchMyExpertProfile,
  getMyVetting,
  submitLanguageTest,
  submitSkillTest,
  getMyTestProject,
  submitTestProject,
  uploadFile,
  fileDownloadUrl,
  type VettingApplication,
  type TestProject,
} from "@/lib/api";
import {
  Container,
  Eyebrow,
  Button,
  LinkButton,
  Tag,
  FieldInput,
  FieldLabel,
  FieldTextarea,
} from "@/components/primitives";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "language_personality", label: "Language & personality", icon: Languages, blurb: "10-minute screen — communication, timezone, fit.", eta: "10 min · same day review" },
  { key: "skill_quiz", label: "Skill questionnaire", icon: Brain, blurb: "Case-study + methodology — domain expertise check.", eta: "45 min · 1–2 day review" },
  { key: "screening_call", label: "Live screening call", icon: PhoneCall, blurb: "30-min call with a senior matcher. Pass to continue.", eta: "30 min · schedule within 3 days" },
  { key: "test_project", label: "Paid test project", icon: Hammer, blurb: "A scoped, real engagement reviewed by our panel.", eta: "3–7 days · panel review 2 days" },
  { key: "approved", label: "Approved · on roster", icon: Award, blurb: "Verified badge unlocks; you can submit proposals.", eta: "—" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

function stageIndex(stage: string): number {
  const i = STAGES.findIndex((s) => s.key === stage);
  return i === -1 ? 0 : i;
}

export function VettingPage() {
  usePageMeta({
    title: "Vetting",
    path: "/vetting",
    robots: "noindex,nofollow",
  });
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const [app, setApp] = useState<VettingApplication | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testProject, setTestProject] = useState<TestProject | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const profile = await fetchMyExpertProfile().catch(() => null);
      setHasProfile(Boolean(profile));
      if (profile) {
        const a = await getMyVetting();
        setApp(a);
        if (a.stage === "test_project") {
          const tp = await getMyTestProject().catch(() => null);
          setTestProject(tp);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/signin" });
  }, [isPending, session, navigate]);

  useEffect(() => {
    if (session) load();
  }, [session]);

  if (isPending || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-40" />
      </div>
    );
  }
  if (!session) return null;

  if (!hasProfile) {
    return (
      <div className="bg-cream py-20">
        <Container>
          <div className="mx-auto max-w-xl text-center">
            <Eyebrow index="§ 00" accent>Vetting</Eyebrow>
            <h1 className="mt-4 font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
              Create your expert profile first.
            </h1>
            <p className="mt-3 text-[15px] text-ink-60">
              The vetting gauntlet begins once your profile exists. Takes ~3 minutes.
            </p>
            <div className="mt-8">
              <LinkButton to="/onboarding/expert" tone="ink" size="lg" arrow>
                Start application
              </LinkButton>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  if (!app) return null;

  const currentIdx = stageIndex(app.stage);
  const isApproved = app.stage === "approved";
  const isRejected = app.stage === "rejected";

  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20" data-testid="vetting-page">
      <Container>
        <div className="border-b border-ink-12 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Eyebrow index="§ V" accent>Vetting gauntlet</Eyebrow>
              <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.02] tracking-[-0.02em] text-ink">
                {isApproved
                  ? "You're on the roster."
                  : isRejected
                    ? "Application closed for this round."
                    : "Five stages from application to roster."}
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-60">
                We accept about 3% of applicants. Each stage is reviewed by a human.
                You'll be notified by email + in-app the moment we advance you.
              </p>
            </div>
            {isApproved && <Tag tone="sun" size="md">Verified · Approved</Tag>}
            {isRejected && <Tag tone="outline" size="md">Closed</Tag>}
          </div>
        </div>

        {/* Progress tracker — answers "where am I?", "what's next?", "ETA?"
            in one glance. Shown when the gauntlet is in progress. */}
        {!isApproved && !isRejected && (
          <div
            data-testid="vetting-tracker"
            className="mt-8 rounded border border-ink-12 bg-white p-6 md:p-7"
          >
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                  Your progress
                </p>
                <p className="mt-2 font-display text-[28px] font-medium leading-none tracking-[-0.02em] text-ink">
                  Stage <span className="tabular">{currentIdx + 1}</span>
                  <span className="text-ink-40"> / {STAGES.length}</span>
                  <span className="ml-3 text-[16px] text-ink-60">· {STAGES[currentIdx].label}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                  Complete
                </p>
                <p className="mt-2 font-display text-[28px] font-medium tabular text-ink">
                  {Math.round((currentIdx / (STAGES.length - 1)) * 100)}%
                </p>
              </div>
            </div>

            {/* Bar */}
            <div className="mt-5 h-2 w-full overflow-hidden rounded-pill bg-ink-08">
              <div
                className="h-full bg-ink transition-[width] duration-500"
                style={{ width: `${(currentIdx / (STAGES.length - 1)) * 100}%` }}
              />
            </div>

            {/* What's next + ETA */}
            <div className="mt-6 grid gap-5 md:grid-cols-3 md:gap-8">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
                  Right now
                </p>
                <p className="mt-1.5 text-[13.5px] leading-snug text-ink">
                  {STAGES[currentIdx].blurb}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
                  Typical time
                </p>
                <p className="mt-1.5 text-[13.5px] leading-snug text-ink">
                  {STAGES[currentIdx].eta}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
                  Next step
                </p>
                <p className="mt-1.5 text-[13.5px] leading-snug text-ink">
                  {currentIdx + 1 < STAGES.length
                    ? STAGES[currentIdx + 1].label
                    : "Listed on the roster"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stage strip */}
        <ol className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-5" data-testid="vetting-stages">
          {STAGES.map((s, i) => {
            const done = i < currentIdx || isApproved;
            const active = i === currentIdx && !isApproved && !isRejected;
            const Icon = s.icon;
            return (
              <li
                key={s.key}
                data-testid={`stage-${s.key}`}
                className={cn(
                  "relative rounded border p-4 transition-colors",
                  done
                    ? "border-ink bg-ink text-cream"
                    : active
                      ? "border-sun bg-sun/15 text-ink"
                      : "border-ink-12 bg-white text-ink-60",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-[0.14em]">
                    0{i + 1}
                  </span>
                  {done && <CheckCircle2 className="h-4 w-4 text-sun" />}
                  {active && <Clock className="h-4 w-4 text-ink" />}
                </div>
                <Icon className={cn("mt-3 h-5 w-5", done ? "text-sun" : active ? "text-ink" : "text-ink-40")} strokeWidth={1.6} />
                <p className={cn("mt-2 font-display text-[14px] font-semibold leading-snug", done ? "text-cream" : "text-ink")}>
                  {s.label}
                </p>
                <p className={cn("mt-1 text-[11.5px] leading-snug", done ? "text-cream/70" : "text-ink-60")}>
                  {s.blurb}
                </p>
              </li>
            );
          })}
        </ol>

        {/* Stage panels */}
        <section className="mt-12">
          {app.stage === "language_personality" && <LanguageStage onSubmitted={load} />}
          {app.stage === "skill_quiz" && <SkillStage onSubmitted={load} />}
          {app.stage === "screening_call" && <ScreeningStage app={app} />}
          {app.stage === "test_project" && (
            <TestProjectStage app={app} testProject={testProject} onSubmitted={load} />
          )}
          {app.stage === "approved" && <ApprovedPanel />}
          {app.stage === "rejected" && <RejectedPanel note={app.decision_note} />}
        </section>

        {/* History */}
        {app.history && app.history.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-[18px] font-semibold text-ink">Status log</h2>
            <ul className="mt-4 divide-y divide-ink-10 rounded border border-ink-12 bg-white">
              {[...app.history].reverse().map((h, i) => (
                <li key={i} className="flex items-baseline justify-between px-5 py-3">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{prettyStage(h.stage)}</p>
                    {h.note && <p className="mt-0.5 text-[12px] text-ink-60">{h.note}</p>}
                    <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-40">
                      by {h.by}
                    </p>
                  </div>
                  <span className="font-mono tabular text-[11px] text-ink-60">
                    {new Date(h.at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>
    </div>
  );
}

function prettyStage(s: string) {
  const f = STAGES.find((x) => x.key === s);
  if (f) return f.label;
  if (s === "rejected") return "Closed";
  return s;
}

function StageHeader({ kicker, title, blurb }: { kicker: string; title: string; blurb: string }) {
  return (
    <div className="border-b border-ink-12 pb-6">
      <Eyebrow index={kicker} accent>Current step</Eyebrow>
      <h2 className="mt-3 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-60">{blurb}</p>
    </div>
  );
}

function LanguageStage({ onSubmitted }: { onSubmitted: () => void }) {
  const [tz, setTz] = useState("America/New_York");
  const [hours, setHours] = useState("30");
  const [rating, setRating] = useState("4");
  const [style, setStyle] = useState("");
  const [why, setWhy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await submitLanguageTest({
        timezone: tz,
        weekly_hours: parseInt(hours, 10) || 0,
        english_self_rating: parseInt(rating, 10) || 1,
        communication_style: style,
        why_worksoy: why,
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded border border-ink-12 bg-white p-7 md:p-10" data-testid="stage-panel-language">
      <StageHeader
        kicker="§ V1"
        title="Language & personality."
        blurb="Five questions. About 10 minutes. We screen for English fluency, working hours, and how you communicate when work gets messy."
      />
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <FieldLabel htmlFor="tz">Primary timezone</FieldLabel>
            <FieldInput id="tz" required value={tz} onChange={(e) => setTz(e.target.value)} data-testid="vet-lang-timezone" />
          </div>
          <div>
            <FieldLabel htmlFor="hours">Hours / week available</FieldLabel>
            <FieldInput id="hours" type="number" min={1} max={80} required value={hours} onChange={(e) => setHours(e.target.value)} data-testid="vet-lang-hours" />
          </div>
          <div>
            <FieldLabel htmlFor="rating">English self-rating (1–5)</FieldLabel>
            <FieldInput id="rating" type="number" min={1} max={5} required value={rating} onChange={(e) => setRating(e.target.value)} data-testid="vet-lang-rating" />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="style">Describe how you communicate when a project goes off-track.</FieldLabel>
          <FieldTextarea id="style" rows={5} required minLength={20} value={style} onChange={(e) => setStyle(e.target.value)} data-testid="vet-lang-style" placeholder="A real example is better than abstract values…" />
        </div>
        <div>
          <FieldLabel htmlFor="why">Why WorkSoy?</FieldLabel>
          <FieldTextarea id="why" rows={4} required minLength={20} value={why} onChange={(e) => setWhy(e.target.value)} data-testid="vet-lang-why" placeholder="What do you want out of being on the roster?" />
        </div>
        {error && (
          <div role="alert" className="rounded border border-rust/30 bg-rust/5 px-4 py-3 text-[13px] text-rust">
            {error}
          </div>
        )}
        <Button data-testid="vet-lang-submit" tone="ink" size="lg" type="submit" disabled={saving} className="w-full md:w-auto" iconLeft={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} arrow={!saving}>
          {saving ? "Submitting…" : "Submit & continue"}
        </Button>
      </form>
    </div>
  );
}

function SkillStage({ onSubmitted }: { onSubmitted: () => void }) {
  const [caseStudy, setCase] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [method, setMethod] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await submitSkillTest({
        case_study: caseStudy,
        portfolio_url: portfolio || undefined,
        methodology: method,
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded border border-ink-12 bg-white p-7 md:p-10" data-testid="stage-panel-skill">
      <StageHeader
        kicker="§ V2"
        title="Skill questionnaire."
        blurb="Walk us through a recent engagement that shows your domain expertise. We're looking for depth, judgement, and clear reasoning."
      />
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <FieldLabel htmlFor="case">Recent case study (80+ characters)</FieldLabel>
          <FieldTextarea id="case" rows={8} required minLength={80} value={caseStudy} onChange={(e) => setCase(e.target.value)} data-testid="vet-skill-case" placeholder="Project + your role + the outcome (and the trade-offs)." />
        </div>
        <div>
          <FieldLabel htmlFor="port">Portfolio / proof URL (optional)</FieldLabel>
          <FieldInput id="port" type="url" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} data-testid="vet-skill-portfolio" placeholder="https://…" />
        </div>
        <div>
          <FieldLabel htmlFor="method">Your methodology when starting a new engagement</FieldLabel>
          <FieldTextarea id="method" rows={6} required minLength={50} value={method} onChange={(e) => setMethod(e.target.value)} data-testid="vet-skill-method" placeholder="The first 7 days — what do you do, what do you ask, what do you deliver?" />
        </div>
        {error && (
          <div role="alert" className="rounded border border-rust/30 bg-rust/5 px-4 py-3 text-[13px] text-rust">
            {error}
          </div>
        )}
        <Button data-testid="vet-skill-submit" tone="ink" size="lg" type="submit" disabled={saving} className="w-full md:w-auto" iconLeft={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} arrow={!saving}>
          {saving ? "Submitting…" : "Submit & continue"}
        </Button>
      </form>
    </div>
  );
}

function ScreeningStage({ app }: { app: VettingApplication }) {
  return (
    <div className="rounded border border-ink-12 bg-white p-7 md:p-10" data-testid="stage-panel-screening">
      <StageHeader
        kicker="§ V3"
        title="Live screening call."
        blurb="A senior matcher will book a 30-minute call. We'll email you with a link inside 2 working days."
      />
      <div className="mt-6 rounded border border-ink-12 bg-cream-2 p-5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-ink-60" />
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">Awaiting scheduling</p>
        </div>
        <p className="mt-2 text-[14px] text-ink-60">
          {app.screening_scheduled_at
            ? `Scheduled for ${new Date(app.screening_scheduled_at).toLocaleString()}.`
            : "No call scheduled yet — check your inbox and notifications."}
        </p>
        {app.screening_notes && (
          <p className="mt-3 text-[13px] text-ink">
            <strong>Matcher notes:</strong> {app.screening_notes}
          </p>
        )}
      </div>
    </div>
  );
}

function TestProjectStage({
  app,
  testProject,
  onSubmitted,
}: {
  app: VettingApplication;
  testProject: TestProject | null;
  onSubmitted: () => void;
}) {
  const [note, setNote] = useState("");
  const [fileIds, setFileIds] = useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!testProject) {
    return (
      <div className="rounded border border-ink-12 bg-white p-7 md:p-10" data-testid="stage-panel-testproject">
        <StageHeader kicker="§ V4" title="Paid test project."
          blurb="A real, scoped engagement — paid at the project rate. Our panel reviews your delivery." />
        <div className="mt-6 rounded border border-ink-12 bg-cream-2 p-5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-ink-60" />
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">Awaiting assignment</p>
          </div>
          <p className="mt-2 text-[14px] text-ink-60">
            Your test project hasn't been assigned yet. We'll email you the brief once a matcher selects one for your category.
          </p>
        </div>
      </div>
    );
  }

  const isSubmitted = testProject.status !== "assigned";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const meta = await uploadFile(f, {});
      setFileIds((prev) => [...prev, { id: meta.id, name: meta.filename }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await submitTestProject(note, fileIds.map((f) => f.id));
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded border border-ink-12 bg-white p-7 md:p-10" data-testid="stage-panel-testproject">
      <StageHeader kicker="§ V4" title={testProject.title}
        blurb="Submit your deliverable when ready. The panel reviews within 5 working days." />
      <div className="mt-6 rounded border border-ink-12 bg-cream-2 p-5">
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
          {testProject.description}
        </p>
        {testProject.deliverables.length > 0 && (
          <div className="mt-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">Deliverables</p>
            <ul className="mt-2 space-y-1 text-[13.5px] text-ink">
              {testProject.deliverables.map((d, i) => <li key={i} className="flex gap-2"><span className="text-ink-40">·</span>{d}</li>)}
            </ul>
          </div>
        )}
        {testProject.due_at && (
          <p className="mt-4 font-mono text-[12px] text-ink-60">
            Due: <span className="text-ink">{new Date(testProject.due_at).toLocaleString()}</span>
          </p>
        )}
        <p className="mt-2 font-mono text-[12px] text-ink-60">
          Status: <span className={cn("font-semibold", isSubmitted ? "text-sun" : "text-ink")}>{testProject.status}</span>
        </p>
        {testProject.reviewer_notes && (
          <p className="mt-3 rounded border border-ink-10 bg-white p-3 text-[13px] text-ink">
            <strong>Reviewer notes:</strong> {testProject.reviewer_notes}
          </p>
        )}
      </div>

      {!isSubmitted && (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <FieldLabel htmlFor="sub-note">Submission notes</FieldLabel>
            <FieldTextarea id="sub-note" rows={6} required minLength={10} value={note} onChange={(e) => setNote(e.target.value)} data-testid="vet-tp-note"
              placeholder="What's attached, key decisions, anything reviewers should know." />
          </div>
          <div>
            <FieldLabel htmlFor="sub-file">Attach files</FieldLabel>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-ink-20 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:border-ink">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Add file"}
                <input id="sub-file" type="file" className="hidden" onChange={handleUpload} disabled={uploading} data-testid="vet-tp-file" />
              </label>
              <span className="text-[12px] text-ink-60">PDFs, docs, ZIPs — up to 25 MB.</span>
            </div>
            {fileIds.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {fileIds.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 rounded border border-ink-10 bg-cream-2 px-3 py-2 text-[13px] text-ink">
                    <Paperclip className="h-3.5 w-3.5 text-ink-40" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <button type="button" onClick={() => setFileIds((prev) => prev.filter((x) => x.id !== f.id))} className="text-ink-40 hover:text-rust">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && (
            <div role="alert" className="rounded border border-rust/30 bg-rust/5 px-4 py-3 text-[13px] text-rust">
              {error}
            </div>
          )}
          <Button data-testid="vet-tp-submit" tone="ink" size="lg" type="submit" disabled={saving} className="w-full md:w-auto" iconLeft={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} arrow={!saving}>
            {saving ? "Submitting…" : "Submit test project"}
          </Button>
        </form>
      )}
      {testProject.submission_note && (
        <div className="mt-6 rounded border border-ink-10 bg-white p-4 text-[13px] text-ink">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">Your submission</p>
          <p className="mt-2 whitespace-pre-wrap">{testProject.submission_note}</p>
          {testProject.file_ids.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {testProject.file_ids.map((fid) => (
                <li key={fid}>
                  <a href={fileDownloadUrl(fid)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[12.5px] text-ink underline">
                    <Paperclip className="h-3.5 w-3.5" />
                    Download {fid}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ApprovedPanel() {
  return (
    <div className="rounded border border-sun bg-sun/10 p-7 md:p-10" data-testid="stage-panel-approved">
      <div className="flex items-center gap-3">
        <Award className="h-6 w-6 text-ink" />
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">Roster · approved</p>
      </div>
      <h2 className="mt-3 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
        Welcome to WorkSoy.
      </h2>
      <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink-60">
        Your profile is now public, verified, and you can submit proposals on open briefs. Briefs that match your specialties are routed to you first.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton to="/briefs" tone="ink" size="md" arrow>Browse open briefs</LinkButton>
        <LinkButton to="/dashboard" tone="outline" size="md">Open dashboard</LinkButton>
      </div>
    </div>
  );
}

function RejectedPanel({ note }: { note?: string | null }) {
  return (
    <div className="rounded border border-ink-12 bg-white p-7 md:p-10" data-testid="stage-panel-rejected">
      <div className="flex items-center gap-3">
        <XCircle className="h-6 w-6 text-rust" />
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">Application closed</p>
      </div>
      <h2 className="mt-3 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
        Not this round.
      </h2>
      <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink-60">
        {note || "We weren't able to advance your application. You're welcome to reapply once you have stronger references or a published case study."}
      </p>
      <div className="mt-6">
        <Link to="/contact" className="link-sweep text-[13px] font-semibold text-ink">
          Talk to us about reapplying →
        </Link>
      </div>
    </div>
  );
}
