import { useEffect, useMemo, useState } from "react";
import {
  PlusCircle, Trash2, Edit3, Eye, Sparkles, Save, X, Clock,
  CheckCircle2, AlertCircle, Mail, MessageSquare,
} from "lucide-react";
import {
  adminListBlogPosts,
  adminCreateBlogPost,
  adminUpdateBlogPost,
  adminDeleteBlogPost,
  adminListBlogComments,
  adminSetCommentStatus,
  adminDeleteComment,
  adminListSubscribers,
  adminBlogAi,
  type BlogPost,
  type BlogPostInput,
} from "@/lib/blog";
import { RichEditor } from "@/components/RichEditor";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AdminComment = {
  id: string; post_id: string; author_name: string; author_email: string;
  body: string; status: string; created_at: string;
};
type Subscriber = { id: string; email: string; source: string; created_at: string };

function emptyDraft(): BlogPostInput {
  return {
    title: "",
    content_html: "",
    excerpt: "",
    category: "",
    tags: [],
    status: "draft",
    seo_title: "",
    seo_description: "",
    canonical_url: "",
    faq: [],
    tldr: "",
    keywords: [],
    cover_image: "",
  };
}

export function AdminBlogTab() {
  const [tab, setTab] = useState<"posts" | "comments" | "subscribers">("posts");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [editing, setEditing] = useState<BlogPost | "new" | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, c, s] = await Promise.all([
        adminListBlogPosts(),
        adminListBlogComments().catch(() => [] as AdminComment[]),
        adminListSubscribers().catch(() => [] as Subscriber[]),
      ]);
      setPosts(p);
      setComments(c);
      setSubs(s);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const draftCount = useMemo(() => posts.filter((p) => p.status === "draft").length, [posts]);
  const pendingComments = useMemo(() => comments.filter((c) => c.status === "pending"), [comments]);

  if (editing !== null) {
    return (
      <PostEditor
        initial={editing === "new" ? null : editing}
        onClose={() => { setEditing(null); load(); }}
      />
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          {(["posts", "comments", "subscribers"] as const).map((t) => (
            <button
              key={t}
              data-testid={`admin-blog-tab-${t}`}
              onClick={() => setTab(t)}
              className={cn(
                "rounded border px-3 py-1.5 text-[12px] font-semibold",
                tab === t ? "border-sun bg-sun text-ink" : "border-cream/20 bg-transparent text-cream/70 hover:text-cream",
              )}
            >
              {t === "posts" && `Posts (${posts.length})`}
              {t === "comments" && `Comments (${pendingComments.length} pending)`}
              {t === "subscribers" && `Subscribers (${subs.length})`}
            </button>
          ))}
        </div>
        {tab === "posts" && (
          <button
            data-testid="admin-blog-new-post-btn"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 rounded bg-sun px-4 py-2 text-[13px] font-semibold text-ink hover:bg-sun-2"
          >
            <PlusCircle className="h-4 w-4" /> New post
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded border border-cream/10 p-10 text-center text-cream/60">Loading…</div>
      ) : tab === "posts" ? (
        <div className="rounded border border-cream/10">
          {posts.length === 0 ? (
            <div className="p-10 text-center text-cream/60">No posts yet. Create your first essay.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-cream/10 text-left text-cream/50">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-cream/5 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-cream">{p.title}</div>
                      <div className="font-mono text-[11px] text-cream/40">/blog/{p.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      {p.status === "published" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-sun/20 px-2 py-0.5 text-[11px] font-semibold text-sun">
                          <CheckCircle2 className="h-3 w-3" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-cream/10 px-2 py-0.5 text-[11px] font-semibold text-cream/70">
                          <Clock className="h-3 w-3" /> Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-cream/70">{p.category ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-cream/70">{p.view_count}</td>
                    <td className="px-4 py-3 text-cream/50">{new Date(p.updated_at ?? p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {p.status === "published" && (
                          <a
                            href={`/blog/${p.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`admin-blog-view-${p.slug}`}
                            className="inline-flex items-center gap-1 rounded border border-cream/20 px-2 py-1 text-[11px] hover:bg-cream/10"
                          >
                            <Eye className="h-3 w-3" /> View
                          </a>
                        )}
                        <button
                          data-testid={`admin-blog-edit-${p.slug}`}
                          onClick={() => setEditing(p)}
                          className="inline-flex items-center gap-1 rounded border border-cream/20 px-2 py-1 text-[11px] hover:bg-cream/10"
                        >
                          <Edit3 className="h-3 w-3" /> Edit
                        </button>
                        <button
                          data-testid={`admin-blog-delete-${p.slug}`}
                          onClick={async () => {
                            if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
                            await adminDeleteBlogPost(p.id);
                            toast.success("Post deleted");
                            load();
                          }}
                          className="inline-flex items-center gap-1 rounded border border-rust/40 px-2 py-1 text-[11px] text-rust hover:bg-rust/10"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {draftCount > 0 && (
            <div className="border-t border-cream/10 bg-ink-2 px-4 py-2 text-[11px] text-cream/50">
              {draftCount} draft{draftCount === 1 ? "" : "s"} not yet visible to readers.
            </div>
          )}
        </div>
      ) : tab === "comments" ? (
        <div className="rounded border border-cream/10">
          {comments.length === 0 ? (
            <div className="p-10 text-center text-cream/60">No comments yet.</div>
          ) : (
            <ul className="divide-y divide-cream/5">
              {comments.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold text-cream">{c.author_name} <span className="text-cream/40">· {c.author_email}</span></div>
                      <p className="mt-1 text-[13px] text-cream/80">{c.body}</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-cream/40">
                        <span>Post: {c.post_id}</span>
                        <span>·</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                        <span>·</span>
                        <span className={cn(
                          "rounded px-1.5 py-0.5",
                          c.status === "approved" ? "bg-sun/20 text-sun" : c.status === "pending" ? "bg-cream/10 text-cream/70" : "bg-rust/20 text-rust",
                        )}>{c.status}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {c.status !== "approved" && (
                        <button
                          onClick={async () => { await adminSetCommentStatus(c.id, "approved"); load(); }}
                          className="rounded border border-sun/40 px-2 py-1 text-[11px] text-sun hover:bg-sun/10"
                        >Approve</button>
                      )}
                      {c.status !== "spam" && (
                        <button
                          onClick={async () => { await adminSetCommentStatus(c.id, "spam"); load(); }}
                          className="rounded border border-cream/20 px-2 py-1 text-[11px] hover:bg-cream/10"
                        >Spam</button>
                      )}
                      <button
                        onClick={async () => { if (!confirm("Delete this comment?")) return; await adminDeleteComment(c.id); load(); }}
                        className="rounded border border-rust/40 px-2 py-1 text-[11px] text-rust hover:bg-rust/10"
                      >Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="rounded border border-cream/10">
          {subs.length === 0 ? (
            <div className="p-10 text-center text-cream/60">No subscribers yet.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-cream/10 text-left text-cream/50">
                <tr>
                  <th className="px-4 py-3"><Mail className="inline h-3.5 w-3.5" /> Email</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-cream/5 last:border-0">
                    <td className="px-4 py-3 text-cream">{s.email}</td>
                    <td className="px-4 py-3 text-cream/70">{s.source}</td>
                    <td className="px-4 py-3 text-cream/50">{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function PostEditor({ initial, onClose }: { initial: BlogPost | null; onClose: () => void }) {
  const [draft, setDraft] = useState<BlogPostInput>(() =>
    initial
      ? {
          title: initial.title,
          slug: initial.slug,
          excerpt: initial.excerpt,
          content_html: initial.content_html,
          cover_image: initial.cover_image ?? "",
          category: initial.category ?? "",
          tags: initial.tags ?? [],
          status: initial.status,
          seo_title: initial.seo_title ?? "",
          seo_description: initial.seo_description ?? "",
          canonical_url: initial.canonical_url ?? "",
          faq: initial.faq ?? [],
          tldr: initial.tldr ?? "",
          keywords: initial.keywords ?? [],
        }
      : emptyDraft(),
  );
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(", "));
  const [kwInput, setKwInput] = useState((initial?.keywords ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [aiMode, setAiMode] = useState<null | "meta" | "summary" | "faq" | "keywords">(null);

  const save = async (publish?: boolean) => {
    if (!draft.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!draft.content_html.replace(/<[^>]+>/g, "").trim()) {
      toast.error("Content cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const payload: BlogPostInput = {
        ...draft,
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        keywords: kwInput.split(",").map((t) => t.trim()).filter(Boolean),
        status: publish !== undefined ? (publish ? "published" : draft.status) : draft.status,
      };
      if (initial) {
        await adminUpdateBlogPost(initial.id, payload);
        toast.success(publish ? "Published" : "Saved");
      } else {
        await adminCreateBlogPost(payload);
        toast.success(publish ? "Created & published" : "Draft saved");
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const runAi = async (mode: "meta" | "summary" | "faq" | "keywords") => {
    if (!draft.title.trim() || !draft.content_html.replace(/<[^>]+>/g, "").trim()) {
      toast.error("Write a title and some content first.");
      return;
    }
    setAiMode(mode);
    try {
      const r = await adminBlogAi({ title: draft.title, content_html: draft.content_html, mode });
      if (mode === "meta") {
        setDraft((d) => ({ ...d, seo_description: String(r.result) }));
        toast.success("Meta description added");
      } else if (mode === "summary") {
        setDraft((d) => ({ ...d, tldr: String(r.result) }));
        toast.success("TL;DR added");
      } else if (mode === "keywords") {
        if (Array.isArray(r.result)) {
          const k = (r.result as string[]).map(String);
          setKwInput(k.join(", "));
          setDraft((d) => ({ ...d, keywords: k }));
          toast.success("Keywords added");
        } else { toast.info("AI returned text instead of JSON"); }
      } else if (mode === "faq") {
        if (Array.isArray(r.result)) {
          const faq = r.result as Array<{ question: string; answer: string }>;
          setDraft((d) => ({ ...d, faq }));
          toast.success("FAQ added");
        } else { toast.info("AI returned text instead of JSON"); }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setAiMode(null);
    }
  };

  const addFaq = () => setDraft((d) => ({ ...d, faq: [...(d.faq ?? []), { question: "", answer: "" }] }));
  const updateFaq = (i: number, key: "question" | "answer", v: string) =>
    setDraft((d) => ({ ...d, faq: (d.faq ?? []).map((f, idx) => (idx === i ? { ...f, [key]: v } : f)) }));
  const removeFaq = (i: number) =>
    setDraft((d) => ({ ...d, faq: (d.faq ?? []).filter((_, idx) => idx !== i) }));

  return (
    <div className="mt-8 rounded border border-cream/10 bg-ink-2 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow text-cream/50">{initial ? "Editing" : "New post"}</div>
          <h2 className="font-display text-[22px] font-semibold text-cream">{initial?.title || "Untitled draft"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="admin-blog-save-draft"
            onClick={() => save(false)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded border border-cream/20 px-3 py-2 text-[12px] font-semibold text-cream hover:bg-cream/10 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" /> Save draft
          </button>
          <button
            data-testid="admin-blog-publish"
            onClick={() => save(true)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded bg-sun px-4 py-2 text-[12px] font-semibold text-ink hover:bg-sun-2 disabled:opacity-60"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> {draft.status === "published" ? "Update" : "Publish"}
          </button>
          <button
            data-testid="admin-blog-cancel"
            onClick={onClose}
            className="rounded border border-cream/20 p-2 text-cream/70 hover:bg-cream/10"
          ><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left: editor */}
        <div className="md:col-span-2">
          <label className="eyebrow text-cream/50">Title</label>
          <input
            data-testid="admin-blog-title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="A clear, specific headline"
            className="mt-2 w-full rounded border border-cream/20 bg-cream/5 px-4 py-3 text-[18px] font-semibold text-cream placeholder:text-cream/30 focus:border-sun focus:outline-none"
          />

          <label className="eyebrow mt-5 block text-cream/50">Excerpt</label>
          <textarea
            data-testid="admin-blog-excerpt"
            value={draft.excerpt ?? ""}
            onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
            rows={2}
            placeholder="A 1-2 sentence summary shown in lists and previews."
            className="mt-2 w-full resize-y rounded border border-cream/20 bg-cream/5 px-4 py-2 text-[14px] text-cream placeholder:text-cream/30 focus:border-sun focus:outline-none"
          />

          <label className="eyebrow mt-5 block text-cream/50">Content</label>
          <div className="mt-2">
            <RichEditor
              value={draft.content_html}
              onChange={(html) => setDraft({ ...draft, content_html: html })}
            />
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="md:col-span-1">
          <div className="rounded border border-cream/10 bg-ink p-4">
            <div className="eyebrow text-cream/50">Publishing</div>
            <div className="mt-3 flex items-center gap-2 text-[12px]">
              <span className="text-cream/60">Status:</span>
              <span className={cn(
                "rounded px-2 py-0.5 font-semibold",
                draft.status === "published" ? "bg-sun/20 text-sun" : "bg-cream/10 text-cream/70",
              )}>{draft.status}</span>
            </div>
            <label className="eyebrow mt-4 block text-cream/50">Slug</label>
            <input
              data-testid="admin-blog-slug"
              value={draft.slug ?? ""}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              placeholder="auto-from-title"
              className="mt-1 w-full rounded border border-cream/20 bg-cream/5 px-3 py-1.5 font-mono text-[12px] text-cream focus:border-sun focus:outline-none"
            />
            <label className="eyebrow mt-3 block text-cream/50">Cover image URL</label>
            <input
              data-testid="admin-blog-cover"
              value={draft.cover_image ?? ""}
              onChange={(e) => setDraft({ ...draft, cover_image: e.target.value })}
              placeholder="https://…"
              className="mt-1 w-full rounded border border-cream/20 bg-cream/5 px-3 py-1.5 font-mono text-[12px] text-cream focus:border-sun focus:outline-none"
            />
            <label className="eyebrow mt-3 block text-cream/50">Category</label>
            <input
              data-testid="admin-blog-category"
              value={draft.category ?? ""}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="Hiring · Vetting · Fractional · Research"
              className="mt-1 w-full rounded border border-cream/20 bg-cream/5 px-3 py-1.5 text-[12px] text-cream focus:border-sun focus:outline-none"
            />
            <label className="eyebrow mt-3 block text-cream/50">Tags (comma-separated)</label>
            <input
              data-testid="admin-blog-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="senior-talent, vetting, hiring"
              className="mt-1 w-full rounded border border-cream/20 bg-cream/5 px-3 py-1.5 text-[12px] text-cream focus:border-sun focus:outline-none"
            />
          </div>

          {/* SEO + AEO */}
          <div className="mt-4 rounded border border-cream/10 bg-ink p-4">
            <div className="flex items-center justify-between">
              <div className="eyebrow text-cream/50">SEO · GEO · AEO</div>
              <Sparkles className="h-3.5 w-3.5 text-sun" />
            </div>
            <label className="eyebrow mt-3 block text-cream/50">Meta title</label>
            <input
              data-testid="admin-blog-seo-title"
              value={draft.seo_title ?? ""}
              onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })}
              placeholder="Defaults to title"
              className="mt-1 w-full rounded border border-cream/20 bg-cream/5 px-3 py-1.5 text-[12px] text-cream focus:border-sun focus:outline-none"
            />
            <label className="eyebrow mt-3 block text-cream/50">Meta description</label>
            <textarea
              data-testid="admin-blog-seo-desc"
              value={draft.seo_description ?? ""}
              onChange={(e) => setDraft({ ...draft, seo_description: e.target.value })}
              rows={3}
              placeholder="140-158 characters, action-oriented."
              className="mt-1 w-full resize-y rounded border border-cream/20 bg-cream/5 px-3 py-1.5 text-[12px] text-cream focus:border-sun focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] text-cream/40">{(draft.seo_description ?? "").length} / 158</span>
              <button
                data-testid="admin-blog-ai-meta"
                onClick={() => runAi("meta")}
                disabled={aiMode !== null}
                className="inline-flex items-center gap-1 rounded bg-sun/20 px-2 py-1 text-[11px] font-semibold text-sun hover:bg-sun/30 disabled:opacity-60"
              ><Sparkles className="h-3 w-3" /> {aiMode === "meta" ? "…" : "AI generate"}</button>
            </div>

            <label className="eyebrow mt-4 block text-cream/50">TL;DR (AEO surface)</label>
            <textarea
              data-testid="admin-blog-tldr"
              value={draft.tldr ?? ""}
              onChange={(e) => setDraft({ ...draft, tldr: e.target.value })}
              rows={3}
              placeholder="A 2-3 sentence summary AI assistants can quote."
              className="mt-1 w-full resize-y rounded border border-cream/20 bg-cream/5 px-3 py-1.5 text-[12px] text-cream focus:border-sun focus:outline-none"
            />
            <div className="mt-1 flex justify-end">
              <button
                data-testid="admin-blog-ai-summary"
                onClick={() => runAi("summary")}
                disabled={aiMode !== null}
                className="inline-flex items-center gap-1 rounded bg-sun/20 px-2 py-1 text-[11px] font-semibold text-sun hover:bg-sun/30 disabled:opacity-60"
              ><Sparkles className="h-3 w-3" /> {aiMode === "summary" ? "…" : "AI generate"}</button>
            </div>

            <label className="eyebrow mt-4 block text-cream/50">Keywords (comma-separated)</label>
            <input
              data-testid="admin-blog-keywords"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              placeholder="fractional cfo, vetting, hire senior"
              className="mt-1 w-full rounded border border-cream/20 bg-cream/5 px-3 py-1.5 text-[12px] text-cream focus:border-sun focus:outline-none"
            />
            <div className="mt-1 flex justify-end">
              <button
                data-testid="admin-blog-ai-keywords"
                onClick={() => runAi("keywords")}
                disabled={aiMode !== null}
                className="inline-flex items-center gap-1 rounded bg-sun/20 px-2 py-1 text-[11px] font-semibold text-sun hover:bg-sun/30 disabled:opacity-60"
              ><Sparkles className="h-3 w-3" /> {aiMode === "keywords" ? "…" : "AI extract"}</button>
            </div>

            <label className="eyebrow mt-4 block text-cream/50">Canonical URL (optional)</label>
            <input
              data-testid="admin-blog-canonical"
              value={draft.canonical_url ?? ""}
              onChange={(e) => setDraft({ ...draft, canonical_url: e.target.value })}
              placeholder="https://worksoy.com/blog/…"
              className="mt-1 w-full rounded border border-cream/20 bg-cream/5 px-3 py-1.5 font-mono text-[12px] text-cream focus:border-sun focus:outline-none"
            />
          </div>

          {/* FAQ block */}
          <div className="mt-4 rounded border border-cream/10 bg-ink p-4">
            <div className="flex items-center justify-between">
              <div className="eyebrow text-cream/50">FAQ (renders as JSON-LD FAQPage)</div>
              <button
                data-testid="admin-blog-ai-faq"
                onClick={() => runAi("faq")}
                disabled={aiMode !== null}
                className="inline-flex items-center gap-1 rounded bg-sun/20 px-2 py-1 text-[11px] font-semibold text-sun hover:bg-sun/30 disabled:opacity-60"
              ><Sparkles className="h-3 w-3" /> {aiMode === "faq" ? "…" : "AI generate"}</button>
            </div>
            <ul className="mt-3 space-y-3">
              {(draft.faq ?? []).map((f, i) => (
                <li key={i} className="rounded border border-cream/10 bg-cream/5 p-3">
                  <input
                    value={f.question}
                    onChange={(e) => updateFaq(i, "question", e.target.value)}
                    placeholder="Question"
                    className="w-full rounded border border-cream/20 bg-cream/5 px-2 py-1 text-[12px] font-semibold text-cream focus:border-sun focus:outline-none"
                  />
                  <textarea
                    value={f.answer}
                    onChange={(e) => updateFaq(i, "answer", e.target.value)}
                    rows={2}
                    placeholder="Answer (2-3 sentences)"
                    className="mt-2 w-full resize-y rounded border border-cream/20 bg-cream/5 px-2 py-1 text-[12px] text-cream focus:border-sun focus:outline-none"
                  />
                  <button
                    onClick={() => removeFaq(i)}
                    className="mt-2 text-[11px] text-rust hover:underline"
                  >Remove</button>
                </li>
              ))}
            </ul>
            <button
              data-testid="admin-blog-add-faq"
              onClick={addFaq}
              className="mt-3 inline-flex items-center gap-1 rounded border border-cream/20 px-2 py-1 text-[11px] text-cream/70 hover:bg-cream/10"
            ><PlusCircle className="h-3 w-3" /> Add FAQ</button>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded border border-dashed border-cream/10 p-3 text-[11px] text-cream/50">
        <AlertCircle className="mr-1 inline h-3 w-3" />
        Drafts are not indexable. Publishing adds the post to <code className="font-mono">/api/sitemap.xml</code> and surfaces it for SEO/GEO/AEO crawlers (Google, GPTBot, ClaudeBot, PerplexityBot).
      </div>
    </div>
  );
}
