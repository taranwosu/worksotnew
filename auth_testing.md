# Auth Testing Playbook (Emergent OAuth + JWT)

## Quick Session Setup (for testing protected routes)

```bash
mongosh --eval "
use('worksoy');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  provider: 'google',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Backend API Tests

```bash
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)

# Register (JWT)
curl -X POST "$API/api/auth/register" -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Passw0rd!","name":"Alice"}'

# Login (JWT)
curl -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Passw0rd!"}'

# Current user (cookie OR Bearer)
curl -X GET "$API/api/auth/me" -H "Authorization: Bearer $TOKEN"

# Logout
curl -X POST "$API/api/auth/logout" -H "Authorization: Bearer $TOKEN"
```

## Browser Test (Playwright)
```javascript
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "your-app.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}]);
await page.goto("https://your-app.com/dashboard");
```

## Checklist
- [ ] user_id custom UUID, `_id` excluded in all queries
- [ ] /api/auth/me works with cookie AND Bearer token
- [ ] Emergent Google OAuth: `#session_id=` handled on landing, cookie set, redirects to /dashboard
- [ ] JWT register/login issues same session_token cookie flow
- [ ] expires_at timezone-aware comparison
