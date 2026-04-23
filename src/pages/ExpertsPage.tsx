import { useState, useMemo } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { experts, categories } from "@/data/experts";
import { ExpertCard } from "@/components/ExpertCard";

export function ExpertsPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"rating" | "price-asc" | "price-desc">("rating");

  const filtered = useMemo(() => {
    let list = experts.filter((e) => {
      const matchCat = activeCategory === "all" || e.category === activeCategory;
      const q = query.toLowerCase();
      const matchQuery = !q || e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || e.skills.some((s) => s.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "price-asc") return a.hourlyRate - b.hourlyRate;
      return b.hourlyRate - a.hourlyRate;
    });
    return list;
  }, [query, activeCategory, sortBy]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Find your expert</h1>
        <p className="mt-2 text-slate-600">Browse {experts.length}+ senior professionals available for project-based work.</p>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, skill, or specialty..."
            className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <div className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="appearance-none rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-10 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="rating">Top rated</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
      </div>

      {/* Categories */}
      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeCategory === cat.id
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {cat.label} <span className={activeCategory === cat.id ? "text-slate-300" : "text-slate-400"}>({cat.count})</span>
          </button>
        ))}
      </div>

      <div className="mt-6 text-sm text-slate-500">{filtered.length} experts found</div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((e) => (
          <ExpertCard key={e.id} expert={e} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-16 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <p className="text-slate-600">No experts match your filters. Try a broader search.</p>
        </div>
      )}
    </div>
  );
}
