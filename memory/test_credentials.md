# WorkSoy — Test Credentials

## JWT users
| Role | Email | Password |
|---|---|---|
| Client | `alice@worksoy.com` | `Passw0rd!` |
| Expert | `expert1@worksoy.com` | `Passw0rd!` |
| Admin  | `admin@worksoy.com` | `WorkSoy!Admin2026` |

The admin account is seeded automatically on backend startup.

## Admin console
- Login page: `/admin/login`
- Dashboard:  `/admin` (redirects to /admin/login if not authenticated as admin)

## Stripe (test mode)
`STRIPE_API_KEY=sk_test_emergent` is in `/app/backend/.env`. Use any Stripe test card (e.g. `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP) at checkout.

## Quick E2E flow
1. Sign in as Alice (client) → /post-request → submit a brief
2. Sign out → Sign up as a new user with role=`expert` → /onboarding/expert → publish profile → /briefs → send a proposal
3. Sign back in as Alice → /dashboard → open brief → "Accept & open contract"
4. On contract page: "Fund milestone" → Stripe test card → redirected back → milestone status = funded
5. Switch to expert account → "Mark delivered"
6. Switch back to Alice → "Release to expert"

## API helpers

```bash
API=$REACT_APP_BACKEND_URL
curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@worksoy.com","password":"WorkSoy!Admin2026"}'
```
