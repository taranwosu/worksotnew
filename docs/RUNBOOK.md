# WorkSoy Operations Runbook

Owner: Operations · Last reviewed: 2026-04-27

This runbook covers the routine operational tasks an on-call engineer is
expected to perform. Treat each section as the first place you look when
the matching scenario occurs.

---

## 1. Database backups (MongoDB)

WorkSoy stores all primary data — users, briefs, proposals, contracts,
milestones, payments, messages, files metadata — in a single MongoDB
database (`DB_NAME`). Loss of this database is a P0.

### Daily snapshot

Run every 24 hours from a host with `mongodump` installed and network
access to the cluster:

```bash
TS=$(date -u +%Y-%m-%dT%H-%M-%SZ)
mongodump \
  --uri "$MONGO_URL" \
  --db "$DB_NAME" \
  --gzip \
  --archive=/var/backups/worksoy/${TS}.archive.gz
aws s3 cp /var/backups/worksoy/${TS}.archive.gz \
  s3://worksoy-backups/mongo/${TS}.archive.gz \
  --storage-class STANDARD_IA
```

Retention:

- Daily snapshots: keep 14 days in S3 STANDARD_IA.
- Weekly (Sunday) snapshots: keep 90 days in S3 GLACIER.
- Off-cluster: at least one copy in a different cloud region.

### Restoring a snapshot

```bash
# 1. Pull the archive locally
aws s3 cp s3://worksoy-backups/mongo/<timestamp>.archive.gz .

# 2. Restore into a recovery database first; never overwrite prod blindly
mongorestore \
  --uri "$MONGO_URL" \
  --gzip \
  --archive=<timestamp>.archive.gz \
  --nsFrom="${DB_NAME}.*" \
  --nsTo="${DB_NAME}_recovery.*"

# 3. Verify counts and a few docs against prod, then either:
#    a) point the app at <DB_NAME>_recovery, or
#    b) drop and rename: db.dropDatabase() on prod then renameCollection.
```

Smoke test after restore: `GET /api/health`, sign in as a known account,
list briefs, open a contract.

### Files & uploads

Contract / message / dispute attachments live on local disk under
`UPLOADS_DIR` (default `/app/backend/uploads`). Mirror that directory to
S3 nightly:

```bash
aws s3 sync "$UPLOADS_DIR" s3://worksoy-uploads/ --delete
```

If you restore the database, restore the matching uploads timestamp too
or expect file-not-found on older messages.

---

## 2. Secret rotation

| Secret | When to rotate | Steps |
| --- | --- | --- |
| `JWT_SECRET` | Annually, or after any suspected leak | Change env, redeploy. **All sessions are invalidated** — users must sign in again. |
| `ADMIN_PASSWORD` | After any operator off-boarding | Change env, redeploy, then sign in to `/admin/login` and overwrite the seeded user's password from the admin panel. |
| `STRIPE_API_KEY` | When Stripe rotates or after leak | Roll in Stripe dashboard, update env, redeploy. Webhook secret is separate — rotate together. |
| `SENDGRID_API_KEY` | Annually or after leak | Generate new key with Mail-Send scope only, rotate, delete old. |
| `MONGO_URL` | When DB credentials change | Update env, redeploy. Consider reissuing user passwords if root credential leaked. |

Never store secrets in source. The CI pipeline (`.github/workflows/ci.yml`)
fails any commit that hardcodes `ADMIN_PASSWORD` or commits a real `.env`.

---

## 3. Stripe payment incidents

### Symptom: client paid, milestone still says "pending"

1. Check the relevant `payment_transactions` doc:
   ```js
   db.payment_transactions.findOne({ session_id: "<id>" })
   ```
2. Check `webhook_events` for the matching event id. If absent, the
   webhook never fired or never reached us — replay it from the Stripe
   dashboard (`Developers → Webhooks → resend`).
3. After successful re-delivery, confirm the milestone moved to
   `funded`. If it didn't, check server logs for
   `stripe webhook signature/parse error` or `unknown_session`.
4. As a last resort, manually reconcile:
   ```js
   db.milestones.updateOne(
     { id: "<milestone_id>", status: "pending" },
     { $set: { status: "funded", funded_at: new Date() } }
   );
   ```
   Always prefer webhook replay over manual writes — replay leaves an
   audit trail.

### Symptom: 400s flooding `/api/webhook/stripe`

Likely a signature mismatch — confirm Stripe's webhook secret matches
the one configured for the `emergentintegrations` SDK. A 400 here is
intentional: it tells Stripe to retry rather than silently swallowing the
event.

---

## 4. Auth incidents

- **Suspected credential stuffing** — `429` rate from `/api/auth/login` in
  logs. Tighten via env: drop `AUTH_RATE_LIMIT_MAX_ATTEMPTS` to 3 and
  bump `AUTH_RATE_LIMIT_WINDOW_SECONDS` to 1800.
- **User locked out** — they hit the rate limit. The window resets
  automatically; do not bypass the limit. If urgent, ask them to wait or
  reset the password (resets are not rate-limited at the same bucket).
- **Lost password** — direct to `/forgot-password`. If email isn't
  configured (dev/staging), the reset link is logged at `INFO` with
  prefix `[password-reset] no email provider — link=…`.

---

## 5. Email deliverability

- All transactional mail goes through the configured provider
  (`SENDGRID_API_KEY` preferred, SMTP fallback). Inspect SendGrid Activity
  for bounces, complaints, and blocks.
- The mailer never raises on failure — it logs and returns False. Look
  for `email send failed` and `sendgrid rejected` lines in server logs.
- If a domain is blocking us, check SPF/DKIM/DMARC for the
  `EMAIL_FROM` domain.

---

## 6. Deploys & rollback

- Deploys ship from `main`. Hotfixes go via PR; never push directly.
- Rollback = redeploy the previous tag/commit. Database migrations are
  additive (new collections / indexes only), so a rollback is safe as
  long as nothing newer has written to a new collection. If it has,
  decide between:
  - Forward-fix on top of the new schema, or
  - Backup → restore the pre-deploy snapshot (see §1).

---

## 7. Useful queries

```js
// Open disputes needing admin review
db.disputes.find({ status: "open" }).sort({ created_at: 1 });

// Stuck milestones (paid but not funded — should be empty)
db.payment_transactions.find({ payment_status: "paid" }).forEach(t => {
  const m = db.milestones.findOne({ id: t.milestone_id });
  if (m && m.status !== "funded") printjson({ tx: t.session_id, ms: m.id });
});

// New contact submissions in last 24h
db.contact_submissions.find({
  created_at: { $gte: new Date(Date.now() - 86400_000) }
});

// Users who signed up but never created a brief or proposal
db.users.find({}).forEach(u => {
  const briefs = db.briefs.countDocuments({ user_id: u.user_id });
  const props = db.proposals.countDocuments({ expert_user_id: u.user_id });
  if (briefs === 0 && props === 0) print(u.user_id, u.email);
});
```

---

## 8. Escalation

- P0 (data loss, payments down, auth broken): page on-call SRE.
- P1 (degraded but limping): file an incident, post in `#worksoy-ops`.
- P2 (cosmetic): open a GitHub issue.
