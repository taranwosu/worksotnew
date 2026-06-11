import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { Clock, ArrowLeft, MessageSquare, Share2, Sparkles, ChevronRight, Star, ArrowUpRight, List } from "lucide-react";
import { getBlogPost, postBlogComment, getRelatedExperts, type BlogPostDetail, type RelatedExpert } from "@/lib/blog";
import { usePageMeta } from "@/lib/seo";
import { Container, Eyebrow, Tag, Reveal } from "@/components/primitives";
import { toast } from "sonner";

function formatDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

const ORIGIN = "https://worksoy.com";

function slugifyHeading(text: string, used: Set<string>): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "section";
  let s = base;
  let n = 2;
  while (used.has(s)) { s = `${base}-${n++}`; }
  used.add(s);
  return s;
}

type TocEntry = { id: string; text: string; level: 2 | 3 };

/**
 * Parse the post HTML, inject id= attributes onto H2/H3 elements so the ToC
 * can deep-link to them, and return both the rewritten HTML + the headings
 * list. Pure client-side — no DOMParser side-effects on document.
 */
function buildToc(html: string): { html: string; toc: TocEntry[] } {
  if (typeof window === "undefined" || !html) return { html, toc: [] };
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<root>${html}</root>`, "text/html");
  const root = doc.body.querySelector("root") ?? doc.body;
  const used = new Set<string>();
  const toc: TocEntry[] = [];
  root.querySelectorAll("h2, h3").forEach((h) => {
    const text = h.textContent?.trim() || "";
    if (!text) return;
    const id = slugifyHeading(text, used);
    h.setAttribute("id", id);
    toc.push({ id, text, level: h.tagName === "H2" ? 2 : 3 });
  });
  return { html: root.innerHTML, toc };
}

function injectJsonLd(post: BlogPostDetail["post"]) {
  // BlogPosting + BreadcrumbList + Organization + optional FAQPage
  const url = `${ORIGIN}/blog/${post.slug}`;
  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seo_description || post.excerpt,
    image: post.cover_image ? [post.cover_image] : undefined,
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at || post.published_at || post.created_at,
    author: {
      "@type": "Person",
      name: post.author_name,
    },
    publisher: {
      "@type": "Organization",
      name: "WorkSoy",
      logo: { "@type": "ImageObject", url: `${ORIGIN}/favicon.ico` },
    },
    keywords: (post.keywords || []).join(", ") || undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: post.category || undefined,
    wordCount: (post.content_html || "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).length,
    timeRequired: `PT${post.reading_time_min}M`,
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "WorkSoy", item: ORIGIN },
      { "@type": "ListItem", position: 2, name: "Journal", item: `${ORIGIN}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };
  const faqPage =
    post.faq && post.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faq.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;
  const blobs = [blogPosting, breadcrumb, faqPage].filter(Boolean);
  return blobs;
}

export function BlogPostPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const navigate = useNavigate();
  const [data, setData] = useState<BlogPostDetail | null>(null);
  const [relatedExperts, setRelatedExperts] = useState<RelatedExpert[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Comment form
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cBody, setCBody] = useState("");
  const [posting, setPosting] = useState(false);

  // Reading progress bar — clamped to the article body via ref.
  const articleRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  // Build the ToC + rewrite HTML to embed heading ids (memoised on post change).
  const { html: bodyHtml, toc } = useMemo(
    () => (data ? buildToc(data.post.content_html) : { html: "", toc: [] as TocEntry[] }),
    [data?.post.id, data?.post.content_html], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    getBlogPost(slug)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    getRelatedExperts(slug)
      .then((e) => { if (!cancelled) setRelatedExperts(e); })
      .catch(() => { /* swallow — section is optional */ });
    return () => { cancelled = true; };
  }, [slug]);

  usePageMeta({
    title: data?.post.seo_title || data?.post.title || "Journal",
    description: data?.post.seo_description || data?.post.excerpt,
    path: `/blog/${slug}`,
    image: data?.post.cover_image || undefined,
  });

  // Inject JSON-LD structured data
  useEffect(() => {
    if (!data) return;
    const created: HTMLScriptElement[] = [];
    for (const blob of injectJsonLd(data.post)) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.text = JSON.stringify(blob);
      s.dataset.blogJsonld = "1";
      document.head.appendChild(s);
      created.push(s);
    }
    return () => { for (const s of created) s.remove(); };
  }, [data]);

  // Reading progress — tracked against the article body bounding box.
  useEffect(() => {
    if (!data) return;
    let raf = 0;
    const compute = () => {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) { setProgress(0); return; }
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      setProgress(scrolled / total);
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => { raf = 0; compute(); });
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [data]);

  // Inject an <link rel="alternate" type="application/rss+xml"> tag so
  // browsers + AI agents discover the feed from any post page.
  useEffect(() => {
    const base = (import.meta.env.VITE_BACKEND_URL as string) || ORIGIN;
    const link = document.createElement("link");
    link.rel = "alternate";
    link.type = "application/rss+xml";
    link.title = "WorkSoy Journal RSS";
    link.href = `${base}/api/blog/rss.xml`;
    link.dataset.blogRss = "1";
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, []);

  const onCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setPosting(true);
    try {
      const r = await postBlogComment({
        post_id: data.post.id,
        author_name: cName,
        author_email: cEmail,
        body: cBody,
      });
      if (r.status === "approved") {
        toast.success("Comment posted.");
        // Optimistically add
        setData({
          ...data,
          comments: [
            { id: r.id, author_name: cName, body: cBody, created_at: new Date().toISOString() },
            ...data.comments,
          ],
        });
      } else {
        toast.success("Comment received — held for review.");
      }
      setCName(""); setCEmail(""); setCBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post comment");
    } finally {
      setPosting(false);
    }
  };

  const onShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share && data) {
      try {
        await navigator.share({ title: data.post.title, url: window.location.href });
        return;
      } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  if (loading) {
    return (
      <main className="bg-cream py-24">
        <Container>
          <div className="mx-auto h-96 max-w-3xl animate-pulse rounded bg-white/60" />
        </Container>
      </main>
    );
  }

  if (notFound || !data) {
    return (
      <main className="bg-cream py-32">
        <Container className="text-center">
          <Eyebrow>404 · post</Eyebrow>
          <h1 className="display-lg mt-4">This essay isn't here.</h1>
          <p className="prose-lede mt-4">It may have been retired or never published.</p>
          <button
            onClick={() => navigate({ to: "/blog" })}
            className="mt-8 inline-flex items-center gap-2 rounded border border-ink px-4 py-2 text-[13px] font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Back to the journal
          </button>
        </Container>
      </main>
    );
  }

  const { post, related, comments } = data;

  return (
    <main className="bg-cream">
      {/* Reading progress bar — fixed at top. Hidden when the article is
          shorter than the viewport (no scroll = no need to indicate it). */}
      <div
        aria-hidden
        data-testid="reading-progress-bar"
        className="pointer-events-none fixed left-0 right-0 top-0 z-50 h-[3px] bg-transparent"
        style={{ opacity: progress > 0 && progress < 1 ? 1 : progress >= 1 ? 0.4 : 0 }}
      >
        <div
          className="h-full bg-sun transition-[width] duration-100 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {/* Breadcrumb / back */}
      <Container className="pt-8 text-[13px] text-ink-60">
        <nav className="flex items-center gap-2" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-ink">WorkSoy</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/blog" className="hover:text-ink">Journal</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-ink">{post.category ?? "Essay"}</span>
        </nav>
      </Container>

      {/* Article header */}
      <article ref={articleRef}>
        <header className="pb-10 pt-10">
          <Container>
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center gap-3">
                {post.category && <Tag tone="sun" size="sm">{post.category}</Tag>}
                <span className="eyebrow text-ink-60">{formatDate(post.published_at)}</span>
                <span className="eyebrow inline-flex items-center gap-1 text-ink-60">
                  <Clock className="h-3 w-3" /> {post.reading_time_min} min read
                </span>
              </div>
              <h1 className="display-xl mt-6">{post.title}</h1>
              {post.excerpt && <p className="prose-lede mt-6">{post.excerpt}</p>}
              <div className="mt-8 flex items-center justify-between gap-4 border-y border-ink-10 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-cream">
                    {post.author_name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold">{post.author_name}</div>
                    <div className="text-[12px] text-ink-60">WorkSoy Editorial</div>
                  </div>
                </div>
                <button
                  onClick={onShare}
                  data-testid="blog-share-btn"
                  className="inline-flex items-center gap-2 rounded border border-ink-20 bg-white px-3 py-1.5 text-[13px] font-medium hover:bg-cream-2"
                >
                  <Share2 className="h-3.5 w-3.5" /> Share
                </button>
              </div>
            </div>
          </Container>
        </header>

        {post.cover_image && (
          <Container className="pb-10">
            <div className="mx-auto max-w-4xl">
              <img src={post.cover_image} alt={post.title} className="w-full rounded border border-ink-10" />
            </div>
          </Container>
        )}

        {/* TL;DR — AEO surface */}
        {post.tldr && (
          <Container className="pb-6">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-start gap-3 rounded border-l-4 border-sun bg-paper px-5 py-4">
                <Sparkles className="mt-0.5 h-4 w-4 text-sun-2" />
                <div>
                  <div className="eyebrow text-ink-60">TL;DR</div>
                  <p className="mt-1 text-[15px] text-ink">{post.tldr}</p>
                </div>
              </div>
            </div>
          </Container>
        )}

        {/* Body + sticky ToC sidebar */}
        <Container className="pb-16">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_minmax(0,720px)_220px]">
            {/* Left spacer (keeps body visually centered on lg+) */}
            <div className="hidden lg:block" />

            <div>
              <div
                className="prose-blog max-w-none"
                data-testid="blog-post-content"
                dangerouslySetInnerHTML={{ __html: bodyHtml || post.content_html }}
              />

              {post.tags && post.tags.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-2">
                  {post.tags.map((t) => (
                    <Link
                      key={t}
                      to="/blog"
                      search={{} as never}
                      className="rounded-pill border border-ink-20 bg-white px-3 py-1 text-[12px] text-ink hover:bg-cream-2"
                    >
                      #{t}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Sticky ToC — only when 2+ headings */}
            {toc.length >= 2 ? (
              <aside
                data-testid="blog-toc"
                className="hidden lg:block"
                aria-label="Table of contents"
              >
                <div className="sticky top-24">
                  <div className="eyebrow inline-flex items-center gap-2 text-ink-60">
                    <List className="h-3 w-3" /> On this page
                  </div>
                  <ol className="mt-4 space-y-1 border-l border-ink-10">
                    {toc.map((h) => (
                      <li
                        key={h.id}
                        className={h.level === 3 ? "pl-7" : "pl-4"}
                      >
                        <a
                          href={`#${h.id}`}
                          data-testid={`toc-${h.id}`}
                          className="block border-l border-transparent py-1 text-[12.5px] leading-snug text-ink-60 hover:border-ink hover:text-ink"
                        >
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              </aside>
            ) : (
              <div className="hidden lg:block" />
            )}
          </div>
        </Container>

        {/* Related vetted expert — converts long-reads into marketplace funnel */}
        {relatedExperts.length > 0 && (
          <section
            data-testid="related-experts-section"
            className="border-y border-ink-10 bg-paper py-14"
          >
            <Container>
              <div className="mx-auto max-w-4xl">
                <div className="grid items-start gap-8 md:grid-cols-12">
                  <div className="md:col-span-5">
                    <Sparkles className="h-5 w-5 text-sun-2" />
                    <h2 className="display-md mt-4">
                      Want to talk to someone who actually does this?
                    </h2>
                    <p className="prose-lede mt-4">
                      Every WorkSoy expert is gauntlet-vetted. Brief them, get a 48-hour shortlist, sign by Friday.
                    </p>
                    <Link
                      to="/experts"
                      data-testid="related-experts-browse-all"
                      className="mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-ink hover:underline"
                    >
                      Browse the full network <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="md:col-span-7">
                    <ul className="space-y-3">
                      {relatedExperts.map((e) => (
                        <li key={e.id}>
                          <Link
                            to="/experts/$expertId"
                            params={{ expertId: e.id }}
                            data-testid={`related-expert-${e.id}`}
                            className="group flex items-center gap-4 rounded border border-ink-10 bg-white p-4 transition-colors hover:border-ink"
                          >
                            {e.image ? (
                              <img
                                src={e.image}
                                alt={e.name}
                                className="h-14 w-14 shrink-0 rounded-full border border-ink-10 object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cream-2 font-semibold text-ink">
                                {e.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-display text-[16px] font-semibold text-ink">{e.name}</span>
                                {e.rating > 0 && (
                                  <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-ink-60">
                                    <Star className="h-3 w-3 fill-sun text-sun" />
                                    {e.rating.toFixed(1)}
                                    {e.reviewCount > 0 && <span className="text-ink-40">· {e.reviewCount}</span>}
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-[13px] text-ink-60">{e.headline}</div>
                              <div className="mt-1 flex items-center gap-3 text-[11px] text-ink-40">
                                <span>{e.category}</span>
                                {e.hourlyRate > 0 && <span>· ${e.hourlyRate}/hr</span>}
                              </div>
                            </div>
                            <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Container>
          </section>
        )}

        {/* FAQ — AEO structured */}
        {post.faq && post.faq.length > 0 && (
          <section className="border-t border-ink-10 bg-paper py-16">
            <Container>
              <div className="mx-auto max-w-3xl">
                <Eyebrow>Quick answers</Eyebrow>
                <h2 className="display-md mt-3">Frequently asked</h2>
                <dl className="mt-8 divide-y divide-ink-10">
                  {post.faq.map((f, i) => (
                    <div key={i} className="py-5">
                      <dt className="font-display text-[18px] font-semibold">{f.question}</dt>
                      <dd className="mt-2 text-[15px] text-ink-60">{f.answer}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Container>
          </section>
        )}
      </article>

      {/* Comments */}
      <section className="border-t border-ink-10 py-16">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2 className="display-md inline-flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-ink-60" /> Comments ({comments.length})
            </h2>

            <form onSubmit={onCommentSubmit} className="mt-8 rounded border border-ink-10 bg-white p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  data-testid="comment-name-input"
                  required minLength={1} maxLength={80}
                  value={cName} onChange={(e) => setCName(e.target.value)}
                  placeholder="Your name" className="input"
                />
                <input
                  data-testid="comment-email-input"
                  required type="email"
                  value={cEmail} onChange={(e) => setCEmail(e.target.value)}
                  placeholder="Your email (not shown)" className="input"
                />
              </div>
              <textarea
                data-testid="comment-body-input"
                required minLength={2} maxLength={4000}
                value={cBody} onChange={(e) => setCBody(e.target.value)}
                rows={4} placeholder="Share your take…"
                className="input mt-3 resize-y"
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[12px] text-ink-60">Be useful. Comments with suspicious links go to moderation.</p>
                <button
                  type="submit"
                  data-testid="comment-submit-btn"
                  disabled={posting}
                  className="rounded bg-ink px-5 py-2 text-[13px] font-semibold text-cream hover:bg-ink-2 disabled:opacity-60"
                >
                  {posting ? "Posting…" : "Post comment"}
                </button>
              </div>
            </form>

            {comments.length > 0 && (
              <ul className="mt-8 space-y-6">
                {comments.map((c) => (
                  <li key={c.id} className="border-b border-ink-08 pb-5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cream-2 text-[11px] font-semibold text-ink">
                        {c.author_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[14px] font-semibold">{c.author_name}</span>
                      <span className="text-[11px] text-ink-40">· {formatDate(c.created_at)}</span>
                    </div>
                    <p className="mt-2 text-[15px] text-ink">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Container>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t border-ink-10 bg-paper py-16">
          <Container>
            <Eyebrow>Read next</Eyebrow>
            <h2 className="display-md mt-3">More from the journal</h2>
            <Reveal>
              <div className="mt-10 grid gap-y-12 gap-x-10 md:grid-cols-3">
                {related.slice(0, 3).map((r) => (
                  <Link
                    key={r.id}
                    to="/blog/$slug"
                    params={{ slug: r.slug }}
                    data-testid={`blog-related-${r.slug}`}
                    className="group block"
                  >
                    {r.cover_image ? (
                      <img src={r.cover_image} alt={r.title} className="aspect-[4/3] w-full rounded border border-ink-10 object-cover" />
                    ) : (
                      <div className="aspect-[4/3] w-full rounded border border-ink-10 bg-gradient-to-br from-cream-2 to-sand" />
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      {r.category && <Tag tone="ink" size="sm">{r.category}</Tag>}
                      <span className="eyebrow text-ink-60">{formatDate(r.published_at)}</span>
                    </div>
                    <h3 className="mt-2 font-display text-[20px] font-semibold leading-tight group-hover:underline group-hover:decoration-sun-2 group-hover:underline-offset-4">
                      {r.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-[14px] text-ink-60">{r.excerpt}</p>
                  </Link>
                ))}
              </div>
            </Reveal>
          </Container>
        </section>
      )}
    </main>
  );
}
