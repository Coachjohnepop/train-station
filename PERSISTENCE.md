# Persistence model (Stripe era)

## Principle (non-negotiable)

**Always use PostgreSQL (Prisma) for durable app data** — programs, workouts, members, **measurements / check-ins**, enrollments, SMS, payments, chat, coach settings, analytics, audit logs, **and notifications**.

- **Any new module or data element:** schema + migration first; API reads/writes Prisma. **No** product state that only lives in JSON, Blob maps, or the browser.
- **Prod / real multi-user:** database only. Blob/JSON facades exist only while migrating legacy stores.
- **Do not add new JSON- or Blob-only stores.** New tables + migrations instead.
- **Object storage (Blob)** is fine for **binary media** (images, short videos); **rows that point at them live in the DB** (e.g. `UserMeasurement.photoUrl`, `MemberProfile.beforePhotoUrl`).
- **Seed / `*.dev.json`:** snapshots for shipping content with git — not the runtime source of truth when DB is configured.
- **Workouts:** Postgres only when the database is configured. Do not read or write `demo/seed-data.json` / schedule-override blobs for live catalog or member Today.
- **Measurements:** `UserMeasurement` (each check-in + now photo URL); originals derived from history; identity extras on `MemberProfile` / `User`.
- **Notifications (email / push / SMS):** must leave a row in Postgres when we try to send.
  - SMS → `SmsLog` (+ `SmsDeliveryEvent`)
  - Email + web push → `OutboundNotification`
  - In-app Messages → `CoachChatMessage` / `CoachChatThread`
  - Do **not** treat Resend dashboard or server logs as the system of record.

If a coach or member would lose work after a redeploy, it must be in Postgres.

**Also:** **Never hard-delete accounts or payment-related data during testing.** Hide test users instead so Stripe customer IDs, subscriptions, enrollments, and commission ledger entries keep valid foreign keys.

## Demo vs database

| `DATABASE_URL` / `POSTGRES_PRISMA_URL` | Mode | Where saves go |
|----------------------------------------|------|----------------|
| unset, `dummy`, or placeholder only | **Demo (local fallback only)** | `prisma/*.dev.json` locally; Vercel Blob only if no Postgres — **not for real coach content** |
| Real Supabase / Postgres URL | **Database (required for prod)** | Prisma → PostgreSQL |

`resolveDatabaseUrl()` skips dummy `DATABASE_URL` when a real `POSTGRES_PRISMA_URL` is present (common with Vercel env pulls).

**Runtime check:** `GET /api/admin/demo-persistence` — returns `databaseConfigured`, catalog mode, and per-store blob migration phase in `migration`.

## Blob → Postgres migration (2026)

Fifteen JSON blob stores are migrating to Postgres. Facades in `src/lib/*-store.ts` route to DB when `isDatabaseConfigured()` is true (same as non-demo catalog mode).

| Store | Postgres tables | Import alias |
|-------|-----------------|--------------|
| registered-accounts | `User` | `auth` |
| member-profiles | `MemberProfile` | `profiles` |
| oauth-identities | `OAuthIdentity` | `oauth` |
| password-reset-tokens | `PasswordResetToken` | `reset-tokens` |
| sms-workouts | `Workout` (source=sms) | `sms` |
| coach-chat | `CoachChatThread`, `CoachChatMessage` | `coach-chat` |
| live-workout-sessions | `LiveWorkoutSession` | `live-sessions` |
| coach-settings | `CoachSettings` | `coach-settings` |
| member-coach-prefs | `MemberCoachPrefs` | `coach-prefs` |
| commission-partners | `CommissionPartner` | `partners` |
| commission-ledger | `CommissionPayout`, `CommissionPayoutLine` | `ledger` |
| referral-codes | `ReferralCode` | `referrals` |
| stripe-webhook-events | `StripeWebhookEvent` | `webhooks` |
| waitlist | `WaitlistEntry` | `waitlist` |
| custom-training-offers | `CustomTrainingOffer` | `offers` |

**One-time backfill (idempotent):**

```bash
npm run db:import-blob-stores:all
# or per store:
npm run db:import-blob-stores -- --stores=auth,profiles,sms
```

Phased cutover for auth/profiles uses `BLOB_MIGRATION_<STORE>_READ/WRITE` env vars (see `DEPLOY.md`). SMS, chat, live sessions, and Tier 3 stores use Postgres whenever the database is configured.

## User visibility (soft-hide)

- **Hide** (admin Users → Hide, or `DELETE /api/users/:id`): sets `hidden=true`, blocks sign-in, removes from default list.
- **Restore** (`PATCH /api/users/:id` with `{ "hidden": false }`): reverses hide.
- **Show hidden** toggle on admin Users passes `?includeHidden=true`.

### Storage by mode

| Field | Demo (managed users) | Demo (seed roster) | Database |
|-------|----------------------|--------------------|----------|
| `hidden` | `demo/admin-managed-users.json` | `demo/hidden-seed-user-ids.json` | `User.hidden` |
| Sign-in block | `registered-accounts.json` → `hidden: true` | removed from list only | `User.hidden` + registered mirror |

Hard deletes are deprecated for users.

## Ops scripts

| Task | Command |
|------|---------|
| Set password (Postgres + blob dual-write) | `npm run set-account-password -- <email> '<password>'` |
| Migration loop smoke | `npm run test:blob-migration-loop` |
| Full blob backfill | `npm run db:import-blob-stores:all` |

Deprecated: `scripts/set-account-password-blob.mjs` (blob-only) — use `set-account-password.mjs`.

## Stripe checklist

1. Set real `DATABASE_URL` + `DIRECT_URL` on Vercel production (see `DEPLOY.md` Supabase section).
2. Run `npm run db:import-blob-stores:all` once after deploy.
3. Create test members via admin or signup; **hide** when done — do not delete.
4. Stripe webhooks and `Subscription` rows reference `User.id` — hiding preserves those rows.

## Local dev

```bash
# Demo (default) — file + optional blob
DATABASE_URL=dummy npm run dev

# Real DB — migrations + durable users
DATABASE_URL=postgresql://... npx prisma migrate deploy
```