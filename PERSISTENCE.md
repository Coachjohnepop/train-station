# Persistence model (Stripe era)

## Principle

**Never hard-delete accounts or payment-related data during testing.** Hide test users instead so Stripe customer IDs, subscriptions, enrollments, and commission ledger entries keep valid foreign keys.

## Demo vs database

| `DATABASE_URL` | Mode | Where saves go |
|----------------|------|----------------|
| unset, `dummy`, or contains `dummy` | **Demo** | `prisma/*.dev.json` locally; Vercel Blob (`TS_BLOB_TOKEN`) in preview/prod without Postgres |
| Real Supabase / Postgres URL | **Database** | Prisma → PostgreSQL (durable by default) |

Check runtime: `GET /api/admin/demo-persistence`

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

## What still uses blob in demo mode

Until migrated to Prisma models:

- Member profiles & payment flags (`member-profiles.json`)
- Commission partners & ledger
- Landing media (Venmo QR, etc.)
- Coach chat, SMS workouts, enrollments progress

With a real `DATABASE_URL`, **users** and core workout/program catalog use Postgres. Payment profile blobs remain on the migration path — plan DB models before going live on Stripe production.

## Stripe checklist

1. Set real `DATABASE_URL` + `DIRECT_URL` on Vercel production (see `DEPLOY.md` Supabase section).
2. Keep `TS_BLOB_TOKEN` on preview for demo-path fallbacks, or migrate remaining blob stores.
3. Create test members via admin or signup; **hide** when done — do not delete.
4. Stripe webhooks and `Subscription` rows reference `User.id` — hiding preserves those rows.

## Local dev

```bash
# Demo (default) — file + optional blob
DATABASE_URL=dummy npm run dev

# Real DB — migrations + durable users
DATABASE_URL=postgresql://... npx prisma migrate deploy
```