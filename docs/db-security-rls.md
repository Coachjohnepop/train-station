# Postgres RLS — what we do now vs later

**Date:** 2026-09-19  
**Live:** Supabase `train-station-catalog`. App = Prisma as `postgres`. No Supabase Auth.

## Do not FORCE RLS this weekend

`postgres` is **not** a superuser here (`rolsuper=false`). It still **bypasses RLS** because it **owns the tables**, unless we `FORCE ROW LEVEL SECURITY`.

Prisma uses that owner role. **FORCE RLS with no owner-safe policies would 403 the whole site.**

Ship FORCE only after:

1. A dedicated app role (`trainstation_app`) **or** owner policies that allow `current_user = 'postgres'`.
2. Per-request `SET LOCAL app.user_id` / `app.role` from the Next.js session (transaction-mode pool).
3. A staging pass that hits member Today, coach calendar, and admin money.

Until then: **ENABLE RLS + deny `anon`/`authenticated` + keep grants revoked.** Prisma unchanged.

## Layer 1 (now) — public API roles

PostgREST talks as `anon` / `authenticated`. We already **REVOKE** all table grants. Explicit policies are belt-and-suspenders if someone re-GRANTs:

| Role | Policy |
|------|--------|
| `anon` | `USING (false) WITH CHECK (false)` on every public table |
| `authenticated` | same — we do not use Supabase Auth JWTs |
| `service_role` | leave default bypass (dashboard/webhooks if ever used) |
| `postgres` (Prisma) | no FORCE → still full access |

Re-applied by `npm run db:lockdown-postgrest` after migrate.

## Layer 2 (next, before FORCE) — request identity

Set once per request, after cookie session is known:

```sql
SELECT set_config('app.user_id', $1, true);
SELECT set_config('app.role', $2, true);  -- MEMBER | INSTRUCTOR | ADMIN | PLATFORM_ADMIN
```

Helper:

```sql
current_setting('app.user_id', true)
current_setting('app.role', true) IN ('ADMIN','INSTRUCTOR','PLATFORM_ADMIN')
```

## Layer 3 (smart policies — write these, don’t FORCE yet)

**Public catalog (optional read-only later):** `Program`, `Exercise`, `Equipment` — `FOR SELECT TO authenticated USING (true)` only if we ever open PostgREST. Not needed while Prisma is the only client.

**Member owns their row** (`USING (userId = current_setting('app.user_id', true))`):

- `MemberProfile`, `WorkoutLog`, `ExercisePerformance`, `LiveWorkoutSession`
- `ProgramEnrollment`, `Booking`, `UserEquipment`, `UserMeasurement`
- `GamificationEvent`, `GamificationSeasonScore`, `GamificationPromo`
- `WebPushSubscription`, `MemberShoppingList` (+ items via list)
- `Byow*` where `ownerUserId` / `userId` matches

**Coach / admin sees training data** (`app.role` in staff):

- Same member tables: `USING (staff()) OR userId = app.user_id`
- `CoachTodaySession`, `CoachChatThread`, `CoachChatMessage`
- `LiveClassZoomDay`, `CoachZoomOAuth` (own email / staff)
- Catalog write: `Program*`, `Workout*`, `Exercise*` — staff only

**Never via PostgREST / never for MEMBER:**

- `User.passwordHash` (prefer a view without the hash if we ever expose `User`)
- `SmsLog`, `OutboundNotification`, `AuditEvent`
- `CommissionPartner`, `CommissionPayout*`, `MoneyDeskSettings`
- `FactSubscriptionPayment`, `Acct*`, Stripe webhook payloads
- `AnalyticsEvent` (staff only; contains paths + landingVariant)

**Insert-only public (only if we open a waitlist form without Prisma):**

- `WaitlistEntry`: `FOR INSERT TO anon WITH CHECK (true)` — still better to keep Prisma-only.

## Workflow tightness (same weekend)

| Change | Status |
|--------|--------|
| `ProgramEnrollment` `(userId, programId)` unique + indexes | migrating now |
| GIN on `CoachTodaySession.userIds` | migrating now |
| Explicit deny policies for anon/authenticated | lockdown script |
| `userIds[]` → `CoachTodaySessionMember` join table | **not this weekend** — needs Today/SMS write path |
| Analytics 90-day prune | next, when `AnalyticsEvent` is the growth table |
| FORCE RLS | after Layer 2 is in the request path |

## If we get paged next week

1. Confirm lockdown CHECK: `rls_on = tables`, `leftover_grants = 0`, `deny_policies > 0`.
2. Do **not** FORCE RLS as a panic switch.
3. Rotate `DATABASE_URL` if it leaked; that string is the real vault.
