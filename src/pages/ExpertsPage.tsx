import { useState, useMemo } from "react";
import { Search, LayoutGrid, Rows3, X } from "lucide-react";
import { experts, categories } from "@/data/experts";
import { ExpertCard } from "@/components/ExpertCard";
import {
  Container,
  Eyebrow,
  LinkButton,
  Tag,
} from "@/components/primitives";
import { cn } from "@/lib/utils";

type SortKey = "rating" | "price-asc" | "price-desc" | "responsiveness";
type View = "grid" | "list";

export function ExpertsPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("rating");
  const [view, setView] = useState<View>("grid");
  const [availableOnly, setAvailableOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = experts.filter((e) => {
      const matchCat =
        activeCategory === "all" || e.category === activeCategory;
      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.skills.some((s) => s.toLowerCase().includes(q));
      const matchAvail = !availableOnly || /now/i.test(e.availability);
      return matchCat && matchQuery && matchAvail;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "price-asc") return a.hourlyRate - b.hourlyRate;
      if (sortBy === "price-desc") return b.hourlyRate - a.hourlyRate;
      const ta = parseInt(a.responseTime.replace(/[^0-9]/g, "") || "99");
      const tb = parseInt(b.responseTime.replace(/[^0-9]/g, "") || "99");
      return ta - tb;
    });
    return list;
  }, [query, activeCategory, sortBy, availableOnly]);

  const clearFilters = () => {
    setQuery("");
    setActiveCategory("all");
    setAvailableOnly(false);
  };
  const hasFilters = query || activeCategory !== "all" || availableOnly;

  return (
    <div className="bg-cream">
      {/* Editorial title band */}
      <section className="border-b border-ink-12 pt-16 md:pt-20">
        <Container>
          <div className="flex items-center justify-between border-b border-ink-12 pb-6">
            <Eyebrow index="§ 01" accent>
              The directory
            </Eyebrow>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
              {experts.length} on file · updated weekly
            </span>
          </div>
          <div className="grid grid-cols-1 gap-8 pt-10 md:grid-cols-12 md:pt-14">
            <div className="md:col-span-8">
              <h1 className="display-xl text-ink">
                Every practitioner on
                <br className="hidden md:block" /> the WorkSoy roster.
              </h1>
            </div>
            <div className="md:col-span-4 md:pt-4">
              <p className="prose-lede">
                Interview-passed, referenced, and rate-benchmarked. Filter by
                practice, availability, or engagement budget. Booking windows
                refresh every Monday.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Control bar — sticks below the site header */}
      <div className="sticky top-[72px] z-30 border-b border-ink-12 bg-cream/95 backdrop-blur-md">
        <Container>
          <div className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 md:max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, skill, specialty, city…"
                  className="h-11 w-full rounded border border-ink-20 bg-white pl-10 pr-4 text-sm text-ink placeholder:text-ink-40 focus:border-ink focus:outline-none focus:shadow-[0_0_0_3px_var(--color-sun-soft)]"
                />
              </div>
              <button
                type="button"
                onClick={() => setAvailableOnly((v) => !v)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded border px-3.5 text-[13px] font-medium transition-colors",
                  availableOnly
                    ? "border-ink bg-ink text-cream"
                    : "border-ink-20 text-ink hover:border-ink",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    availableOnly ? "bg-sun live-dot" : "bg-ink-40",
                  )}
                />
                Available now
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[12px] text-ink-60">
                <span className="font-mono uppercase tracking-[0.12em]">
                  Sort
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="h-9 rounded border border-ink-20 bg-white px-2.5 text-[13px] font-medium text-ink focus:border-ink focus:outline-none"
                >
                  <option value="rating">Top rated</option>
                  <option value="price-asc">Rate · ascending</option>
                  <option value="price-desc">Rate · descending</option>
                  <option value="responsiveness">Fastest response</option>
                </select>
              </label>
              <div className="flex overflow-hidden rounded border border-ink-20">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-label="Grid view"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center transition-colors",
                    view === "grid"
                      ? "bg-ink text-cream"
                      : "text-ink hover:bg-ink-08",
                  )}
                >
                  <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label="List view"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center transition-colors",
                    view === "list"
                      ? "bg-ink text-cream"
                      : "text-ink hover:bg-ink-08",
                  )}
                >
                  <Rows3 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>

          {/* Category pills */}
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-4 md:mx-0 md:px-0">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-pill border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                  activeCategory === cat.id
                    ? "border-ink bg-ink text-cream"
                    : "border-ink-12 bg-white text-ink hover:border-ink",
                )}
              >
                {cat.label}
                <span
                  className={cn(
                    "font-mono tabular text-[10.5px]",
                    activeCategory === cat.id ? "text-cream/60" : "text-ink-40",
                  )}
                >
                  {String(cat.count).padStart(2, "0")}
                </span>
              </button>
            ))}
          </div>
        </Container>
      </div>

      {/* Results */}
      <section className="py-10 md:py-14">
        <Container>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-ink-12 pb-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
              Showing{" "}
              <span className="text-ink tabular">
                {String(filtered.length).padStart(2, "0")}
              </span>{" "}
              of {String(experts.length).padStart(2, "0")}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-60 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="mt-12 flex flex-col items-center justify-center border border-dashed border-ink-20 bg-white py-20 text-center">
              <p className="font-display text-2xl font-medium text-ink">
                No matches in the current roster.
              </p>
              <p className="mt-2 max-w-md text-sm text-ink-60">
                Try broadening your filters, or brief us directly — many
                placements are bespoke and not listed publicly.
              </p>
              <LinkButton
                to="/post-request"
                tone="ink"
                size="md"
                className="mt-6"
                arrow
              >
                Post a brief instead
              </LinkButton>
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((e) => (
                <ExpertCard key={e.id} expert={e} />
              ))}
            </div>
          ) : (
            <div className="border-t border-ink-12">
              {filtered.map((e, i) => (
                <ExpertCard
                  key={e.id}
                  expert={e}
                  layout="row"
                  index={i}
                />
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* Brief CTA strip */}
      <section className="border-t border-ink-12 bg-paper py-16">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <Tag tone="sun" size="sm">Confidential search</Tag>
              <h2 className="mt-4 font-display text-[clamp(1.75rem,3.6vw,2.5rem)] font-medium leading-[1.05] tracking-[-0.022em] text-ink">
                Need someone off-roster?
              </h2>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-60">
                Two-thirds of our placements are bespoke. Brief us and a
                matcher will reach into our off-platform bench — C-suite
                fractional, regulated-industry specialists, on-site
                engagements.
              </p>
            </div>
            <div className="flex gap-3">
              <LinkButton to="/post-request" tone="ink" size="lg" arrow>
                Post a brief
              </LinkButton>
              <LinkButton to="/contact" tone="outline" size="lg">
                Talk to a matcher
              </LinkButton>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
