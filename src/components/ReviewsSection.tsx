import { useMutation, useQuery } from "convex/react";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function LeaveReviewList() {
  const reviewable = useQuery(api.reviews.listReviewableProposals);

  if (!reviewable) {
    return (
      <div className="rounded-lg border border-ink-12 bg-white p-6 shadow-sm">
        <div className="h-20 animate-pulse rounded-lg bg-cream-2" />
      </div>
    );
  }

  if (reviewable.length === 0) return null;

  return (
    <div className="rounded-lg border border-ink-12 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">
            Leave a review
          </h3>
          <p className="mt-0.5 text-xs text-ink-60">
            Share feedback on recent engagements. Reviews build trust on the platform.
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {reviewable.map((r) => (
          <li key={r.proposalId}>
            <ReviewFormCard
              proposalId={r.proposalId}
              requestTitle={r.requestTitle}
              role={r.role}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewFormCard({
  proposalId,
  requestTitle,
  role,
}: {
  proposalId: Id<"proposals">;
  requestTitle: string;
  role: "client" | "expert";
}) {
  const createReview = useMutation(api.reviews.createReview);
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError("Title and review body are required");
      return;
    }
    setSaving(true);
    try {
      await createReview({
        proposalId,
        rating,
        title: title.trim(),
        body: body.trim(),
      });
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not submit review");
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-moss/40 bg-moss/10 px-4 py-3 text-sm text-moss">
        <CheckCircle2 className="h-4 w-4" />
        Review submitted. Thanks for the feedback.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink-12 bg-white">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {requestTitle}
          </p>
          <p className="mt-0.5 text-xs text-ink-60">
            Review the {role === "client" ? "expert" : "client"} you worked with.
          </p>
        </div>
        <span className="flex-shrink-0 rounded-full border border-ink-20 bg-white px-3 py-1 text-xs font-semibold text-ink">
          {expanded ? "Cancel" : "Write review"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-ink-12 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-60">
              Rating
            </label>
            <StarInput value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-60">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarise the engagement"
              maxLength={120}
              className="w-full rounded-lg border border-ink-12 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-60">
              Review
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What stood out? Would you work together again?"
              rows={4}
              maxLength={2000}
              className="w-full resize-none rounded-lg border border-ink-12 bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-ink-40">
              {body.length}/2000
            </p>
          </div>
          {error && <p className="text-xs text-rust">{error}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ink-2 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit review
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-transform hover:scale-110"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            className={`h-6 w-6 ${
              n <= value
                ? "fill-sun text-sun"
                : "text-cream/70"
            }`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm font-semibold text-ink">
        {value} / 5
      </span>
    </div>
  );
}

export function ReceivedReviewsList({ subjectUserId }: { subjectUserId: string }) {
  const reviews = useQuery(api.reviews.listReviewsForUser, { subjectUserId });

  if (!reviews) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-cream-2" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ink-20 bg-paper/50 p-6 text-center">
        <Star className="mx-auto h-5 w-5 text-ink-40" />
        <p className="mt-2 text-sm font-semibold text-ink">
          No reviews yet
        </p>
        <p className="mt-0.5 text-xs text-ink-60">
          Reviews appear here after your first completed engagement.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r._id} className="rounded-lg border border-ink-12 bg-white p-4">
          <div className="flex items-start gap-3">
            {r.author.image ? (
              <img
                src={r.author.image}
                alt={r.author.name}
                className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                {r.author.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-ink">
                  {r.author.name}
                </p>
                <StarDisplay rating={r.rating} />
              </div>
              <p className="mt-0.5 text-sm font-semibold text-ink">
                {r.title}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-60">
                {r.body}
              </p>
              <p className="mt-2 text-[11px] text-ink-40">
                {new Date(r.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${
            n <= Math.round(rating)
              ? "fill-sun text-sun"
              : "text-cream/70"
          }`}
        />
      ))}
    </div>
  );
}
