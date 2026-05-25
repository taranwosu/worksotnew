# WorkSoy — PRD

## Problem statement
Build a premium expert marketplace (Toptal-style) with: browseable expert directory, brief posting + proposals, milestone-escrow contracts (Stripe), in-app messaging with attachments, reviews, dispute resolution, admin console, transactional email, and — most distinctively — a **5-stage vetting gauntlet** that hard-gates the public roster so only ~3% of applicants are surfaced to clients.

## Architecture
- **Backend**: FastAPI (Python 3.11) + Motor (async MongoDB) + Stripe + JWT auth + Emergent Google OAuth (Better-Auth flow).
  - Single-file app: `/app/backend/server.py` (~2700 LOC; flagged for future split). Mailer in `/app/backend/mailer.py`. Seed in `/app/backend/seed.py`.
- **Frontend**: Vite + React 19 + TypeScript + TanStack Router + Tailwind 4. Source under `/app/src`. Vite reads env from `/app/frontend/.env` (configured via `envDir`).
- **Storage**: MongoDB (collections: users, experts, briefs, proposals, contracts, milestones, files, conversations, messages, reviews, disputes, notifications, password_resets, **vetting_applications, test_projects, shortlists, saved_searches**).
- **Email**: Emailit (https://emailit.com/docs/) via POST `https://api.emailit.com/v2/emails`; SendGrid + SMTP retained as fallbacks. Mailer no-ops cleanly if `EMAIL_FROM` is unset.
- **Payments**: Stripe milestone escrow (released → invoice). 15% platform fee derived in invoice payload.

## Personas
1. **Client** — posts briefs, reviews proposals, opens contracts, releases milestones, shortlists experts.
2. **Expert** — passes the 5-stage gauntlet, browses open briefs, submits proposals, delivers via milestones, downloads invoices.
3. **Admin** — runs the vetting pipeline (advance/reject/assign-test-project), moderates disputes, manages experts.

## Core requirements (static)
- Public expert directory only shows vetting_stage="approved" experts.
- Only approved experts can submit proposals (hard 403 with vetting-aware error message).
- Stage transitions: `not_started → language_personality → skill_quiz → screening_call → test_project → approved | rejected`.
- Each stage transition fires an in-app notification + transactional email (when Emailit/EMAIL_FROM set).
- 25 seeded experts ship as pre-approved so the marketplace looks alive on day 1.

## What's been implemented (2026-01)
- **Vetting gauntlet (NEW 2026-01-25)**: state machine on `vetting_applications`, 11 endpoints (5 expert + 6 admin), file uploads on test-project submission, history log per application.
- **Hard gate (NEW)**: `/api/experts` filters by stage + verified; `/api/briefs/{id}/proposals` returns 403 with "must complete WorkSoy vetting" detail.
- **Earnings + Invoices (NEW)**: `GET /api/me/earnings` (lifetime_released, in_escrow, pending) and `GET /api/me/invoices` (one per released milestone with platform fee/net split).
- **Shortlists (NEW)**: `GET/POST/DELETE /api/me/shortlists` with composite-unique index.
- **Saved searches (NEW)**: full CRUD on `/api/me/saved-searches`.
- **Emailit (NEW)**: third email provider in `mailer.py`, preferred over SendGrid/SMTP when configured.
- **Frontend pages**: `/vetting` (5-stage wizard with progress strip + per-stage panels + status log + approved/rejected terminal panels), Admin "Vetting pipeline" tab with 6 stage queues + advance/reject controls + ScreeningEditor + AssignTestProjectForm + TestProject reviewer, Dashboard Earnings + Invoices + Saved-experts cards, Experts page heart-shortlist overlay on every card, "Vetting status" link in profile menu, "Continue vetting" banner on dashboard.
- **Pre-existing (kept)**: auth (JWT + Google OAuth), experts directory, brief lifecycle, proposals, milestone escrow, messages w/ files, reviews, disputes, notifications.

## Test status (2026-01-25)
- Backend: **29/29 passing** (`/app/backend/tests/test_worksoy_vetting.py`).
- Frontend: smoke-tested via Playwright — `/vetting` renders, language test submit → advances stage, `/admin` shows pipeline, `/experts` shows 27 cards with shortlist hearts.

## Prioritized backlog
- **P0** (must-have follow-ups)
  - Verify a sender domain at https://app.emailit.com and set `EMAIL_FROM` in `/app/backend/.env` so vetting transactional emails actually deliver (currently logged-only since `EMAIL_FROM` is empty).
- **P1**
  - Calendly/Cal.com link on screening-call stage (deferred per user request).
  - PDF invoice download (currently HTML — print-to-PDF works).
  - Public read-only "vetting transparency" page (process explanation + acceptance rate) to lift conversion on /for-experts.
  - Saved-search → email digest when new matching briefs land.
- **P2**
  - Split `server.py` into routers (vetting, earnings, shortlists, etc.).
  - Single $facet aggregation for `/api/me/earnings` instead of 3 $group queries.
  - Replace N+1 lookups in `/api/admin/vetting/applications` with a $lookup aggregation.

## Next tasks
1. Ask user to verify a sender domain at https://app.emailit.com + set `EMAIL_FROM`.
2. Wire payout view on the Earnings card (bank/connect intent stub).
3. Calendly integration on the screening stage.

## ENHANCEMENT IDEA (next session)
Add a public, indexable **"Vetting transparency" page** at `/process` showing the 5 stages with real anonymised funnel stats (e.g. "47 of 1,621 applicants passed last quarter"). This is the single highest-leverage SEO + conversion move for a Toptal-style marketplace — Toptal's own "Top 3%" claim is the strongest part of their funnel.
