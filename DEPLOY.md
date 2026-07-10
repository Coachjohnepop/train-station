# Deploy The Train Station (GitHub + Vercel)

## Preview vs production (current workflow — June 2026)

**Production (`main` → https://www.thetrainstation.co)** is frozen at a known-good fallback while we iterate on new features in preview.

| Branch | Deploys to | Use for |
|--------|------------|---------|
| `main` | **Production** only | Stable releases — merge from `preview` when Jeremy/John sign off |
| `preview` | **Vercel Preview URL** (per push) | New features: coach chat, SMS alerts, Go to Today tweaks, etc. |

**Prod fallback tag:** `prod-fallback-2026-06-14` → commit `64807c9` (Go to Today, chat v1, SMS paste, compact dashboard CTA). Roll back prod to this tag if a bad deploy lands on `main`.

### Day-to-day (agents + John)

1. `git checkout preview` — do all feature work here.
2. `git push origin preview` — Vercel builds a **Preview** deployment (check GitHub PR or Vercel dashboard for the `*.vercel.app` URL).
3. Test on the preview URL with Jeremy before merging.
4. When stable: `git checkout main && git merge preview && git push origin main` — that promote goes to production.
5. **Do not** push experimental commits directly to `main` until the preview pass is done.

### Prod troubleshooting (chat + SMS — fallback build)

Verified on live prod (Jun 2026):

- `/admin/chat`, `/member/chat`, `/api/chat/*` — routes up (200).
- SMS **parse** (`POST /api/today/parse`) — works (rule-based, not AI).
- Coach **paste + Build** on `/admin/today` — works; data lives in demo JSON + in-memory on Vercel (new posts may reset on cold start until real DB).

**Needs Vercel env vars for full behavior on any environment:**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | SMS deep links (`https://www.thetrainstation.co`) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Real outbound SMS + inbound webhook at `/api/sms/inbound` |
| `BLOB_READ_WRITE_TOKEN` | Short (≤60s) chat video uploads on Vercel |

Without Twilio, SMS is **simulated** (logged to console / demo logs). Without Blob, use **YouTube links** for video in chat.

**Demo data files to commit with chat/SMS features:** `prisma/coach-chat.dev.json`, `prisma/today-sessions.dev.json`, `prisma/sms-workouts.dev.json`.

---

**Earlier plan (per your note):** Deploy the working demo in ~10 hours. This gets a stable public URL where the member dashboard (including the SMS settings and home equipment widgets), workout logging with green per-set checks, coach live progress buttons, review grids, schedules, etc. all load reliably without dev server churn.

You handle logins in the browsers / CLIs when prompted. I (the agent) will run the terminal commands, edit configs, and test.

We stop before any DNS / custom domain changes.

## Quick demo deploy (recommended right now — the version with all the green checks + coach features)
The app is deliberately built in "demo mode" using only committed files:
- `prisma/seed-data.json` (exercises, workouts, full program schedules)
- `prisma/enrollments.dev.json`, `logs.dev.json`, `user-equipment.dev.json`, `user-settings.dev.json` (live demo user state: progress, setsCompleted for the buttons, equipment toggles, SMS phone + reminder time)

No real database is required for the launch/demo. All the `isDemoMode()` checks now default to the file-backed demo when `DATABASE_URL` is unset or contains "dummy".

### Steps for the ~10h deploy
1. Make sure your latest changes (including any final state in the .dev.json files) are committed and pushed to the GitHub repo for this project.
2. Go to https://vercel.com and "Add New Project" → import the GitHub repo (or I can run `npx vercel` here).
3. (Optional but explicit) In the project settings → Environment Variables, add for **Production, Preview, and Development**:
   - `DATABASE_URL` = `dummy`   (or any string containing "dummy"; this forces demo paths. Because of the recent defaulting changes, it will also work if you set nothing.)
4. Deploy. Vercel will run `npm run build` (which we just verified passes cleanly, including all the /api/equipment, /api/member/reminder-settings, member pages, logging routes, etc.).
5. Visit the new `https://your-project.vercel.app` URL.
6. The /member dashboard should show the equipment and SMS widgets loading instantly (no more spinners from restarts). Test logging sets on a workout — the buttons should turn green with ✓ and persist in review/schedule views. Coach impersonation banner + live checkoff should also work.

After this, every push to **main** auto-deploys **production**. Pushes to **preview** (and other branches) auto-deploy **Preview** URLs only.

The widgets will stay up because there are no Turbopack recompiles, no port 3000/3002 fights, and the fs reads for demo data are instantaneous.

## Later: real Postgres (Supabase) when you want multi-user persistence + real auth
(Everything below is the previous full instructions — we can do this after the deadline deploy if/when you add real users and billing.)

## 0. Prerequisites (you have these)
- GitHub account
- Supabase account + new project ready to create
- Vercel account
- This repo folder: `projects/train-station`

Current local dev still works in demo mode from the committed JSON files (the path we're shipping first). Real DB is for the next phase.

## 1. Supabase (Postgres DB) — do this first

1. Go to https://supabase.com and log in (or create account).
2. Click "New project".
   - Name: `train-station` (or whatever)
   - Database Password: choose a strong one (save it!)
   - Region: closest to you or us-east-1 etc.
   - Free tier is perfect to start.
3. Wait for project to provision (~1 min).
4. In the project, go to **Project Settings** (gear icon) → **Database** → **Connection String** section.
5. You will need **two** strings:
   - **Connection pooling** (the one with "port 6543", pgbouncer, "Transaction mode" recommended) → this becomes `DATABASE_URL`
   - **Direct connection** (port 5432) → this becomes `DIRECT_URL`
6. Copy the full URIs. They look like:
   `postgresql://postgres:YOUR_PASSWORD@db.abcdefghijkl.supabase.co:6543/postgres`
   Replace `YOUR_PASSWORD` if the copy button didn't include it.
   Add `?sslmode=require` at the very end of each if it is missing.
7. Paste both strings here in chat when ready. Example format:

   ```
   DATABASE_URL=postgresql://postgres:xxx@db.ref.supabase.co:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres:xxx@db.ref.supabase.co:5432/postgres
   ```

I will then:
- Write them into `.env` (never committed)
- Run `npm run db:push` (creates the tables from schema on your Supabase)
- Run `npm run db:seed` (imports the 100+ exercises, 31 workouts, full 28-day Adult schedule + other programs + demo users + sample logs/streaks)
- Restart the local dev server so member/admin pages work against the real DB
- Verify a couple pages load without 500s and that the schedule looks like what you had locally.

(If you ever want a fresh reset: I can run `npx prisma db push --force-reset` then reseed.)

## 2. Git + GitHub

We already have a local git repo with the app + these publishing changes.

When you are ready:

- Run `gh auth login` in your terminal (or I can trigger it) — GitHub CLI will open browser for you to authorize.
- Or manually: create a **new empty repo** on github.com (e.g. `yourname/train-station`), do **NOT** add README/license on creation.

Then tell me "github ready" (or paste the repo URL).

I will:
- `git remote add origin git@github.com:you/train-station.git` (or https)
- `git add .`
- `git commit -m "chore: production stack (Supabase postgres, vercel-ready, data preserved)"` (if not already)
- `git branch -M main`
- `git push -u origin main`

All your current code, images (logo + hero splashes), the full seeded content, admin tools, enrollment, logging etc. go up.

## 3. Vercel

1. Log into https://vercel.com (or `npx vercel login` — it will prompt browser).
2. (Optional but nice) Install the Vercel GitHub app if it asks, so it can see the repo you just pushed.

Then say "vercel ready" or "deploy".

I will:
- Run `npx vercel` (or `vercel --prod`) from the project folder. It will link the project, detect Next.js.
- Or guide: in Vercel dashboard "Add New Project" → import the GitHub repo.
- Add the Environment Variables in Vercel (Production + Preview + Development):
  - `DATABASE_URL` = your Supabase pooled string (same as above)
  - `DIRECT_URL` = your Supabase direct string
  (Vercel will automatically run `npm run build` which includes `postinstall: prisma generate` + the Next build.)
- Trigger a deploy.
- You will get a `https://train-station-xxx.vercel.app` URL immediately.

After first deploy, every push to main will auto-deploy previews + prod.

## 4. After first successful deploy on Vercel

- Visit the live URL.
- The landing, root splash, member dashboard (enroll in Adult etc), schedule, workout logging (silhouettes, streaks), admin (user management, scheduler) should all work exactly as locally against the real shared DB.
- Demo user: `demo@thetrainstation.co` (no password yet — we are using a fixed "demo-user" id in a few API routes for the free-tier experience; real auth comes later if you want).
- Test enrolling, logging a workout, seeing progress/streak update.

## 5. What we are NOT doing yet (per your request)
- No custom domain / DNS changes (you said you don't have access yet).
- No Stripe / paid enforcement (still "Enroll (free)" everywhere).
- No real user auth / sessions (demo user + prospective instructor flows are there for when you add forms).
- No automatic Supabase Auth integration (future easy add).

## Local development after switch
- Set real `DATABASE_URL` + `DIRECT_URL` in `.env` (or `.env.local`) and run `npm run dev`.
- `npm run db:push` after schema changes.
- `npm run db:seed` to reset demo data (loads the full deliverable content: 101 exercises + 31 workouts + full schedules for Adult/Strength/Boot Camp + demo users + sample streak data).
- `npm run db:export-seed` (after editing via admin) to export current DB content back to `prisma/seed-data.json` — this preserves the data you build as part of the platform deliverable (committed in git). Use this when you customize for a customer so the "base" includes your edits. The seed-data.json is the canonical snapshot of the initial content.
- `npm run db:studio` to browse the live Supabase tables.

## The content / data is part of the deliverable (and how to handle new customers)
- `prisma/seed-data.json` (committed) contains the full original content you built (101 exercises from the ~40 workout files, 31 workouts, detailed 28-day Adult schedule + partial for Strength/Boot Camp, 5 programs, etc.). This is preserved exactly via IDs so sample data, logs, etc. attach.
- It is **editable** via the admin tools (Exercise library, Workout builder, Program scheduler with week copy/clear/assign).
- For a **new customer / fresh platform instance**: 
  - Use `npx prisma db push --force-reset` (or drop tables) then `npm run db:seed` to completely clear custom data and reload the base deliverable content.
  - Or in future, we can add an admin "Factory Reset to Base Content" button that does the truncate + re-import (safe because seed is the golden source).
- After you edit/customize the content for a specific customer, run `npm run db:export-seed` so the updated state becomes the new "base" in the repo (no data loss across deploys, team members, or customer handoffs).
- The demo mode (when using dummy DB URL) also loads from the same seed-data.json so the full detailed schedules, workout names, exercise lists etc. are always visible and consistent even before the real DB is connected.

This ensures the data you invested in building is never lost, is versioned with the code, ships as part of the product, yet the platform remains reusable/cleanable.

## Blob → Postgres migration (per-store rollout)

Production still reads/writes many stores via Vercel Blob JSON (`demo/*.json`). Migration is phased per store using env flags in `src/lib/blob-migration-config.ts`.

| Phase | Read | Write | Meaning |
|-------|------|-------|---------|
| A (default) | `blob` | `blob` | Current prod — blob authoritative |
| B | `blob` | `dual` | Backfill + verify DB writes |
| C | `db_with_blob_fallback` | `dual` | DB authoritative; blob heals stale reads |
| D | `db` | `db` | Cutover complete |

**Env override pattern** (Vercel → Production):

```
BLOB_MIGRATION_<STORE>_READ=blob|db|db_with_blob_fallback
BLOB_MIGRATION_<STORE>_WRITE=blob|db|dual
```

`<STORE>` is the blob slug in `SCREAMING_SNAKE_CASE`, e.g. `member-profiles` → `BLOB_MIGRATION_MEMBER_PROFILES_READ`.

Demo mode (`DATABASE_URL` unset or contains `dummy`) **always** uses blob — migration flags are ignored.

**Rollback:** Set read/write back to `blob` for a store in Vercel env (no redeploy required if config-only).

**Parity checks:** Dual-write facades log `[migration-parity-mismatch]` when blob and DB snapshots diverge (`src/lib/blob-migration-parity.ts`).

**Schema:** PR-1 adds unused Postgres tables; PR-2+ wire store facades. Run `npx prisma migrate deploy` after merging schema PRs.

### One-time blob backfill (after PR-2–9 deploy)

Pull production env locally (`.env.vercel.prod`), then:

```bash
npm run db:import-blob-stores:all
# dry-run first:
npx tsx prisma/import-blob-stores-to-postgres.ts --stores=all --dry-run
```

Import order is FK-safe (auth → profiles → … → offers). Re-running is idempotent.

### Verify migration phase on prod

```bash
# After coach login, or from server:
curl -s https://www.thetrainstation.co/api/admin/demo-persistence | jq .
```

Response includes `databaseConfigured`, `migration` (read/write per store), and `dbBackedStoreCount`.

### Set account password (ops)

```bash
npm run set-account-password -- jeremy@thetrainstation.co 'CoachTest123!'
```

Updates `User.passwordHash` in Postgres when configured; mirrors to blob when `BLOB_MIGRATION_REGISTERED_ACCOUNTS_WRITE=dual`.

### Smoke tests

```bash
npm run test:blob-migration-loop
BASE_URL=https://www.thetrainstation.co npm run test:p0-prod
```

## Rollback note
The old `dev.db` sqlite file is still in the folder (gitignored). If you ever need to go back temporarily, we can restore the old prisma.ts + schema + reinstall the sqlite adapter packages.

## Questions?
Paste the Supabase strings when you have created the project and copied them. I'll take it from there and walk you through GitHub + Vercel.

Let's get your customers on a real URL!
