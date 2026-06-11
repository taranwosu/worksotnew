// Blog API client
const BASE = import.meta.env.VITE_BACKEND_URL;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const b = await res.json();
      if (b?.detail) msg = typeof b.detail === "string" ? b.detail : JSON.stringify(b.detail);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content_html: string;
  cover_image: string | null;
  category: string | null;
  tags: string[];
  status: "draft" | "published";
  author_name: string;
  author_picture: string | null;
  reading_time_min: number;
  view_count: number;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  faq: Array<{ question: string; answer: string }>;
  tldr: string | null;
  keywords: string[];
  published_at: string | null;
  updated_at: string | null;
  created_at: string;
};

export type BlogComment = {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type BlogPostDetail = {
  post: BlogPost;
  related: BlogPost[];
  comments: BlogComment[];
};

export type BlogPostInput = {
  title: string;
  slug?: string;
  excerpt?: string;
  content_html: string;
  cover_image?: string | null;
  category?: string | null;
  tags?: string[];
  status: "draft" | "published";
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_url?: string | null;
  faq?: Array<{ question: string; answer: string }>;
  tldr?: string | null;
  keywords?: string[];
};

// --- Public
export async function listBlogPosts(params: { q?: string; category?: string; tag?: string; limit?: number; skip?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.category) qs.set("category", params.category);
  if (params.tag) qs.set("tag", params.tag);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.skip) qs.set("skip", String(params.skip));
  return req<{ posts: BlogPost[]; total: number }>(`/api/blog/posts?${qs.toString()}`);
}
export async function getBlogPost(slug: string) {
  return req<BlogPostDetail>(`/api/blog/posts/${slug}`);
}
export async function listBlogCategories() {
  return req<Array<{ category: string; count: number }>>(`/api/blog/categories`);
}
export async function listBlogTags() {
  return req<Array<{ tag: string; count: number }>>(`/api/blog/tags`);
}
export async function postBlogComment(p: { post_id: string; author_name: string; author_email: string; body: string }) {
  return req<{ id: string; status: "approved" | "pending" }>(`/api/blog/comments`, {
    method: "POST",
    body: JSON.stringify(p),
  });
}
export async function subscribeNewsletter(email: string, source = "blog") {
  return req<{ ok: boolean; already_subscribed: boolean }>(`/api/blog/subscribe`, {
    method: "POST",
    body: JSON.stringify({ email, source }),
  });
}

// --- Admin
export async function adminListBlogPosts(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return req<BlogPost[]>(`/api/admin/blog/posts${qs}`);
}
export async function adminCreateBlogPost(p: BlogPostInput) {
  return req<BlogPost>(`/api/admin/blog/posts`, { method: "POST", body: JSON.stringify(p) });
}
export async function adminUpdateBlogPost(id: string, p: BlogPostInput) {
  return req<BlogPost>(`/api/admin/blog/posts/${id}`, { method: "PATCH", body: JSON.stringify(p) });
}
export async function adminDeleteBlogPost(id: string) {
  return req<{ ok: boolean }>(`/api/admin/blog/posts/${id}`, { method: "DELETE" });
}
export async function adminListBlogComments(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return req<Array<{ id: string; post_id: string; author_name: string; author_email: string; body: string; status: string; created_at: string }>>(`/api/admin/blog/comments${qs}`);
}
export async function adminSetCommentStatus(id: string, status: "approved" | "pending" | "spam") {
  return req<{ ok: boolean }>(`/api/admin/blog/comments/${id}/status?status=${status}`, { method: "POST" });
}
export async function adminDeleteComment(id: string) {
  return req<{ ok: boolean }>(`/api/admin/blog/comments/${id}`, { method: "DELETE" });
}
export async function adminListSubscribers() {
  return req<Array<{ id: string; email: string; source: string; created_at: string }>>(`/api/admin/blog/subscribers`);
}
export async function adminBlogAi(p: { title: string; content_html: string; mode: "meta" | "summary" | "faq" | "keywords" }) {
  return req<{ result: string | Array<{ question: string; answer: string }> | string[]; mode: string; raw?: boolean }>(`/api/admin/blog/ai/generate`, {
    method: "POST",
    body: JSON.stringify(p),
  });
}
