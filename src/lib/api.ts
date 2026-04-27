const BASE = import.meta.env.VITE_BACKEND_URL;

if (!BASE) {
  // eslint-disable-next-line no-console
  console.error("VITE_BACKEND_URL is not set");
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ================= Experts =================
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

export async function fetchExperts(params: { q?: string; category?: string; sort?: string } = {}): Promise<Expert[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.category && params.category !== "all") qs.set("category", params.category);
  if (params.sort) qs.set("sort", params.sort);
  const data = await req<ApiExpert[]>(`/api/experts?${qs.toString()}`);
  return data.map(toExpert);
}

export async function fetchExpert(id: string): Promise<Expert> {
  return toExpert(await req<ApiExpert>(`/api/experts/${id}`));
}

export async function fetchCategories(): Promise<{ category: string; count: number }[]> {
  try {
    return await req(`/api/experts/categories`);
  } catch {
    return [];
  }
}

export type ExpertProfileInput = {
  headline: string;
  category: string;
  specialties: string[];
  hourlyRate: number;
  location: string;
  yearsExperience: number;
  bio: string;
  image?: string;
  languages?: string[];
  certifications?: string[];
  availability?: string;
};

export async function fetchMyExpertProfile() {
  return req<ApiExpert | null>("/api/experts/me");
}

export async function upsertMyExpertProfile(p: ExpertProfileInput) {
  return req<ApiExpert>("/api/experts/me", { method: "POST", body: JSON.stringify(p) });
}

// ================= Auth =================
export type AuthUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  provider: string;
  role: string;
};

type AuthResp = { session_token: string; user: AuthUser };

export async function apiRegister(email: string, password: string, name: string, role: "client" | "expert" = "client") {
  return req<AuthResp>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name, role }),
  });
}

export async function apiLogin(email: string, password: string) {
  return req<AuthResp>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiGoogleSession(session_id: string) {
  return req<AuthResp>("/api/auth/google-session", {
    method: "POST",
    body: JSON.stringify({ session_id }),
  });
}

export async function apiMe(): Promise<AuthUser | null> {
  try {
    return await req<AuthUser>("/api/auth/me");
  } catch {
    return null;
  }
}

export async function apiLogout() {
  await req<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function apiRequestPasswordReset(email: string) {
  return req<{ ok: boolean }>("/api/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function apiConfirmPasswordReset(token: string, password: string) {
  return req<{ ok: boolean }>("/api/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

// ================= Contact =================
export type ContactInput = {
  name: string;
  email: string;
  company?: string;
  topic: "general" | "bench" | "apply" | "press";
  message: string;
};

export async function submitContact(input: ContactInput) {
  return req<{ id: string }>("/api/contact", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ================= Briefs & Proposals =================
export type Brief = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  required_skills: string[];
  budget_min: number;
  budget_max: number;
  currency: string;
  engagement_type: string;
  duration_weeks: number;
  remote_ok: boolean;
  location: string;
  status: string;
  proposal_count: number;
  created_at: string;
  contact_email?: string | null;
};

export type BriefInput = Omit<Brief, "id" | "user_id" | "status" | "proposal_count" | "created_at" | "contact_email">;

export async function createBrief(p: BriefInput) {
  return req<Brief>("/api/briefs", { method: "POST", body: JSON.stringify(p) });
}
export async function listOpenBriefs(params: { category?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.q) qs.set("q", params.q);
  return req<Brief[]>(`/api/briefs?${qs.toString()}`);
}
export async function listMyBriefs() { return req<Brief[]>("/api/briefs/mine"); }
export async function getBrief(id: string) { return req<Brief>(`/api/briefs/${id}`); }

export type Proposal = {
  id: string;
  brief_id: string;
  expert_user_id: string;
  expert_name: string;
  expert_headline?: string | null;
  expert_image?: string | null;
  cover_letter: string;
  proposed_rate: number;
  rate_type: string;
  estimated_duration_weeks: number;
  status: string;
  created_at: string;
};

export type ProposalInput = {
  cover_letter: string;
  proposed_rate: number;
  rate_type: "hourly" | "fixed";
  estimated_duration_weeks: number;
};

export async function submitProposal(briefId: string, p: ProposalInput) {
  return req<Proposal>(`/api/briefs/${briefId}/proposals`, { method: "POST", body: JSON.stringify(p) });
}
export async function listProposalsForBrief(briefId: string) {
  return req<Proposal[]>(`/api/briefs/${briefId}/proposals`);
}
export async function listMyProposals() { return req<Proposal[]>("/api/proposals/mine"); }
export async function acceptProposal(id: string) { return req<Contract>(`/api/proposals/${id}/accept`, { method: "POST" }); }
export async function rejectProposal(id: string) { return req<{ ok: boolean }>(`/api/proposals/${id}/reject`, { method: "POST" }); }

// ================= Contracts + Milestones + Payments =================
export type Milestone = {
  id: string;
  contract_id: string;
  title: string;
  description?: string;
  amount: number;
  status: string;
  order: number;
  funded_at?: string | null;
  released_at?: string | null;
};

export type Contract = {
  id: string;
  brief_id: string;
  brief_title: string;
  proposal_id: string;
  client_user_id: string;
  expert_user_id: string;
  expert_name: string;
  client_name: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
};

export async function listMyContracts() { return req<Contract[]>("/api/contracts/mine"); }
export async function getContract(id: string) {
  return req<{ contract: Contract; milestones: Milestone[] }>(`/api/contracts/${id}`);
}
export async function createMilestoneCheckout(milestoneId: string) {
  return req<{ url: string; session_id: string }>("/api/payments/checkout/milestone", {
    method: "POST",
    body: JSON.stringify({ milestone_id: milestoneId, origin_url: window.location.origin }),
  });
}
export async function getPaymentStatus(sessionId: string) {
  return req<{ status: string; payment_status: string; amount_total: number; currency: string }>(
    `/api/payments/status/${sessionId}`,
  );
}
export async function submitMilestone(id: string) { return req<{ ok: boolean }>(`/api/milestones/${id}/submit`, { method: "POST" }); }
export async function releaseMilestone(id: string) { return req<{ ok: boolean }>(`/api/milestones/${id}/release`, { method: "POST" }); }

// ================= Messages =================
export type ConversationSummary = {
  id: string;
  brief_id?: string | null;
  brief_title?: string | null;
  other_user_id: string;
  other_user_name: string;
  other_user_image?: string | null;
  last_body?: string | null;
  last_at?: string | null;
  unread: number;
};
export type Message = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  file_id?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_content_type?: string | null;
};

export async function listConversations() { return req<ConversationSummary[]>("/api/conversations/mine"); }
export async function listMessages(convId: string) { return req<Message[]>(`/api/conversations/${convId}/messages`); }
export async function sendMessage(convId: string, body: string, file_id?: string) {
  return req<Message>(`/api/conversations/${convId}/messages`, { method: "POST", body: JSON.stringify({ body, file_id }) });
}

// ================= Admin =================
export type AdminStats = {
  users: number;
  experts: number;
  pending_vetting: number;
  briefs_open: number;
  briefs_awarded: number;
  contracts_active: number;
  milestones_funded: number;
  milestones_released: number;
};

export async function adminStats() { return req<AdminStats>("/api/admin/stats"); }
export async function adminListExperts(verified?: boolean) {
  const qs = verified === undefined ? "" : `?verified=${verified}`;
  return req<ApiExpert[]>(`/api/admin/experts${qs}`);
}
export async function adminVerifyExpert(id: string) { return req<{ ok: boolean }>(`/api/admin/experts/${id}/verify`, { method: "POST" }); }
export async function adminUnverifyExpert(id: string) { return req<{ ok: boolean }>(`/api/admin/experts/${id}/unverify`, { method: "POST" }); }
export async function adminTogglePublish(id: string) { return req<{ ok: boolean }>(`/api/admin/experts/${id}/publish`, { method: "POST" }); }
export async function adminListBriefs() { return req<Brief[]>("/api/admin/briefs"); }

// ================= Notifications =================
export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  entity_id?: string | null;
  read: boolean;
  created_at: string;
};

export async function listNotifications() { return req<Notification[]>("/api/notifications"); }
export async function unreadCount() { return req<{ count: number }>("/api/notifications/unread-count"); }
export async function markNotificationRead(id: string) { return req<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: "POST" }); }
export async function markAllNotificationsRead() { return req<{ ok: boolean }>("/api/notifications/read-all", { method: "POST" }); }

// ================= Files =================
export type FileMeta = {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  owner_user_id: string;
  conversation_id?: string | null;
  contract_id?: string | null;
  milestone_id?: string | null;
  created_at: string;
};

export async function uploadFile(file: File, scope: { conversation_id?: string; contract_id?: string; milestone_id?: string; dispute_id?: string }): Promise<FileMeta> {
  const form = new FormData();
  form.append("file", file);
  if (scope.conversation_id) form.append("conversation_id", scope.conversation_id);
  if (scope.contract_id) form.append("contract_id", scope.contract_id);
  if (scope.milestone_id) form.append("milestone_id", scope.milestone_id);
  if (scope.dispute_id) form.append("dispute_id", scope.dispute_id);
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/files/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Upload failed (${res.status})`);
  }
  return res.json() as Promise<FileMeta>;
}

export function fileDownloadUrl(id: string) {
  return `${import.meta.env.VITE_BACKEND_URL}/api/files/${id}`;
}

// ================= Reviews =================
export type Review = {
  id: string;
  contract_id: string;
  reviewer_user_id: string;
  reviewer_name: string;
  reviewee_user_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

export async function leaveReview(contractId: string, rating: number, comment: string) {
  return req<Review>(`/api/contracts/${contractId}/reviews`, { method: "POST", body: JSON.stringify({ rating, comment }) });
}
export async function getContractReviews(contractId: string) {
  return req<Review[]>(`/api/contracts/${contractId}/reviews`);
}
export async function getExpertReviews(expertId: string) {
  return req<Review[]>(`/api/experts/${expertId}/reviews`);
}

// ================= Disputes =================
export type Dispute = {
  id: string;
  milestone_id: string;
  contract_id: string;
  opened_by_user_id: string;
  opened_by_name: string;
  reason: string;
  status: string;
  resolution?: string | null;
  resolution_action?: string | null;
  resolution_note?: string | null;
  resolved_at?: string | null;
  resolved_by_admin_id?: string | null;
  created_at: string;
};

export async function fileDispute(milestoneId: string, reason: string) {
  return req<Dispute>(`/api/milestones/${milestoneId}/dispute`, { method: "POST", body: JSON.stringify({ reason }) });
}
export async function adminListDisputes(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return req<Dispute[]>(`/api/admin/disputes${qs}`);
}
export async function adminResolveDispute(id: string, action: "release" | "refund", note?: string) {
  return req<Dispute>(`/api/admin/disputes/${id}/resolve`, { method: "POST", body: JSON.stringify({ action, note }) });
}

// Extend Message type with optional file fields
export type MessageAttach = {
  file_id?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_content_type?: string | null;
};

// ================= Dispute thread =================
export type DisputeMessage = {
  id: string;
  dispute_id: string;
  sender_user_id: string;
  sender_name: string;
  sender_role: "client" | "expert" | "admin";
  body: string;
  file_id?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_content_type?: string | null;
  created_at: string;
};

export async function getDispute(id: string) { return req<Dispute>(`/api/disputes/${id}`); }
export async function getDisputeMessages(id: string) { return req<DisputeMessage[]>(`/api/disputes/${id}/messages`); }
export async function postDisputeMessage(id: string, body: string, file_id?: string) {
  return req<DisputeMessage>(`/api/disputes/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, file_id }),
  });
}

export async function getContractDisputes(contractId: string) {
  return req<Dispute[]>(`/api/contracts/${contractId}/disputes`);
}
