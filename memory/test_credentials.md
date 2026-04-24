# WorkSoy — Test Credentials

## Test JWT users (email/password)
| Role | Email | Password | Notes |
|---|---|---|---|
| Client | `alice@worksoy.com` | `Passw0rd!` | Seeded via /api/auth/register |

## Google OAuth (Emergent-managed)
Any Google account works through the Emergent auth flow. The user is auto-created on first sign-in with `provider: "google"` and `role: "client"`.

## Admin (not yet seeded — pending iteration)
A separate `/admin` login with its own credentials is planned for the next iteration. No admin accounts exist yet.

## Quick commands

```bash
# Register
curl -X POST "$REACT_APP_BACKEND_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@worksoy.com","password":"Passw0rd!","name":"Alice"}'

# Login (sets cookie + returns session_token)
curl -X POST "$REACT_APP_BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@worksoy.com","password":"Passw0rd!"}'

# Current user
curl "$REACT_APP_BACKEND_URL/api/auth/me" -H "Authorization: Bearer <token>"
```
