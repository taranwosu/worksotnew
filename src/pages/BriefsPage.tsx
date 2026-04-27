import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { listOpenBriefs, type Brief } from "@/lib/api";
import { CATEGORY_IDS, CATEGORY_LABELS } from "@/data/experts";
import { Container, Eyebrow, Tag } from "@/components/primitives";
import { cn } from "@/lib/utils";

export function BriefsPage() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    listOpenBriefs({ category: cat === "all" ? undefined : cat, q: q || undefined })
      .then(setBriefs)
      .catch(() => setBriefs([]))
      .finally(() => setLoading(false));
  }, [cat, q]);

  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20">
      <Container>
        <Eyebrow index="§ 07" accent>Open briefs</Eyebrow>
        <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
          Live briefs posted this week.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-60">
          Every brief has a named party, a real budget, and a first-round read by our matching team. Send a proposal and we&rsquo;ll route it within the hour.
        </p>

        <div className="mt-8 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1 md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, skill, keyword…"
              className="h-11 w-full rounded border border-ink-20 bg-white pl-10 pr-4 text-sm text-ink placeholder:text-ink-40 focus:border-ink focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORY_IDS.map((id) => (
            <button
              key={id}
              onClick={() => setCat(id)}
              className={cn(
                "rounded-pill border px-3.5 py-1.5 text-[12.5px] font-medium",
                cat === id ? "border-ink bg-ink text-cream" : "border-ink-12 bg-white text-ink hover:border-ink",
              )}
            >
              {CATEGORY_LABELS[id]}
            </button>
          ))}
        </div>

        <div className="mt-10 border-b border-ink-12 pb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
            {loading ? "Loading…" : `${briefs.length} open brief${briefs.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {briefs.length === 0 && !loading ? (
          <div className="mt-10 rounded border border-dashed border-ink-20 bg-white px-6 py-16 text-center text-ink-60">
            No open briefs match that filter.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {briefs.map((b) => (
              <Link
                key={b.id}
                to="/briefs/$briefId"
                params={{ briefId: b.id }}
                className="group rounded border border-ink-12 bg-white p-5 transition-all hover:border-ink hover:shadow-[0_18px_40px_-22px_rgba(26,26,26,0.25)]"
              >
                <div className="flex items-center justify-between">
                  <Tag tone="outline" size="sm">{b.category}</Tag>
                  <span className="font-mono text-[11px] text-ink-40">
                    {b.proposal_count} proposal{b.proposal_count === 1 ? "" : "s"}
                  </span>
                </div>
                <h3 className="mt-3 line-clamp-2 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
                  {b.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-[13px] text-ink-60">{b.description}</p>
                <div className="mt-4 flex items-center justify-between text-[12px]">
                  <span className="font-mono text-ink-60">
                    ${b.budget_min.toLocaleString()}–${b.budget_max.toLocaleString()} · {b.duration_weeks}w
                  </span>
                  <Tag tone="sun" size="sm">{b.engagement_type}</Tag>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
