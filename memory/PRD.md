# WorkSoy — PRD

## Problem
Premium curated marketplace for senior project-based work (accountants, consultants, designers, engineers, compliance, PMs). End-to-end: brief → proposals → matched hire → contract with milestone escrow → messaging + files → review + dispute resolution.

## Personas
- **Client** — COO, Head of Finance, Ops lead hiring a senior contractor fast
- **Expert** — fractional CFO, ex-MBB consultant, senior designer/engineer, PE, compliance specialist
- **Admin** — WorkSoy operator; vets experts, audits briefs/contracts, resolves disputes

## Tech
- Frontend: React 19 + Vite + TypeScript + TanStack Router + Tailwind v4 (Ink/Cream/Sun editorial design)
- Backend: FastAPI + MongoDB (motor) — single `server.py` (~1500 LOC, to be split into routers)
- Auth: JWT + Emergent-managed Google OAuth
- Payments: Stripe Checkout via `emergentintegrations` (test key `sk_test_emergent`)
- Notifications: in-app (bell + polling every 30s); email = **stubbed** (logs only; Resend wiring deferred)
- File storage: local disk `/app/backend/uploads/` (25MB limit, scope-auth'd)
- Supervisor-managed (backend :8001, frontend :3000)

## Status (Jun 2026 — iteration 4 complete · Pre-Launch Sprint 1 closeout)

### ✅ Implemented (this iteration)
- **401 console noise eliminated**: new silent `/api/auth/session` endpoint + `apiSession()` wrapper; `AuthProvider` no longer throws 401s on public routes
- **All 11 `alert()` / `window.prompt()` calls removed** across MessagesPage, BriefDetailPage, ContractPage and DisputeThread — replaced with sonner `toast.error()` / `toast.success()`
- **DisputeThread admin resolve UX**: inline note textarea + Confirm/Cancel buttons (no native prompt). New testids: `dispute-resolve-{release,refund,note,confirm,cancel}`
- **404 NotFound page** wired into `rootRoute.notFoundComponent` (TanStack Router)
- **Mock testimonials killed**: "Priya Raman" / "Marcus Thompson" / "Elena Marsh" removed from HomePage, SignUpPage, SignInPage; HomePage pull-quote replaced with median-time-to-signature copy
- **JWT secret auto-generated** on first boot if still default
- **`/api/files/upload` content-type allowlist** added
- **CORS fix**: `VITE_BACKEND_URL` repointed to live preview host (was stale)
- **AdminPage Rules-of-Hooks bug** (caught by testing agent): `useState(openDispute)` was declared after an early return — hoisted above the `isPending` guard

### ✅ Previously implemented
- Editorial redesign + 25 seeded experts (3 pending vetting) + seeded admin
- Full hiring loop: post brief → browse → apply → accept → contract with 25%/75% milestones + auto conversation
- Stripe escrow flow: fund milestone → submit → release (contract auto-completes when all milestones released)
- **In-app notifications**: bell + badge + panel with polling; triggers on proposal.new/accepted/rejected, milestone.submitted/released, dispute.opened/resolved, review.received, contract.completed
- **File uploads**: local disk with per-scope auth (conversation / contract / milestone); Paperclip attach in Messages renders file cards with download
- **Reviews** (post-completion only): 1–5★ + comment; one per reviewer per contract; auto-recomputes `rating` and `reviewCount` on expert profile; public on `/experts/{id}/reviews`
- **Disputes with full thread**: Either party can file on a funded/submitted milestone → status becomes `disputed`; **each dispute has a message thread + evidence uploads** (files scoped to `dispute_id`, rendered as download cards); admin resolves inline from the thread via `release` or `refund`; refund inserts a negative audit row in `payment_transactions` with `kind="refund"`, `origin_session_id`, `dispute_id`, `resolved_by_admin_id`; every dispute message also fires `dispute.message` notifications to the other parties + admins
- **Public expert profile** now lists real reviews via `/api/experts/{id}/reviews` (empty state when none)
- **Admin console** with 4 tabs: Vetting queue · All experts · Briefs · Disputes (resolve)
- Graceful Stripe status fallback (cached tx state when proxy session can't be retrieved)
- Sign-in → Dashboard redirect race fixed
- Convex removed from runtime (placeholder provider removed from `main.tsx`)

### 🚧 Deferred / backlog
- Email provider wiring (Resend) — stub logs in place, just needs API key
- `server.py` split into routers (auth/briefs/proposals/contracts/payments/messages/notifications/files/reviews/disputes/admin)
- Invoice / 1099 generation
- Time tracking, team accounts, referral program, expert analytics, saved searches, blog

## APIs (added this iteration)
- `GET /api/notifications` · `GET /api/notifications/unread-count` · `POST /api/notifications/{id}/read` · `POST /api/notifications/read-all`
- `POST /api/files/upload` (multipart) · `GET /api/files/{id}`
- `POST/GET /api/contracts/{id}/reviews` · `GET /api/experts/{id}/reviews`
- `POST /api/milestones/{id}/dispute` · `GET /api/admin/disputes` · `POST /api/admin/disputes/{id}/resolve`

## Models (Mongo) — added
`notifications`, `files`, `reviews`, `disputes` (plus `messages` now carries optional `file_id/file_name/file_size/file_content_type`)
