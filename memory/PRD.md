# WorkSoy — PRD

## Problem
Premium curated marketplace for senior project-based work (accountants, consultants, designers, engineers, compliance, PMs). Clients post a brief and are hand-matched with 3 finalists; experts work on SOW + milestone-escrow engagements.

## Personas
- **Client / Hiring manager** — COO, Head of Finance, Ops lead needing a senior contractor fast
- **Expert** — fractional CFO, ex-MBB consultant, senior designer/engineer, PE, compliance specialist
- **Admin / Matcher** — WorkSoy staff vetting experts and shortlisting briefs

## Tech
- Frontend: React 19 + Vite + TypeScript + TanStack Router + Tailwind v4 (Ink/Cream/Sun editorial design)
- Backend: FastAPI + MongoDB (motor)
- Auth: JWT (email/password) + Emergent-managed Google OAuth
- Supervisor-managed (backend on :8001, frontend on :3000)

## Status (Apr 2026)

### ✅ Implemented
- Editorial redesign (Ink/Cream/Sun) — Home, Experts directory, Expert detail, How It Works, Pricing, For Experts, Contact, Sign in/up, Onboarding, Post a brief, Dashboard shell
- FastAPI + MongoDB backend scaffolded (`/app/backend/`) — `/api/health`, `/api/auth/*`, `/api/experts*`
- JWT email/password auth with `session_token` cookie + Bearer header
- Emergent Google OAuth flow (`#session_id=` handled in AuthProvider)
- 25 seeded experts across 6 categories with randomuser.me portraits
- Experts page, Expert detail page, Home featured, For experts marquee — all on live API
- AuthProvider context replaces the old Better Auth + Convex stack
- Signin → /dashboard redirect works (setUser fires before navigate, DashboardPage guards redirect via useEffect)
- User avatar menu in nav with Sign out (data-testid: user-menu-trigger, user-menu-signout)
- Supervisor-compatible `/app/frontend` wrapper so both services run under supervisor
- Backend pytest suite at `/app/backend/tests/backend_test.py` — 14/14 passing

### 🚧 Not yet built (in order)
**P0 (next)**
- Proposal submission + review UI (schema and APIs TBD)
- Stripe escrow + milestone payouts (test key `sk_test_emergent` in pod)
- Admin vetting queue + separate `/admin` login (own credentials)
- Wire Dashboard / Messages / Contracts / Project Workspace / Onboarding / Post a Brief to FastAPI (currently still Convex shells)

**P1**
- Notifications (email + in-app)
- Search/filter endpoint improvements (rate bands, location)
- Dispute resolution, rework flow, invoicing/1099s
- Booking/kickoff calls

**P2**
- Time tracking, team accounts, referral program, expert analytics, saved searches, blog

## APIs (live)
- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/google-session`
- `GET /api/auth/me` · `POST /api/auth/logout`
- `GET /api/experts?q=&category=&sort=` · `GET /api/experts/categories` · `GET /api/experts/{id}`
- `GET /api/health`

## Models (Mongo)
- `users { user_id, email, name, picture, provider, role, password_hash?, created_at }`
- `user_sessions { user_id, session_token, expires_at, created_at }`
- `experts { id, name, headline, category, specialties[], location, hourlyRate, rating, reviewCount, availability, topRated, verified, image, bio, yearsExperience, languages[], certifications[], isPublished, created_at }`
