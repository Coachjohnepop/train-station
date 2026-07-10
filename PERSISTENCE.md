# Persistence model (Stripe era)

## Principle

**Never hard-delete accounts or payment-related data during testing.** Hide test users instead so Stripe customer IDs, subscriptions, enrollments, and commission ledger entries keep valid foreign keys.

## Demo vs database

| `DATABASE_URL` / `POSTGRES_PRISMA_URL` | Mode | Where saves go |
|----------------------------------------|------|----------------|
| unset, `dummy`, or placeholder only | **Demo** | `prisma/*.dev.json` locally; Vercel Blob in preview/prod without Postgres |
| Real Supabase / Postgres URL | **Database** | Prisma → PostgreSQL (durable by default) |

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