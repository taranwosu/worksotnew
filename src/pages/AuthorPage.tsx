import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, ArrowUpRight, BookOpen, Eye } from "lucide-react";
import { getAuthor, type AuthorProfile, type BlogPost } from "@/lib/blog";
import { usePageMeta } from "@/lib/seo";
import { Container, Eyebrow, Tag, Reveal } from "@/components/primitives";

function formatDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function AuthorPage() {
  const { authorSlug } = useParams({ strict: false }) as { authorSlug: string };
  const navigate = useNavigate();
  const [author, setAuthor] = useState<AuthorProfile | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    getAuthor(authorSlug)
      .then((d) => {
        if (cancelled) return;
        setAuthor(d.author);
        setPosts(d.posts);
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authorSlug]);

  usePageMeta({
    title: author ? `${author.name} — WorkSoy Journal` : "Author — WorkSoy Journal",
    description: author
      ? `Essays and field notes by ${author.name}. ${author.post_count} post${author.post_count === 1 ? "" : "s"} on the WorkSoy Journal — ${author.categories.join(", ") || "hiring, vetting, senior talent"}.`
      : "Author profile on the WorkSoy Journal.",
    path: `/blog/author/${authorSlug}`,
  });

  if (loading) {
    return (
      <main className="bg-cream py-24">
        <Container>
          <div className="mx-auto h-64 max-w-3xl animate-pulse rounded bg-white/60" />
        </Container>
      </main>
    );
  }

  if (notFound || !author) {
    return (
      <main className="bg-cream py-32">
        <Container className="text-center">
          <Eyebrow>404 · author</Eyebrow>
          <h1 className="display-lg mt-4">No one here by that name.</h1>
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

  return (
    <main className="bg-cream">
      {/* Header */}
      <section className="border-b border-ink-10">
        <Container className="py-16">
          <Link to="/blog" className="eyebrow inline-flex items-center gap-2 text-ink-60 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> The journal
          </Link>
          <div className="mt-8 grid items-end gap-10 md:grid-cols-12">
            <div className="md:col-span-8">
              <Eyebrow>Author</Eyebrow>
              <div className="mt-4 flex items-center gap-5">
                {author.picture ? (
                  <img
                    src={author.picture}
                    alt={author.name}
                    className="h-20 w-20 rounded-full border border-ink-10 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ink font-display text-[28px] font-semibold text-cream">
                    {author.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h1 className="display-lg" data-testid="author-name">{author.name}</h1>
                  <p className="prose-lede mt-1 max-w-xl">
                    Writes on {author.categories.length > 0 ? author.categories.join(" · ") : "the craft of hiring and vetting"}.
                  </p>
                </div>
              </div>
            </div>
            <aside className="md:col-span-4 md:border-l md:border-ink-10 md:pl-8">
              <dl className="grid grid-cols-3 gap-4 text-[13px]">
                <div>
                  <dt className="eyebrow text-ink-60">Posts</dt>
                  <dd className="mt-1 font-display text-[24px] font-semibold tabular" data-testid="author-post-count">{author.post_count}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-ink-60">Reads</dt>
                  <dd className="mt-1 font-display text-[24px] font-semibold tabular">{author.total_views}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-ink-60">Since</dt>
                  <dd className="mt-1 font-display text-[24px] font-semibold tabular">
                    {author.first_published_at ? new Date(author.first_published_at).getFullYear() : "—"}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </Container>
      </section>

      {/* Posts grid */}
      <section className="py-16">
        <Container>
          <div className="flex items-baseline justify-between">
            <Eyebrow>All posts by {author.name}</Eyebrow>
            <span className="text-[12px] text-ink-60">
              {author.post_count} post{author.post_count === 1 ? "" : "s"}
            </span>
          </div>
          <Reveal>
            <div className="mt-10 grid gap-y-12 gap-x-10 md:grid-cols-3" data-testid="author-posts-grid">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  data-testid={`author-post-${p.slug}`}
                  className="group block"
                >
                  {p.cover_image ? (
                    <img src={p.cover_image} alt={p.title} className="aspect-[4/3] w-full rounded border border-ink-10 object-cover" />
                  ) : (
                    <div className="aspect-[4/3] w-full rounded border border-ink-10 bg-gradient-to-br from-cream-2 to-sand" />
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    {p.category && <Tag tone="ink" size="sm">{p.category}</Tag>}
                    <span className="eyebrow text-ink-60">{formatDate(p.published_at)}</span>
                  </div>
                  <h3 className="mt-2 font-display text-[20px] font-semibold leading-tight group-hover:underline group-hover:decoration-sun-2 group-hover:underline-offset-4">
                    {p.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[14px] text-ink-60">{p.excerpt}</p>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-60">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.reading_time_min} min</span>
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {p.view_count}</span>
                    <ArrowUpRight className="h-3 w-3 ml-auto opacity-40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          </Reveal>
          <div className="mt-16 flex items-center justify-center">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 rounded border border-ink px-5 py-2 text-[13px] font-semibold hover:bg-cream-2"
            >
              <BookOpen className="h-4 w-4" /> Browse the full journal
            </Link>
          </div>
        </Container>
      </section>
    </main>
  );
}
