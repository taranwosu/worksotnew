const BASE = import.meta.env.VITE_BACKEND_URL;

if (!BASE) {
  // Surface missing config early in dev.
  // eslint-disable-next-line no-console
  console.error("VITE_BACKEND_URL is not set");
}

type ApiExpert = {
  id: string;
  name: string;
  headline: string;
  category: string;
  specialties: string[];
  location: string;
  hourlyRate: number;
  currency: string;
  rating: number;
  reviewCount: number;
  availability: string;
  topRated: boolean;
  verified: boolean;
  image: string;
  bio: string;
  yearsExperience: number;
  languages: string[];
  certifications: string[];
};

import type { Expert } from "@/data/experts";

function toExpert(a: ApiExpert): Expert {
  return {
    id: a.id,
    name: a.name,
    title: a.headline,
    specialty: a.category,
    category: a.category,
    location: a.location,
    hourlyRate: a.hourlyRate,
    rating: a.rating,
    reviewCount: a.reviewCount,
    availability: a.availability,
    verified: a.verified,
    topRated: a.topRated,
    image: a.image,
    bio: a.bio,
    skills: a.specialties,
    languages: a.languages,
    experience: `${a.yearsExperience} years`,
    completedProjects: Math.round(a.reviewCount * 1.4),
    responseTime: a.availability.toLowerCase().includes("now") ? "< 2 hours" : "< 24 hours",
  };
}

export async function fetchExperts(params: {
  q?: string;
  category?: string;
  sort?: string;
} = {}): Promise<Expert[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.category && params.category !== "all") qs.set("category", params.category);
  if (params.sort) qs.set("sort", params.sort);
  const res = await fetch(`${BASE}/api/experts?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch experts: ${res.status}`);
  const data: ApiExpert[] = await res.json();
  return data.map(toExpert);
}

export async function fetchExpert(id: string): Promise<Expert> {
  const res = await fetch(`${BASE}/api/experts/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Expert not found`);
  const data: ApiExpert = await res.json();
  return toExpert(data);
}

export async function fetchCategories(): Promise<{ category: string; count: number }[]> {
  const res = await fetch(`${BASE}/api/experts/categories`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

// ---------- Auth ----------
export type AuthUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  provider: string;
  role: string;
};

async function handleAuth(res: Response): Promise<{ user: AuthUser; token: string }> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.detail ?? `Request failed (${res.status})`);
  return { user: body.user, token: body.session_token };
}

export async function apiRegister(email: string, password: string, name: string) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, name }),
  });
  return handleAuth(res);
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  return handleAuth(res);
}

export async function apiGoogleSession(session_id: string) {
  const res = await fetch(`${BASE}/api/auth/google-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ session_id }),
  });
  return handleAuth(res);
}

export async function apiMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}

export async function apiLogout() {
  await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
}
