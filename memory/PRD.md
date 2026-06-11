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
- **Expert payouts via Stripe Connect (NEW 2026-06-10)**: releasing a milestone (incl. dispute-release) queues a payout (gross − 15% fee) in the `payouts` collection and transfers the net to the expert's Stripe Express account. Onboarding via `POST /api/me/payouts/onboard` (hosted link), status + auto-flush of queued payouts via `GET /api/me/payouts/status`, history via `GET /api/me/payouts`. Admin: list + retry at `/api/admin/payouts`. Dashboard Earnings card shows setup banner/active chip + payout history; admin console gained a Payouts tab. CI now runs the full backend pytest suite (Mongo service + stubbed emergentintegrations); requirements gained `python-multipart` + `bcrypt==4.3.0` pins (fresh installs broke with bcrypt 5).
- **Public transparency page (NEW 2026-01-25)**: `/process` — hero with live acceptance % highlighted in sun-yellow, four-tile live stats panel, horizontal funnel bars (Applied → 5 stages → Approved/Rejected) with absolute counts, five "You show / We check" cards, promise section, FAQ, dual CTAs. Indexable. Backed by public endpoint `GET /api/process/stats` (no auth, anonymised aggregates only).
- **Navbar polish (NEW 2026-01-25)**: "Vetting" link added at position 02 in the main nav; in-progress experts also see a sun-tinted "Continue vetting" pill (with Clock icon) between "Browse projects" and the bell.
- **Onboarding button fix (NEW 2026-01-25)**: Save button now correctly reads "Save & enter vetting" (was stale "Publish profile" from a missed earlier edit).
- **Vetting gauntlet (2026-01-25)**: state machine on `vetting_applications`, 11 endpoints (5 expert + 6 admin), file uploads on test-project submission, history log per application.
- **Hard gate**: `/api/experts` filters by stage + verified; `/api/briefs/{id}/proposals` returns 403 with "must complete WorkSoy vetting" detail.
- **Earnings + Invoices**: `GET /api/me/earnings` (lifetime_released, in_escrow, pending) and `GET /api/me/invoices` (one per released milestone with platform fee/net split).
- **Shortlists**: `GET/POST/DELETE /api/me/shortlists` with composite-unique index.
- **Saved searches**: full CRUD on `/api/me/saved-searches`.
- **Emailit**: third email provider in `mailer.py`, preferred over SendGrid/SMTP when configured.
- **Frontend pages**: `/vetting` (5-stage wizard), Admin "Vetting pipeline" tab with 6 stage queues, Dashboard Earnings + Invoices + Saved-experts cards, Experts page heart-shortlist overlay, "Vetting status" link in profile menu.

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
2. ~~Wire payout view on the Earnings card~~ — done 2026-06-10 (full Stripe Connect payouts, not just a stub).
3. Calendly integration on the screening stage.

## ENHANCEMENT IDEA (next session)
Add a public, indexable **"Vetting transparency" page** at `/process` showing the 5 stages with real anonymised funnel stats (e.g. "47 of 1,621 applicants passed last quarter"). This is the single highest-leverage SEO + conversion move for a Toptal-style marketplace — Toptal's own "Top 3%" claim is the strongest part of their funnel.

## Session 2026-06-11 — Managed Service marketing funnel
- **`/managed-services`** marketing landing page (hero, 5-step "how the desk runs", benefits band, retainer vs per-task plan cards, FAQ, consultation lead form). Leads POST to `/api/contact` with new topic `"managed"` (added to `ContactIn` Literal + `ContactInput` TS type); visible via `GET /api/admin/contact-submissions`.
- **`/managed-talent`** candidate-side page (hero, why-join band, 4-step path in, quality bar, FAQ, auth-aware apply panel):
  - Signed out → two-ways-in panel (Sign in to opt in `/signin` · New users → standard expert application `/onboarding/expert`).
  - Signed in → opt-in form → `POST /api/pool/apply` (skills, rate_expectation, note) → `pool_applications` collection. Dup-pending and already-member guarded (400). `GET /api/pool/my-application` quiet check.
  - Pool member → "You're in the pool" card → `/pool/tasks`.
- **Admin**: `GET /api/admin/managed/pool/applications[?status=]` + `POST .../{app_id}/status` (pending/reviewed/dismissed). `PoolApplicationsSection` renders pending apps at top of Admin → Managed service → Pool tab with vetted/unvetted tags + review/dismiss actions.
- **Site wiring**: header nav "04 Managed" → /managed-services; footer "For clients" → Managed service, "For experts" → Join the managed pool; cross-links on ManagedServicesPage (contractor → /managed-talent) and ForExpertsPage CTA (→ /managed-talent).
- **BUG FIXED**: `VITE_BACKEND_URL` was missing from `/app/frontend/.env` (vite `envDir` points there; root `.env.local` is ignored and held a stale preview URL). All browser API calls were hitting `…/undefined/api/*` → 404. Added `VITE_BACKEND_URL` alongside `REACT_APP_BACKEND_URL` in `/app/frontend/.env`. Keep both in sync on deploy.
- **Note**: in-memory auth rate limiter (5 attempts/15 min/IP) trips during repeated test logins; restart backend to clear.
- Tested e2e via curl + Playwright: lead form success, talent apply (signed-out panel, signed-in form, pending card), admin pending list + mark reviewed, pool member routes unaffected.
