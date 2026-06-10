import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, X, ChevronRight, Send } from "lucide-react";
import {
  adminListVetting,
  adminAdvanceVetting,
  adminRejectVetting,
  adminAssignTestProject,
  adminReviewTestProject,
  adminUpdateScreening,
  type VettingApplicationRow,
} from "@/lib/api";
import { Button, Tag } from "@/components/primitives";
import { cn } from "@/lib/utils";

const TAB_STAGES = [
  { key: "language_personality", label: "Language" },
  { key: "skill_quiz", label: "Skill quiz" },
  { key: "screening_call", label: "Screening call" },
  { key: "test_project", label: "Test project" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

export function AdminVettingPanel() {
  const [rows, setRows] = useState<VettingApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("language_personality");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminListVetting());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => r.application.stage === tab);
  const counts = TAB_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s.key] = rows.filter((r) => r.application.stage === s.key).length;
    return acc;
  }, {});

  return (
    <div data-testid="admin-vetting-panel">
      <div className="flex flex-wrap gap-2 border-b border-cream/10 pb-1">
        {TAB_STAGES.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            data-testid={`vetting-tab-${s.key}`}
            className={cn(
              "border-b-2 px-3 py-2 text-[12.5px] font-semibold transition-colors",
              tab === s.key ? "border-sun text-cream" : "border-transparent text-cream/50 hover:text-cream/80",
            )}
          >
            {s.label} <span className="ml-1 font-mono text-[10px] text-cream/40">({counts[s.key] ?? 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-cream/40" /></div>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded border border-cream/10 p-8 text-center text-[13px] text-cream/60">
          No applications in this stage.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((row) => (
            <ApplicationCard
              key={row.application.id}
              row={row}
              open={openId === row.application.id}
              onToggle={() => setOpenId((prev) => prev === row.application.id ? null : row.application.id)}
              onAction={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({
  row,
  open,
  onToggle,
  onAction,
}: {
  row: VettingApplicationRow;
  open: boolean;
  onToggle: () => void;
  onAction: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const a = row.application;
  const e = row.expert;
  const u = row.user;
  const tp = row.test_project;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); setNote(""); onAction(); } finally { setBusy(false); }
  };

  return (
    <div className="rounded border border-cream/10 bg-ink-2" data-testid={`vetting-app-${a.id}`}>
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <div className="flex min-w-0 items-center gap-3">
          {u?.picture ? (
            <img src={u.picture} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cream/10 text-[12px] font-bold text-cream">
              {(u?.name || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-[14px] font-semibold">{u?.name ?? "—"}</p>
            <p className="truncate text-[11.5px] text-cream/60">
              {u?.email} {e ? `· ${e.category} · $${e.hourlyRate}/hr` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tag tone="outline" size="sm">{a.stage}</Tag>
          <ChevronRight className={cn("h-4 w-4 text-cream/50 transition-transform", open && "rotate-90")} />
        </div>
      </button>

      {open && (
        <div className="border-t border-cream/10 p-5 text-[13px] text-cream/85">
          {/* Submissions */}
          {a.language_answers && (
            <Section title="Language & personality">
              <KV k="Timezone" v={String(a.language_answers.timezone)} />
              <KV k="Weekly hours" v={String(a.language_answers.weekly_hours)} />
              <KV k="English self-rating" v={`${a.language_answers.english_self_rating}/5`} />
              <Multi label="Communication style" value={String(a.language_answers.communication_style)} />
              <Multi label="Why WorkSoy" value={String(a.language_answers.why_worksoy)} />
            </Section>
          )}
          {a.skill_answers && (
            <Section title="Skill questionnaire">
              <Multi label="Case study" value={String(a.skill_answers.case_study)} />
              {a.skill_answers.portfolio_url ? <KV k="Portfolio" v={String(a.skill_answers.portfolio_url)} /> : null}
              <Multi label="Methodology" value={String(a.skill_answers.methodology)} />
            </Section>
          )}
          {a.stage === "screening_call" && (
            <ScreeningEditor appId={a.id} app={a} onAction={onAction} />
          )}
          {tp && (
            <Section title={`Test project · ${tp.title}`}>
              <Multi label="Description" value={tp.description} />
              <KV k="Status" v={tp.status} />
              {tp.submission_note && <Multi label="Submission note" value={tp.submission_note} />}
              {tp.file_ids.length > 0 && <KV k="Attached files" v={tp.file_ids.join(", ")} />}
              {tp.status === "submitted" && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    tone="sun"
                    disabled={busy}
                    data-testid={`tp-pass-${tp.id}`}
                    onClick={() => run(() => adminReviewTestProject(a.id, true, note))}
                  >
                    Mark passed
                  </Button>
                  <Button
                    size="sm"
                    tone="outline"
                    disabled={busy}
                    data-testid={`tp-fail-${tp.id}`}
                    onClick={() => run(() => adminReviewTestProject(a.id, false, note))}
                  >
                    Mark failed
                  </Button>
                </div>
              )}
            </Section>
          )}
          {a.stage === "test_project" && !tp && (
            <AssignTestProjectForm appId={a.id} category={e?.category} onAction={onAction} />
          )}

          <Section title="Decision">
            <label className="block text-[11px] uppercase tracking-[0.14em] text-cream/60">Decision note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-cream/15 bg-ink-2 px-3 py-2 text-[13px] text-cream placeholder:text-cream/40"
              placeholder="Shared with the applicant."
              data-testid={`note-${a.id}`}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                tone="sun"
                disabled={busy || a.stage === "approved" || a.stage === "rejected"}
                data-testid={`advance-${a.id}`}
                onClick={() => run(() => adminAdvanceVetting(a.id, note || undefined))}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Advance stage
              </Button>
              <Button
                size="sm"
                tone="outline"
                disabled={busy || a.stage === "approved" || a.stage === "rejected"}
                data-testid={`reject-${a.id}`}
                onClick={() => run(() => adminRejectVetting(a.id, note || undefined))}
              >
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded border border-cream/10 bg-ink p-4">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-cream/60">{title}</p>
      <div className="mt-3 space-y-2 text-[13px]">{children}</div>
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-36 shrink-0 text-cream/50">{k}</span>
      <span className="text-cream">{v}</span>
    </div>
  );
}
function Multi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-cream/50">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-cream/90">{value}</p>
    </div>
  );
}

function ScreeningEditor({ appId, app, onAction }: { appId: string; app: { screening_scheduled_at?: string | null; screening_notes?: string | null; screening_passed?: boolean | null }; onAction: () => void }) {
  const [when, setWhen] = useState(app.screening_scheduled_at?.slice(0, 16) ?? "");
  const [notes, setNotes] = useState(app.screening_notes ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await adminUpdateScreening(appId, when ? new Date(when).toISOString() : undefined, notes, undefined);
      onAction();
    } finally { setBusy(false); }
  };

  return (
    <Section title="Screening call">
      <label className="block text-[11px] uppercase tracking-[0.14em] text-cream/60">Scheduled at</label>
      <input
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        className="mt-1 w-full rounded border border-cream/15 bg-ink-2 px-3 py-2 text-[13px] text-cream"
        data-testid={`screening-when-${appId}`}
      />
      <label className="mt-3 block text-[11px] uppercase tracking-[0.14em] text-cream/60">Notes (shared with expert)</label>
      <textarea
        value={notes}
        rows={3}
        onChange={(e) => setNotes(e.target.value)}
        className="mt-1 w-full rounded border border-cream/15 bg-ink-2 px-3 py-2 text-[13px] text-cream placeholder:text-cream/40"
        data-testid={`screening-notes-${appId}`}
      />
      <Button size="sm" tone="outline" className="mt-3" disabled={busy} onClick={save} data-testid={`screening-save-${appId}`}>
        <Send className="h-3.5 w-3.5" /> Save call details
      </Button>
    </Section>
  );
}

function AssignTestProjectForm({ appId, category, onAction }: { appId: string; category?: string; onAction: () => void }) {
  const TEMPLATES: Record<string, { title: string; description: string; deliverables: string[] }> = {
    "Accounting & Tax": {
      title: "3-statement model — micro-SaaS",
      description: "Build a 3-statement financial model for a fictional $1.4M ARR SaaS. Assume 22% YoY growth, 7% monthly churn, 40-day DSO. Use any tool. Defend assumptions.",
      deliverables: ["3-statement model file", "1-page assumptions memo", "Loom walkthrough (5 min max)"],
    },
    "Consulting": {
      title: "Strategy memo — pricing for a mid-market SaaS",
      description: "Recommend a v2 pricing structure for a $40M ARR vertical SaaS, currently flat seat-based. Defend choices with 1 quant case + 1 qual case.",
      deliverables: ["6-page memo (PDF)", "Pricing tiers table", "Loom walkthrough"],
    },
    "Design & UX": {
      title: "Onboarding redesign — payments dashboard",
      description: "Redesign the first-run onboarding for a B2B payments dashboard. Constrain to 4 screens. Justify hierarchy + reduction.",
      deliverables: ["Figma file (public link)", "Annotated screenshots", "Decisions memo"],
    },
    "Engineering": {
      title: "Code review + small fix",
      description: "Review the attached Node service, surface 3 issues, and ship a fix for the most impactful one. PR-style write-up.",
      deliverables: ["GitHub PR (or patch)", "Review write-up", "Loom walkthrough"],
    },
    "Compliance": {
      title: "SOC 2 readiness gap analysis",
      description: "Given the (mock) policy bundle, produce a gap report against SOC 2 CC1–CC9. Prioritise 5 highest-risk gaps.",
      deliverables: ["Gap report (PDF)", "Recommended remediations table"],
    },
    "Project Management": {
      title: "Schedule recovery plan",
      description: "Given the (mock) Gantt for a 14-week delivery now 3 weeks behind, propose a recovery plan and updated milestone log.",
      deliverables: ["Recovery plan memo", "Updated Gantt or milestone log"],
    },
  };
  const tpl = (category && TEMPLATES[category]) || {
    title: "Test project",
    description: "Describe the brief here.",
    deliverables: [""],
  };

  const [title, setTitle] = useState(tpl.title);
  const [desc, setDesc] = useState(tpl.description);
  const [deliverables, setDeliverables] = useState(tpl.deliverables.join("\n"));
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await adminAssignTestProject(appId, {
        title,
        description: desc,
        deliverables: deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
        due_at: due ? new Date(due).toISOString() : undefined,
      });
      onAction();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <Section title="Assign test project">
      <label className="block text-[11px] uppercase tracking-[0.14em] text-cream/60">Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-cream/15 bg-ink-2 px-3 py-2 text-[13px] text-cream" data-testid={`tp-title-${appId}`} />
      <label className="mt-3 block text-[11px] uppercase tracking-[0.14em] text-cream/60">Description</label>
      <textarea value={desc} rows={5} onChange={(e) => setDesc(e.target.value)} className="mt-1 w-full rounded border border-cream/15 bg-ink-2 px-3 py-2 text-[13px] text-cream" data-testid={`tp-desc-${appId}`} />
      <label className="mt-3 block text-[11px] uppercase tracking-[0.14em] text-cream/60">Deliverables (one per line)</label>
      <textarea value={deliverables} rows={3} onChange={(e) => setDeliverables(e.target.value)} className="mt-1 w-full rounded border border-cream/15 bg-ink-2 px-3 py-2 text-[13px] text-cream" data-testid={`tp-deliverables-${appId}`} />
      <label className="mt-3 block text-[11px] uppercase tracking-[0.14em] text-cream/60">Due (optional)</label>
      <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 w-full rounded border border-cream/15 bg-ink-2 px-3 py-2 text-[13px] text-cream" />
      {err && <p className="mt-2 text-[12px] text-rust">{err}</p>}
      <Button size="sm" tone="sun" className="mt-3" disabled={busy} onClick={submit} data-testid={`tp-assign-${appId}`}>
        <Send className="h-3.5 w-3.5" /> Assign project
      </Button>
    </Section>
  );
}
