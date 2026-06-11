# WorkSoy — Test Credentials

These accounts are seeded on every backend boot via `ensure_admin_seeded()` (env-driven) and the `seed.py` script for experts. Update this file whenever any auth credential is changed.

## Admin
- Email: `admin@worksoy.com`
- Password: `WorkSoy!Admin2026`
- Source of truth: `/app/backend/.env` → `ADMIN_EMAIL`, `ADMIN_PASSWORD`

## Pre-existing test user (vetting in progress)
- Email: `vetexpert1@worksoy.com`
- Password: `Passw0rd!`
- Role: expert (profile created, vetting stage = `language_personality`)

## Notes for testing agent
- Register a **fresh** expert via POST `/api/auth/register` → then POST `/api/experts/me` to seed a profile → vetting application auto-starts at `language_personality`.
- Register a **fresh** client via POST `/api/auth/register` with `role: "client"` to test shortlists + saved searches.
- Admin login flow is identical: POST `/api/auth/login` then use returned `session_token` as `Authorization: Bearer …`.
- All 25 seeded experts have `vetting_stage="approved"` and remain visible on `/api/experts`.

## Pool application test accounts (created 2026-06-11)
- `pooltest1@worksoy.com` / `Passw0rd!2026` — has a `reviewed` pool application
- `pooltest2@worksoy.com` / `Passw0rd!2026` — has a `pending` pool application (visible in Admin → Managed service → Pool tab)

## Stale credentials
- `vetexpert1@worksoy.com` / `Passw0rd!` — NO LONGER WORKS post branch-reset (login returns invalid credentials). Register fresh users instead.
