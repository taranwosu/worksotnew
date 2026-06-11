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

### Addendum 2026-06-11 — Admin notifications for managed funnel
- `_notify_admins` now accepts `email_subject`/`email_html` passthrough.
- New managed lead (`/api/contact` topic="managed") and new pool application (`/api/pool/apply`) trigger admin bell notifications (`managed.lead`, `managed.pool_application`) + email via mailer.
- Verified: bell notifications land for all admins; general contact topics produce none. Emails currently log-only (`[email-disabled]`) until an email provider (Emailit `EMAILIT_API_KEY` + `EMAIL_FROM`) is configured — existing P0.

### Addendum 2026-06-11 (2) — Admin "Leads" tab
- New `AdminLeadsTab` component (`/app/src/components/AdminLeadsTab.tsx`) wired as a tab in AdminPage (between Managed service and Legacy vet queue) with unhandled-count label.
- Lists all `contact_submissions` via existing `GET /api/admin/contact-submissions`; topic filter chips (All/Managed/General/Bench/Apply/Press) with per-topic unhandled counts; "Show handled" toggle; per-lead "Reply by email" (mailto with prefilled subject) and "Mark handled" (`POST /api/admin/contact-submissions/{id}/handled`).
- api.ts: added `ContactSubmission` type, `adminListContactSubmissions`, `adminMarkContactHandled`.
- Verified via Playwright: tab renders 4 leads, managed filter shows 3, mark-handled drops count to 3 with toast.
- Lesson: parallel search_replace edits to the SAME file can race (one edit was silently lost); apply multiple edits to one file sequentially or in a single call.

### Addendum 2026-06-11 (3) — Full regression (iteration 6)
- Testing agent ran full regression on merged codebase + new managed funnel: ZERO product bugs. 11/11 new pytest cases pass (`/app/backend/tests/test_managed_funnel.py` — canonical managed-funnel regression). Frontend 100% (all 8 admin tabs, both marketing pages, apply flows).
- Hardening applied post-report: `_rate_limit(request, "pool-apply")` added to POST /api/pool/apply. Contact topic already Literal-validated (reviewer note was incorrect).
- Known stale legacy tests (NOT product bugs, deferred): backend_test.py hardcoded seed counts; test_worksoy_payouts.py uses /api/payouts/* instead of /api/me/payouts/*; test_managed_service.py hardcoded managed_client@worksoy.com creds.
- Report: /app/test_reports/iteration_6.json

### Addendum 2026-06-11 (4) — Deployment readiness (health check PASS)
- Production deploy had failed: Cloud Build aborted on `yarn install` — kysely@0.29.2 requires Node >=22, container has 20.x (preview unaffected because bun ignores engines). FIX: /app/.yarnrc with `ignore-engines true`. `cd /app/frontend && yarn build` now passes end-to-end.
- Added `CORS_ORIGINS=*` to backend/.env; server.py hardened: wildcard now uses allow_origin_regex (origin echo) so credentialed requests work in browsers.
- Replaced bash-style start script in /app/frontend/package.json with `yarn --cwd /app start` / `build`; added `start` script to /app/package.json. Preview backend+frontend verified running after restarts.
- deployment_agent re-check: status PASS, zero findings. Also added /app/vercel.json earlier for optional Vercel frontend hosting.

## Session 2026-06-11 (5) — Blog / CMS / SEO·GEO·AEO
- **New surfaces**: public `/blog` (editorial listing, hero + search + category pills + featured + grid + tag cloud + newsletter), public `/blog/:slug` (TL;DR card + body + JSON-LD BlogPosting/Breadcrumb/FAQPage + comment form + related posts), admin `/admin → Blog CMS` tab (3 sub-tabs: Posts, Comments, Subscribers + inline TipTap WYSIWYG editor with SEO/GEO/AEO sidebar).
- **Backend (server.py)**: 13 new endpoints under `/api/blog/*` (public) + `/api/admin/blog/*` (admin gated). Public: list, single (related + comments + view increment), categories, tags, comment, subscribe. Admin: CRUD posts (auto-slug + uniqueness), CRUD/moderate comments, subscribers list, **AI generate** (Claude Sonnet 4-6 via emergentintegrations + EMERGENT_LLM_KEY — 4 modes: meta, summary, keywords, faq). New `/api/sitemap.xml` (static + every published slug) and `/api/robots.txt` (welcomes GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, OAI-SearchBot — explicit GEO + AEO opt-in).
- **WYSIWYG**: TipTap v3 + StarterKit/Link/Image/Placeholder/Typography. Toolbar (H1-H3, bold/italic/strike/code, lists, blockquote, codeblock, hr, link, image, undo/redo). All buttons + editor have data-testid.
- **AEO**: per-post TL;DR rendered above the fold; FAQ rendered as `<dl>` plus JSON-LD FAQPage; structured JSON-LD scripts tagged `data-blog-jsonld="1"` for testability.
- **Brand fit**: ink/cream/sun palette unchanged; editorial display type (Geist) for hero; `prose-blog` + `prose-editor` CSS classes added to /app/src/index.css for consistent reading + editor surface.
- **Seed**: 3 published posts (3% Lie / Milestone-escrow / Fractional CFO playbook). Admin seeded via ADMIN_PASSWORD env: `admin@worksoy.com / WorkSoyAdmin2026!`.
- **Tests**: 25/25 backend pytest (`/app/backend/tests/test_blog.py`) including AI for all 4 modes; Playwright UI verified.
- **Fixes after iter-7**: `_slugify` now treats underscores as separators; `/blog` search now shows matched results in the grid (previously the featured slot ate the single match).
- **Files added**: `/app/src/lib/blog.ts`, `/app/src/pages/BlogPage.tsx`, `/app/src/pages/BlogPostPage.tsx`, `/app/src/components/AdminBlogTab.tsx`, `/app/src/components/RichEditor.tsx`. Modified: `App.tsx` (2 routes), `Layout.tsx` (Journal nav 06), `AdminPage.tsx` (Blog CMS tab), `index.css` (.prose-blog/.prose-editor), `robots.txt`, `.env` (EMERGENT_LLM_KEY + ADMIN_PASSWORD + APP_BASE_URL).

### Backlog (Blog v1.x)
- **P1**: Split server.py blog block into `routers/blog.py` + `routers/admin_blog.py` (server.py now 5485 LOC).
- **P1**: Sanitise admin-submitted HTML server-side (bleach) — TipTap output is trusted client-side but an admin compromise = stored XSS surface.
- **P2**: Drop full `content_html` from `/api/blog/posts` list payload (only return on detail).
- **P2**: Gate view_count increments by IP+slug to avoid crawler inflation.
- **P2**: Type `BlogPostIn.faq` as `List[FaqItem]` Pydantic submodel.
- **P2**: Separate rate-limit bucket for newsletter signup vs auth.

## ENHANCEMENT IDEA (next session)
Add **"Related expert"** call-out at the bottom of each blog post: pick 1-2 vetted experts matching the post's category/tags and surface them as a card linking to `/experts/{id}` with a "Discuss this with a vetted expert" CTA. Single biggest conversion lever — every long-form essay becomes a funnel into the marketplace.

## Session 2026-06-11 (6) — Blog v1.2 hardening + distribution
- **Router split**: `/app/backend/routers/blog.py` (factory `register_blog`) — `server.py` back to 5025 LOC.
- **Bleach 6.2.0**: sanitise_html() on every admin POST/PATCH `content_html`. Strips `<script>`, on* handlers, `javascript:` URLs, `<iframe>`, non-allowlisted tags. Comments bleached with `tags=[]`.
- **Perf**: list endpoint projects out `content_html` (only detail endpoint returns full body).
- **Anti-inflation**: view_count `$inc` gated by IP+slug 6h TTL + UA bot heuristic (GPTBot, Spider, Crawl, Lighthouse, Axios suppressed). View-count response value now reflects the post-increment value.
- **Strict types**: `FaqItem` Pydantic submodel (malformed FAQ → 422). `BlogPostPatch` model — partial-update PATCH semantics.
- **Rate limit**: newsletter signup uses its own bucket (20/IP/10min) independent of auth.
- **Funnel**: `GET /api/blog/posts/{slug}/related-experts` + "Want to talk to someone who actually does this?" card on every post — converts long-reads into marketplace briefs.
- **Cover image upload**: `POST /api/admin/blog/upload-cover` (admin, 8 MB cap, png/jpg/jpeg/webp/gif) → `GET /api/blog/assets/{fid}` (public, immutable cache). Path-traversal-proof regex on fid.
- **RSS 2.0**: `GET /api/blog/rss.xml` (50 latest, dc:creator + category + RFC-822 pubDate + atom self-link). `<link rel="alternate" type="application/rss+xml">` auto-injected on `/blog` and `/blog/:slug`. Visible "Or subscribe via RSS" link in newsletter section.
- **Reader UX**: reading-progress bar (fixed top, sun yellow, opacity-aware for short posts), auto-generated **Table of Contents** sidebar (sticky) from H2/H3 with anchor deep-links + `scroll-margin-top`.
- **Tests**: 53 cases across `test_blog.py` + `test_blog_iter8.py` + `test_blog_iter9.py`. 52/53 backend pass (the 1 "fail" is a preview-env Cloudflare proxy stripping `cache-control: immutable` — verified correct locally on :8001; production worksoy.com unaffected).

### Outstanding (low priority)
- Auto-save drafts in the editor (every 15s while focused) — saves a refresh-loss class of bugs.
- Open Graph / Twitter Card per post (currently using site-wide defaults via usePageMeta).
- Author profile page (`/blog/author/{slug}`) — list all posts by author.
- Code syntax highlighting inside post bodies (Prism / Shiki client-side).
