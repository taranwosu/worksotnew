# WorkSoy — PRD

## Problem
Premium curated marketplace for senior project-based work (accountants, consultants, designers, engineers, compliance, PMs). Clients post a brief → expert proposals → matched → contract with milestone escrow (Stripe test mode) → messages → released payments.

## Personas
- **Client / Hiring manager** — COO, Head of Finance, Ops lead needing a senior contractor fast
- **Expert** — fractional CFO, ex-MBB consultant, senior designer/engineer, PE, compliance specialist
- **Admin / Matcher** — WorkSoy staff; vetting experts, auditing briefs, monitoring contract flow via /admin

## Tech
- Frontend: React 19 + Vite + TypeScript + TanStack Router + Tailwind v4 (Ink/Cream/Sun editorial design)
- Backend: FastAPI + MongoDB (motor) — single `server.py` (~1000 LOC, to be split into routers later)
- Auth: JWT (email/password) + Emergent-managed Google OAuth
- Payments: Stripe Checkout via `emergentintegrations.payments.stripe.checkout` (sk_test_emergent)
- Supervisor-managed (backend on :8001, frontend on :3000)

## Status (Apr 2026 — iteration 2 complete)

### ✅ Implemented
- Editorial redesign (Ink/Cream/Sun) across all public pages
- FastAPI + MongoDB backend — **30+ endpoints** across auth, experts, briefs, proposals, contracts, milestones, payments, messages, admin
- JWT email/password auth with `session_token` cookie + Bearer header
- Emergent Google OAuth flow
- 25 seeded experts across 6 categories (3 currently unverified for vetting queue demo)
- Seeded admin user `admin@worksoy.com` on backend startup
- **Hiring loop**: Post brief → browse open briefs → submit proposal → accept → contract (auto-creates 25%/75% milestones + conversation)
- **Stripe escrow**: Client funds milestone via Stripe Checkout → webhook + polling marks milestone `funded` → expert marks `submitted` → client `releases` → payout
  - Graceful fallback when Stripe can't resolve a proxy session_id (returns cached tx state instead of 500)
- **Messages**: 1:1 conversation per contract with unread counts, sender bubbles, auto-scroll
- **Admin console**: separate /admin/login + /admin dashboard with stats, vetting queue (verify/unverify), all experts, briefs list, sign out
- All legacy Convex-wired pages (Dashboard, PostRequest, ExpertOnboarding, Messages, Contract, ProjectWorkspace) migrated to FastAPI
- Convex package removed from runtime (main.tsx no longer wraps ConvexProvider; legacy convex/_generated imports isolated in stubbed components)

### 🚧 Not yet built
**P1**
- Email + in-app notifications (new message, proposal, milestone events)
- File uploads on contracts/messages
- Review & rating system post-contract
- Admin side notes / full audit log
- Split `server.py` into routers (auth/briefs/proposals/contracts/payments/messages/admin)
- Gate `VITE_CONVEX_URL` requirement fully (legacy convex/_generated imports in stubs)
- Dispute resolution flow + rework guarantee
- Invoice / 1099 generation

**P2**
- Time tracking, team accounts, referral program, expert analytics, saved searches, blog

## APIs (live)
**Auth** — `POST /api/auth/{register,login,google-session,logout}` · `GET /api/auth/me`
**Experts** — `GET /api/experts[?q,category,sort]` · `GET /api/experts/categories` · `GET /api/experts/{id}` · `GET/POST /api/experts/me`
**Briefs** — `POST/GET /api/briefs` · `GET /api/briefs/mine` · `GET /api/briefs/{id}` · `POST /api/briefs/{id}/proposals` · `GET /api/briefs/{id}/proposals`
**Proposals** — `GET /api/proposals/mine` · `POST /api/proposals/{id}/accept` · `POST /api/proposals/{id}/reject`
**Contracts + Milestones** — `GET /api/contracts/mine` · `GET /api/contracts/{id}` · `POST /api/milestones/{id}/submit` · `POST /api/milestones/{id}/release`
**Payments (Stripe)** — `POST /api/payments/checkout/milestone` · `GET /api/payments/status/{session_id}` · `POST /api/webhook/stripe`
**Messages** — `GET /api/conversations/mine` · `GET/POST /api/conversations/{id}/messages`
**Admin** — `GET /api/admin/stats` · `GET /api/admin/experts` · `POST /api/admin/experts/{id}/{verify,unverify,publish}` · `GET /api/admin/briefs`

## Models (Mongo)
`users`, `user_sessions`, `experts`, `briefs`, `proposals`, `contracts`, `milestones`, `conversations`, `messages`, `payment_transactions`
