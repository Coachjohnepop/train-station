# Deploy The Train Station (GitHub + Supabase + Vercel)

You handle logins in the browsers / CLIs when prompted. I (the agent) will run the terminal commands, edit configs, and test.

We stop before any DNS / custom domain changes.

## 0. Prerequisites (you have these)
- GitHub account
- Supabase account + new project ready to create
- Vercel account
- This repo folder: `projects/train-station`

Current local dev still works with sqlite in spirit, but we have switched the app to Postgres via Supabase for prod.

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
- `npm run db:seed` to reset demo data.
- `npm run db:studio` to browse the live Supabase tables.

## Rollback note
The old `dev.db` sqlite file is still in the folder (gitignored). If you ever need to go back temporarily, we can restore the old prisma.ts + schema + reinstall the sqlite adapter packages.

## Questions?
Paste the Supabase strings when you have created the project and copied them. I'll take it from there and walk you through GitHub + Vercel.

Let's get your customers on a real URL!
