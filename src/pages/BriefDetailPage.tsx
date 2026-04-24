import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { Loader2, Send } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import {
  getBrief,
  listProposalsForBrief,
  submitProposal,
  acceptProposal,
  rejectProposal,
  type Brief,
  type Proposal,
} from "@/lib/api";
import { Container, Eyebrow, Tag, Button, FieldInput, FieldLabel, FieldTextarea } from "@/components/primitives";

export function BriefDetailPage() {
  const { briefId } = useParams({ strict: false }) as { briefId: string };
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cover_letter: "", proposed_rate: "", rate_type: "fixed" as "hourly" | "fixed", estimated_duration_weeks: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getBrief(briefId).then(setBrief).catch(() => setBrief(null));
    listProposalsForBrief(briefId).then(setProposals).catch(() => setProposals(null)).finally(() => setLoading(false));
  };
  useEffect(load, [briefId]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-40" /></div>;
  }
  if (!brief) {
    return <Container className="py-24 text-center"><h1 className="font-display text-3xl text-ink">Brief not found.</h1></Container>;
  }

  const isOwner = session?.user._id === brief.user_id;
  const canApply = session && !isOwner && brief.status === "open";
  const myProposal = proposals?.find((p) => p.expert_user_id === session?.user._id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitProposal(briefId, {
        cover_letter: form.cover_letter,
        proposed_rate: parseFloat(form.proposed_rate),
        rate_type: form.rate_type,
        estimated_duration_weeks: parseInt(form.estimated_duration_weeks, 10) || brief.duration_weeks,
      });
      setShowForm(false);
      setForm({ cover_letter: "", proposed_rate: "", rate_type: "fixed", estimated_duration_weeks: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit proposal");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async (id: string) => {
    try { const c = await acceptProposal(id); navigate({ to: "/contracts/$contractId", params: { contractId: c.id } }); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  };
  const handleReject = async (id: string) => {
    try { await rejectProposal(id); load(); } catch (err) { alert(String(err)); }
  };

  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20">
      <Container>
        <Link to="/briefs" className="text-[12px] font-medium text-ink-60 hover:text-ink">← Back to briefs</Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <Eyebrow index="§ Brief" accent>{brief.category}</Eyebrow>
            <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
              {brief.title}
            </h1>
          </div>
          <Tag tone={brief.status === "open" ? "sun" : "outline"} size="md">{brief.status}</Tag>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <KV label="Budget" value={`$${brief.budget_min.toLocaleString()}–$${brief.budget_max.toLocaleString()}`} />
          <KV label="Duration" value={`${brief.duration_weeks} weeks`} />
          <KV label="Engagement" value={brief.engagement_type} />
          <KV label="Location" value={brief.location} />
        </div>

        <section className="mt-10 grid gap-10 md:grid-cols-[1fr_320px]">
          <div>
            <h2 className="border-b border-ink-12 pb-2 font-display text-[18px] font-medium text-ink">The work</h2>
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{brief.description}</p>

            {brief.required_skills.length > 0 && (
              <>
                <h3 className="mt-8 border-b border-ink-12 pb-2 font-display text-[16px] font-medium text-ink">Required skills</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {brief.required_skills.map((s) => <Tag key={s} tone="outline" size="sm">{s}</Tag>)}
                </div>
              </>
            )}
          </div>

          <aside className="space-y-4">
            {canApply && !myProposal && (
              <Button data-testid="open-propose" tone="ink" size="md" className="w-full" onClick={() => setShowForm(true)}>
                Send a proposal
              </Button>
            )}
            {!session && (
              <Button tone="ink" size="md" className="w-full" onClick={() => navigate({ to: "/signin" })}>
                Sign in to apply
              </Button>
            )}
            {myProposal && (
              <div className="rounded border border-sun/30 bg-sun/10 p-4 text-[13px] text-ink">
                You submitted a proposal (<strong>{myProposal.status}</strong>) on {new Date(myProposal.created_at).toLocaleDateString()}.
              </div>
            )}
            {isOwner && (
              <div className="rounded border border-ink-12 bg-white p-4 text-[13px] text-ink-60">
                You posted this brief. Review incoming proposals below.
              </div>
            )}
          </aside>
        </section>

        {showForm && canApply && (
          <div className="mt-10 rounded border border-ink-12 bg-white p-6">
            <h2 className="font-display text-[20px] font-medium text-ink">Your proposal</h2>
            {error && <div className="mt-3 rounded border border-rust/30 bg-rust/5 px-3 py-2 text-[13px] text-rust">{error}</div>}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <FieldLabel htmlFor="cover">Cover letter</FieldLabel>
                <FieldTextarea id="cover" required minLength={20} rows={5} value={form.cover_letter} onChange={(e) => setForm({ ...form, cover_letter: e.target.value })} placeholder="Why you're the right fit — relevant experience, approach, what you'd deliver." />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <FieldLabel htmlFor="rate">Proposed rate (USD)</FieldLabel>
                  <FieldInput id="rate" type="number" step="0.01" min={1} required value={form.proposed_rate} onChange={(e) => setForm({ ...form, proposed_rate: e.target.value })} />
                </div>
                <div>
                  <FieldLabel htmlFor="rt">Rate type</FieldLabel>
                  <select id="rt" value={form.rate_type} onChange={(e) => setForm({ ...form, rate_type: e.target.value as "fixed" | "hourly" })}
                    className="h-11 w-full rounded border border-ink-20 bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none">
                    <option value="fixed">Fixed-fee</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
                <div>
                  <FieldLabel htmlFor="dur">Your estimate (weeks)</FieldLabel>
                  <FieldInput id="dur" type="number" min={1} max={104} required value={form.estimated_duration_weeks} onChange={(e) => setForm({ ...form, estimated_duration_weeks: e.target.value })} />
                </div>
              </div>
              <Button data-testid="submit-proposal" tone="ink" size="md" type="submit" disabled={submitting} iconLeft={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}>
                {submitting ? "Sending…" : "Send proposal"}
              </Button>
            </form>
          </div>
        )}

        {isOwner && proposals && (
          <section className="mt-10">
            <h2 className="border-b border-ink-12 pb-2 font-display text-[20px] font-medium text-ink">
              Proposals <span className="ml-2 font-mono text-[12px] text-ink-40">{String(proposals.length).padStart(2, "0")}</span>
            </h2>
            {proposals.length === 0 ? (
              <p className="mt-6 text-[14px] text-ink-60">No proposals yet — our matcher will route a shortlist within 48h.</p>
            ) : (
              <div className="mt-6 space-y-4">
                {proposals.map((p) => (
                  <div key={p.id} className="rounded border border-ink-12 bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        {p.expert_image ? <img src={p.expert_image} alt="" className="h-12 w-12 rounded-full object-cover" /> :
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-cream">{p.expert_name.charAt(0)}</span>}
                        <div>
                          <p className="font-display text-[16px] font-semibold text-ink">{p.expert_name}</p>
                          {p.expert_headline && <p className="text-[12.5px] text-ink-60">{p.expert_headline}</p>}
                          <p className="mt-1 font-mono text-[11px] text-ink-40">${p.proposed_rate.toLocaleString()} / {p.rate_type} · {p.estimated_duration_weeks}w</p>
                        </div>
                      </div>
                      <Tag tone={p.status === "accepted" ? "sun" : p.status === "rejected" ? "outline" : "ink"} size="sm">{p.status}</Tag>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-60">{p.cover_letter}</p>
                    {p.status === "pending" && brief.status === "open" && (
                      <div className="mt-4 flex gap-2">
                        <Button data-testid={`accept-${p.id}`} tone="ink" size="sm" onClick={() => handleAccept(p.id)}>Accept & open contract</Button>
                        <Button tone="outline" size="sm" onClick={() => handleReject(p.id)}>Reject</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </Container>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-ink-12 bg-white p-4">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">{label}</p>
      <p className="mt-1 font-display text-[16px] font-semibold text-ink">{value}</p>
    </div>
  );
}
