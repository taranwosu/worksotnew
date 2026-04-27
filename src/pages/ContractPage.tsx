import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, CheckCircle2, ArrowUpRight, CircleDollarSign, Star, MessageSquare } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import {
  getContract,
  createMilestoneCheckout,
  getPaymentStatus,
  submitMilestone,
  releaseMilestone,
  fileDispute,
  getContractDisputes,
  getContractReviews,
  leaveReview,
  type Contract,
  type Milestone,
  type Review,
  type Dispute,
} from "@/lib/api";
import { DisputeThread } from "@/components/DisputeThread";
import { Container, Eyebrow, Button, Tag, FieldTextarea, FieldLabel } from "@/components/primitives";

export function ContractPage() {
  const { contractId } = useParams({ strict: false }) as { contractId: string };
  const search = useSearch({ strict: false }) as { session_id?: string };
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [contract, setContract] = useState<Contract | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutFor, setCheckoutFor] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [disputeFor, setDisputeFor] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getContract(contractId),
      getContractReviews(contractId).catch(() => [] as Review[]),
      getContractDisputes(contractId).catch(() => [] as Dispute[]),
    ])
      .then(([{ contract, milestones }, revs, dps]) => {
        setContract(contract);
        setMilestones(milestones);
        setReviews(revs);
        setDisputes(dps);
      })
      .catch(() => setContract(null))
      .finally(() => setLoading(false));
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  // Handle Stripe return — poll status
  useEffect(() => {
    if (!search.session_id) return;
    let attempts = 0;
    const sid = search.session_id;
    setPaymentStatus("checking");
    const poll = async () => {
      try {
        const s = await getPaymentStatus(sid);
        setPaymentStatus(s.payment_status);
        if (s.payment_status === "paid") {
          load();
          return;
        }
        if (s.status === "expired") return;
        if (attempts++ < 6) setTimeout(poll, 2000);
      } catch {
        /* noop */
      }
    };
    poll();
  }, [search.session_id, load]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-40" /></div>;
  }
  if (!contract) {
    return (
      <Container className="py-24 text-center">
        <h1 className="font-display text-3xl text-ink">Contract not found.</h1>
      </Container>
    );
  }

  const isClient = session?.user._id === contract.client_user_id;
  const isExpert = session?.user._id === contract.expert_user_id;
  const funded = milestones.filter((m) => m.status === "funded" || m.status === "submitted" || m.status === "released").reduce((s, m) => s + m.amount, 0);
  const released = milestones.filter((m) => m.status === "released").reduce((s, m) => s + m.amount, 0);

  const handleFund = async (id: string) => {
    setCheckoutFor(id);
    try {
      const { url } = await createMilestoneCheckout(id);
      window.location.href = url;
    } catch (err) {
      setCheckoutFor(null);
      alert(err instanceof Error ? err.message : "Checkout failed");
    }
  };

  const handleSubmit = async (id: string) => {
    try { await submitMilestone(id); load(); } catch (e) { alert(String(e)); }
  };
  const handleRelease = async (id: string) => {
    try { await releaseMilestone(id); load(); } catch (e) { alert(String(e)); }
  };

  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeFor) return;
    setDisputeSubmitting(true);
    try {
      await fileDispute(disputeFor, disputeReason);
      setDisputeFor(null);
      setDisputeReason("");
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to file dispute");
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const myReview = reviews.find((r) => r.reviewer_user_id === session?.user._id);
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewSubmitting(true);
    try {
      await leaveReview(contractId, reviewRating, reviewComment);
      setReviewComment("");
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20">
      <Container>
        <Eyebrow index="§ 06" accent>Contract</Eyebrow>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-medium tracking-[-0.02em] text-ink">
            {contract.brief_title}
          </h1>
          <Tag tone={contract.status === "active" ? "sun" : "outline"} size="md">{contract.status}</Tag>
        </div>
        <p className="mt-2 text-[14px] text-ink-60">
          {isClient ? `Expert: ${contract.expert_name}` : `Client: ${contract.client_name}`} · Total ${contract.total_amount.toLocaleString()}
        </p>

        {paymentStatus === "paid" && (
          <div className="mt-6 rounded border border-sun/40 bg-sun/10 px-4 py-3 text-[13px] text-ink">
            <strong>Payment received.</strong> The milestone is now funded and held in escrow.
          </div>
        )}
        {paymentStatus === "checking" && (
          <div className="mt-6 rounded border border-ink-12 bg-white px-4 py-3 text-[13px] text-ink-60">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Verifying payment with Stripe…
          </div>
        )}

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <KV label="Escrow balance" value={`$${(funded - released).toLocaleString()}`} />
          <KV label="Total funded" value={`$${funded.toLocaleString()}`} />
          <KV label="Released" value={`$${released.toLocaleString()}`} />
        </div>

        <h2 className="mt-10 border-b border-ink-12 pb-3 font-display text-[22px] font-medium text-ink">Milestones</h2>
        <div className="mt-6 space-y-4">
          {milestones.map((m, i) => {
            const statusTone = m.status === "released" ? "outline" : m.status === "funded" ? "sun" : m.status === "submitted" ? "ink" : "outline";
            return (
              <div key={m.id} className="rounded border border-ink-12 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                      Milestone {i + 1} of {milestones.length}
                    </p>
                    <h3 className="mt-1 font-display text-[18px] font-semibold text-ink">{m.title}</h3>
                    {m.description && <p className="mt-1 text-[13px] text-ink-60">{m.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-[22px] font-semibold tabular text-ink">${m.amount.toLocaleString()}</span>
                    <Tag tone={statusTone} size="md">{m.status}</Tag>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {isClient && m.status === "pending" && (
                    <Button
                      data-testid={`fund-milestone-${m.id}`}
                      tone="ink"
                      size="sm"
                      onClick={() => handleFund(m.id)}
                      disabled={checkoutFor === m.id}
                      iconLeft={checkoutFor === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}
                    >
                      Fund ${m.amount.toLocaleString()} into escrow
                    </Button>
                  )}
                  {isExpert && m.status === "funded" && (
                    <Button tone="ink" size="sm" onClick={() => handleSubmit(m.id)}>
                      Mark delivered
                    </Button>
                  )}
                  {isClient && (m.status === "submitted" || m.status === "funded") && (
                    <Button
                      data-testid={`release-milestone-${m.id}`}
                      tone="sun"
                      size="sm"
                      onClick={() => handleRelease(m.id)}
                      iconLeft={<CheckCircle2 className="h-4 w-4" />}
                    >
                      Release ${m.amount.toLocaleString()} to expert
                    </Button>
                  )}
                  {m.status === "released" && (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-60">
                      <CheckCircle2 className="h-4 w-4 text-sun-2" /> Paid to expert
                    </span>
                  )}
                  {m.status === "disputed" && (() => {
                    const d = disputes.find((x) => x.milestone_id === m.id && x.status === "open");
                    return (
                      <Button
                        tone="outline"
                        size="sm"
                        data-testid={`view-dispute-${m.id}`}
                        iconLeft={<MessageSquare className="h-4 w-4" />}
                        onClick={() => setOpenThread((prev) => (prev === d?.id ? null : d?.id ?? null))}
                        disabled={!d}
                      >
                        {openThread === d?.id ? "Hide dispute thread" : "View dispute thread"}
                      </Button>
                    );
                  })()}
                  {(isClient || isExpert) && (m.status === "funded" || m.status === "submitted") && (
                    <Button
                      data-testid={`dispute-${m.id}`}
                      tone="outline"
                      size="sm"
                      onClick={() => setDisputeFor(m.id)}
                    >
                      File dispute
                    </Button>
                  )}
                </div>
                {disputeFor === m.id && (
                  <form onSubmit={handleFileDispute} className="mt-4 rounded border border-rust/30 bg-rust/5 p-4">
                    <FieldLabel htmlFor={`reason-${m.id}`} className="text-rust">Reason for dispute</FieldLabel>
                    <FieldTextarea
                      id={`reason-${m.id}`}
                      required
                      minLength={10}
                      rows={3}
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Describe the issue in detail — what was expected, what was delivered, and the remedy you're asking for."
                    />
                    <div className="mt-3 flex gap-2">
                      <Button data-testid="dispute-submit" tone="ink" size="sm" type="submit" disabled={disputeSubmitting}>
                        {disputeSubmitting ? "Filing…" : "Submit dispute"}
                      </Button>
                      <Button tone="outline" size="sm" type="button" onClick={() => setDisputeFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {m.status === "disputed" && (() => {
                  const d = disputes.find((x) => x.milestone_id === m.id);
                  if (!d || openThread !== d.id) return null;
                  return (
                    <div className="mt-4" data-testid={`dispute-thread-${m.id}`}>
                      <DisputeThread
                        disputeId={d.id}
                        onResolved={() => { setOpenThread(null); load(); }}
                      />
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex gap-3">
          <button onClick={() => navigate({ to: "/messages" })} className="inline-flex items-center gap-1.5 rounded border border-ink-20 bg-white px-4 py-2 text-[13px] font-semibold text-ink">
            Open message thread <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {contract.status === "completed" && (
          <section className="mt-12">
            <h2 className="border-b border-ink-12 pb-3 font-display text-[22px] font-medium text-ink">Reviews</h2>
            {reviews.length > 0 && (
              <div className="mt-6 space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded border border-ink-12 bg-white p-5">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-[15px] font-semibold text-ink">{r.reviewer_name}</p>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-sun text-sun" : "text-ink-20"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-ink-60">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
            {!myReview && (
              <form onSubmit={handleSubmitReview} className="mt-6 rounded border border-ink-12 bg-white p-5">
                <h3 className="font-display text-[16px] font-medium text-ink">Leave your review</h3>
                <div className="mt-3 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      data-testid={`star-${n}`}
                      onClick={() => setReviewRating(n)}
                      className="p-1"
                      aria-label={`${n} stars`}
                    >
                      <Star className={`h-6 w-6 ${n <= reviewRating ? "fill-sun text-sun" : "text-ink-20"}`} />
                    </button>
                  ))}
                </div>
                <FieldTextarea
                  required
                  minLength={3}
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share what worked, the outcomes, and what stood out."
                  className="mt-3"
                />
                <Button data-testid="submit-review" tone="ink" size="md" type="submit" disabled={reviewSubmitting} className="mt-3">
                  {reviewSubmitting ? "Submitting…" : "Publish review"}
                </Button>
              </form>
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
      <p className="mt-2 font-display text-[22px] font-semibold tabular text-ink">{value}</p>
    </div>
  );
}
