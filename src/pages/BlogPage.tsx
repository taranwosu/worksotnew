import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, Tag as TagIcon, Search, Sparkles, Mail } from "lucide-react";
import {
  listBlogPosts,
  listBlogCategories,
  listBlogTags,
  subscribeNewsletter,
  type BlogPost,
} from "@/lib/blog";
import { usePageMeta } from "@/lib/seo";
import { Container, Eyebrow, Reveal, SectionHeader, Tag } from "@/components/primitives";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function BlogPage() {
  usePageMeta({
    title: "Journal — field notes on hiring, vetting & senior talent",
    description:
      "The WorkSoy Journal: practical essays on hiring senior specialists, the WorkSoy vetting gauntlet, fractional leadership, and how modern teams ship faster with vetted contractors.",
    path: "/blog",
  });

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);
  const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listBlogCategories(), listBlogTags()]).then(([c, t]) => {
      if (cancelled) return;
      setCategories(c);
      setTags(t);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBlogPosts({
      q: q || undefined,
      category: activeCat || undefined,
      tag: activeTag || undefined,
      limit: 24,
    })
      .then((r) => {
        if (cancelled) return;
        setPosts(r.posts);
        setTotal(r.total);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, activeCat, activeTag]);

  const isFiltered = Boolean(q || activeCat || activeTag);
  const featured = useMemo(() => (isFiltered ? null : posts[0]), [posts, isFiltered]);
  const rest = useMemo(() => (isFiltered ? posts : posts.slice(1)), [posts, isFiltered]);

  const onSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribing(true);
    try {
      const r = await subscribeNewsletter(email, "blog");
      toast.success(r.already_subscribed ? "Already subscribed — thanks!" : "You're in. We send one good email a fortnight.");
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not subscribe");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <main className="bg-cream">
      {/* Hero */}
      <section className="border-b border-ink-10">
        <Container className="grid gap-10 py-20 md:grid-cols-12 md:py-28">
          <div className="md:col-span-7">
            <Eyebrow>The WorkSoy Journal · Est. 2026</Eyebrow>
            <h1 className="display-xl mt-6">
              Field notes on hiring,<br />
              <span className="italic text-ink-60">vetting</span>, and the slow craft of senior work.
            </h1>
            <p className="prose-lede mt-7 max-w-2xl">
              Essays, playbooks, and post-mortems from the network. Written by the people running the gauntlet, not borrowed from LinkedIn carousels.
            </p>
          </div>

          <aside className="md:col-span-5 md:pl-8 md:border-l md:border-ink-10">
            <div className="eyebrow text-ink-60">Sections</div>
            <ul className="mt-5 space-y-2 text-[15px]">
              {[
                ["Hiring playbooks", "Hiring"],
                ["Vetting & quality", "Vetting"],
                ["Fractional leadership", "Fractional"],
                ["Industry research", "Research"],
              ].map(([label, cat]) => (
                <li key={cat}>
                  <button
                    data-testid={`blog-section-${cat.toLowerCase()}`}
                    onClick={() => { setActiveCat(activeCat === cat ? null : cat); setActiveTag(null); }}
                    className={cn(
                      "group flex w-full items-baseline justify-between border-b border-ink-08 py-2 text-left transition-colors",
                      activeCat === cat ? "text-ink" : "text-ink-60 hover:text-ink",
                    )}
                  >
                    <span>{label}</span>
                    <ArrowUpRight className="h-4 w-4 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </Container>
      </section>

      {/* Search + filters */}
      <section className="border-b border-ink-10 bg-paper">
        <Container className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
            <input
              data-testid="blog-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the journal…"
              className="input pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              data-testid="blog-filter-all"
              onClick={() => { setActiveCat(null); setActiveTag(null); }}
              className={cn(
                "rounded-pill border px-3 py-1 text-[12px] font-medium",
                !activeCat && !activeTag ? "border-ink bg-ink text-cream" : "border-ink-20 bg-white text-ink hover:bg-cream-2",
              )}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.category}
                data-testid={`blog-filter-cat-${c.category}`}
                onClick={() => { setActiveCat(activeCat === c.category ? null : c.category); setActiveTag(null); }}
                className={cn(
                  "rounded-pill border px-3 py-1 text-[12px] font-medium",
                  activeCat === c.category ? "border-ink bg-ink text-cream" : "border-ink-20 bg-white text-ink hover:bg-cream-2",
                )}
              >
                {c.category} <span className="ml-1 text-ink-40">{c.count}</span>
              </button>
            ))}
          </div>
        </Container>
      </section>

      {/* Posts */}
      <section className="py-16">
        <Container>
          {loading ? (
            <div className="grid gap-8 md:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-72 animate-pulse rounded border border-ink-08 bg-white/60" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded border border-dashed border-ink-20 p-16 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-ink-40" />
              <p className="mt-3 font-display text-[20px]">No posts yet.</p>
              <p className="mt-1 text-[14px] text-ink-60">
                {activeCat || activeTag || q ? "Try clearing your filters." : "The first essays are coming. Subscribe below to be first."}
              </p>
            </div>
          ) : (
            <>
              {featured && (
                <Reveal>
                  <Link to="/blog/$slug" params={{ slug: featured.slug }} data-testid={`blog-featured-${featured.slug}`} className="group block">
                    <div className="grid gap-10 md:grid-cols-12">
                      <div className="md:col-span-7">
                        {featured.cover_image ? (
                          <img
                            src={featured.cover_image}
                            alt={featured.title}
                            className="aspect-[16/10] w-full rounded border border-ink-10 object-cover"
                          />
                        ) : (
                          <div className="aspect-[16/10] w-full rounded border border-ink-10 bg-gradient-to-br from-sun-soft via-cream-2 to-sand" />
                        )}
                      </div>
                      <div className="md:col-span-5">
                        <div className="flex items-center gap-3">
                          <Tag tone="sun" size="sm">{featured.category ?? "Featured"}</Tag>
                          <span className="eyebrow text-ink-60">{formatDate(featured.published_at)}</span>
                        </div>
                        <h2 className="display-md mt-4 group-hover:underline group-hover:decoration-sun-2 group-hover:underline-offset-4">
                          {featured.title}
                        </h2>
                        <p className="prose-lede mt-4">{featured.excerpt}</p>
                        <div className="mt-6 flex items-center gap-4 text-[13px] text-ink-60">
                          <span>{featured.author_name}</span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {featured.reading_time_min} min read</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              )}

              {rest.length > 0 && (
                <>
                  <div className="rule my-16" />
                  <div className="grid gap-y-12 gap-x-10 md:grid-cols-3">
                    {rest.map((p) => (
                      <Link
                        key={p.id}
                        to="/blog/$slug"
                        params={{ slug: p.slug }}
                        data-testid={`blog-card-${p.slug}`}
                        className="group block"
                      >
                        {p.cover_image ? (
                          <img src={p.cover_image} alt={p.title} className="aspect-[4/3] w-full rounded border border-ink-10 object-cover" />
                        ) : (
                          <div className="aspect-[4/3] w-full rounded border border-ink-10 bg-gradient-to-br from-cream-2 to-sand" />
                        )}
                        <div className="mt-4 flex items-center gap-2">
                          {p.category && <Tag tone="ink" size="sm">{p.category}</Tag>}
                          <span className="eyebrow text-ink-60">{formatDate(p.published_at)}</span>
                        </div>
                        <h3 className="mt-2 font-display text-[22px] font-semibold leading-tight group-hover:underline group-hover:decoration-sun-2 group-hover:underline-offset-4">
                          {p.title}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-[14.5px] text-ink-60">{p.excerpt}</p>
                        <div className="mt-3 flex items-center gap-3 text-[12px] text-ink-60">
                          <span>{p.author_name}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.reading_time_min} min</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {total > posts.length && (
            <p className="mt-12 text-center text-[13px] text-ink-60">Showing {posts.length} of {total}</p>
          )}
        </Container>
      </section>

      {/* Tag cloud */}
      {tags.length > 0 && (
        <section className="border-t border-ink-10 bg-paper py-12">
          <Container>
            <SectionHeader eyebrow="Tags" title="Browse by topic" />
            <div className="mt-6 flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t.tag}
                  data-testid={`blog-tag-${t.tag}`}
                  onClick={() => { setActiveTag(activeTag === t.tag ? null : t.tag); setActiveCat(null); }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-pill border px-3 py-1 text-[12px]",
                    activeTag === t.tag ? "border-ink bg-ink text-cream" : "border-ink-20 bg-white text-ink hover:bg-cream-2",
                  )}
                >
                  <TagIcon className="h-3 w-3" /> {t.tag} <span className="text-ink-40">{t.count}</span>
                </button>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Newsletter */}
      <section className="border-t border-ink-10 bg-ink py-20 text-cream">
        <Container>
          <div className="grid gap-12 md:grid-cols-12 md:items-end">
            <div className="md:col-span-7">
              <Eyebrow className="text-sun">The Field Dispatch</Eyebrow>
              <h2 className="display-lg mt-4">
                One short letter,<br />every other Friday.
              </h2>
              <p className="mt-4 max-w-xl text-cream/70">
                A working note from inside WorkSoy: which roles are heating up, what the gauntlet just rejected, and one piece of writing worth your time.
              </p>
            </div>
            <form onSubmit={onSubscribe} className="md:col-span-5">
              <label className="eyebrow text-cream/60">Subscribe</label>
              <div className="mt-3 flex gap-2">
                <input
                  data-testid="newsletter-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="flex-1 rounded border border-cream/20 bg-transparent px-4 py-3 text-cream placeholder:text-cream/40 focus:border-sun focus:outline-none"
                />
                <button
                  data-testid="newsletter-submit"
                  disabled={subscribing}
                  className="inline-flex items-center gap-2 rounded bg-sun px-5 py-3 text-[14px] font-semibold text-ink transition-colors hover:bg-sun-2 disabled:opacity-60"
                >
                  <Mail className="h-4 w-4" /> {subscribing ? "…" : "Subscribe"}
                </button>
              </div>
              <p className="mt-3 text-[12px] text-cream/50">No spam. Unsubscribe anywhere in the email.</p>
            </form>
          </div>
        </Container>
      </section>
    </main>
  );
}
