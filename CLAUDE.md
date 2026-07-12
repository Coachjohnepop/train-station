@AGENTS.md

# Train Station - Claude / Project Context Notes

## WHERE WE LEFT OFF (2026-07-12 evening PT) — take a break

**Status:** Pausing. Resume from this section.

### Shipped on `main` (prod)
- **Exercise soft-archive** (same shelf model as templates/packs): `archivedAt` on `Exercise`, migration `20260712240000_archive_exercises` **already applied on prod**.
  - Commit: `0ac0df5` — Archive shelf for catalog exercises before hard delete
  - Prior: `f71efb6` templates/packs archive; Theme Song / muted speaker music UX commits before that
- **APIs:** `GET /api/exercises?archive=active|archived|all` (default active); `DELETE` soft-archives; `PATCH { action: "restore" }`; `DELETE ?hard=1` only if archived
- **UI:** Admin → Exercises — Archive button + Archive shelf (Restore / Delete forever)
- **Pickers / text-upload matching:** active only; past workouts still resolve archived exercises by id
- **Lib:** `src/lib/catalog-exercise-archive.ts`

### Soak + trail (prod)
- Jeremy **not active** in last 2h when we checked; ran soak marker **`MARSHMALLOW-BADGER`** (script `scripts/marshmallow-badger-soak.mjs`) — **89/89 checks, 2 rounds PASS** (archive/clone/restore/forever-delete for exercises + templates + packs)
- **Coach-only easter-egg trail left for Jeremy** (NOT on member program days — do not put joke warm-ups on live sessions):
  - Active exercise: `MARSHMALLOW-BADGER · toast the shoulders (coach egg)`
  - Archived exercise (shelf demo): `MARSHMALLOW-BADGER · fluff on the archive shelf`
  - Template: `MARSHMALLOW-BADGER · hello Jeremy` · category `marshmallow-badger` · `v_trail`
  - Catalog workout: `MARSHMALLOW-BADGER · coach playground (not on schedule)` with that movement as a light warm-up line
- Earlier funny markers also used this session: `CLONE-PARTY-SOAK`, `LASER-CHICKEN`, `CONFETTI-GOOSE`

### Decision parked
- **Do not** inject MARSHMALLOW-BADGER (or similar) as a warm-up into Jeremy’s live/member-facing created workouts. Coach library / template / archive shelf only.

### Local env notes
- Local `npm run dev` was killed after max runtime (~23h) — restart with `npm run dev` if needed (often :3000 or :3002)
- Branch: **`main`** clean vs origin for code; untracked soak scripts/reports under `scripts/` (optional commit later)
- Prod coach login for soaks: `john@thetrainstation.co` + soak password pattern used in scripts (see clone-party / marshmallow scripts)

### Natural next steps when back
1. See if Jeremy found the trail / used archive shelf; audit with `MINUTES=… npx tsx scripts/jeremy-post-audit-prodtest.mjs`
2. Optional: commit `scripts/marshmallow-badger-soak.mjs` (+ clone-party) for reuse; clean leftover empty catalog shells if any
3. More DEMO_SCRIPT / Jeremy workflow polish; keep publishing **data** (`prisma/seed-data.json` + `*.dev.json`) with code when content changes
4. If Jeremy wants a playground warm-up pattern later: dedicated coach-only / never-enrolled program — not Adult live days

---

## Publish / Deploy Reminder: Include ALL the data we are loading
When we finish testing and get to the publish phase (GitHub push + Vercel deploy per DEPLOY.md, after more end-to-end runs against DEMO_SCRIPT.md):
- **Remember to publish / commit all of the data the app loads**, not just the source code. This is essential for the live version to match the tested experience and will help stabilize things (no missing schedules, empty pasts, blank equipment/SMS, or schedule without green "done" rings).
- Key data files the app (demo mode + seed) loads and that must ship:
  - `prisma/seed-data.json` (the big canonical snapshot: 100+ exercises, 31 workouts, full 28-day Adult **hybrid** program with per-day Gym vs Home options + other programs, John & Steph journey substitutions, sample content, etc.)
  - `prisma/logs.dev.json` (sample past workout logs for the demo user — this is what makes `isThisSessionDone` / `loggedSet.has(wid)` true for specific home/gym options or subs, so the schedule page shows green rings/circles + "✓ You followed..." on completed sessions, plus powers review grids and past-performance silhouettes inside the workout console)
  - `prisma/user-equipment.dev.json` (home equipment inventory — loaded on member dashboard widget + admin per-client views)
  - `prisma/user-settings.dev.json` (SMS reminder settings — loaded on dashboard)
  - `prisma/enrollments.dev.json` (enrollments + current progress for demo user)
  - `prisma/exercises.dev.json` (if present) and any other `*.dev.json` snapshots used by the demo-*.ts libs (demo-enrollments, demo-logs, demo-equipment, demo-workout, member-workout, etc.)
  - `prisma/export-seed-data.ts` + `prisma/seed.ts` (the tools)
- In the publish git step (see DEPLOY.md "2. Git + GitHub" and the "data is part of the deliverable" section):
  - Explicitly `git add prisma/seed-data.json prisma/*.dev.json prisma/export-seed-data.ts` (seed-data.json is usually already tracked but modified; the .dev.json files have historically been ?? untracked).
  - Commit message should note "data preserved" or similar.
  - After any content/schedule/equipment edits via admin, run the export (`npm run db:export-seed` or equivalent) **before** the final publish commit so the committed seed includes the latest state.
- Why this matters for stabilization + testing:
  - The published site (Vercel + Supabase or dummy DB) must have the exact same rich demo data as local testing: hybrid Adult days, pre-existing sample logs (so schedule greens appear immediately), full equipment list, John & Steph subs with floating video, pasts for the review console, etc.
  - Demo mode (`isDemoMode()` in the lib/demo-*.ts files, triggered by DATABASE_URL containing "dummy") and the real-DB seed path both pull from these files for consistency.
  - Without the data files, a fresh deploy can look "empty" (no greens on schedule, no equipment, no sample progress, missing hybrid options or subs) even if the code is perfect.
- Post-publish / for customers: Use `npm run db:seed` or the export flow (detailed in DEPLOY.md) to reset or hand off a full data snapshot. The data is explicitly part of the deliverable.

See:
- DEPLOY.md (full flow + "The content / data is part of the deliverable" section)
- DEMO_SCRIPT.md (the comprehensive test plan that exercises all the data-dependent features: hybrid choices, logging sets with greens, schedule green rings, equipment, subs, past silhouettes, etc.)
- prisma/ directory for the actual files.

This note is here so future steps (or a future session) do not forget the data snapshot step when "we get there."

**June 13 2026 customer (Jeremy) admin review feedback**: The latest recording + transcript is analyzed in `JUN13_CUSTOMER_REVIEW_ACTION_PLAN.md`. Primary pain: exercise name edits and deletes (plus workout exercise remove/edit) made via the admin do not reliably propagate or persist in demo mode because of the split between `exercises.dev.json` / seed-data.json snapshot + limited demo mutation support for workoutExercises. Address P0 items there before further polish or publish. Always commit the json data files after coach content changes.

---

## Coach template / paste model (July 2026 — Jeremy stress-test)
Jeremy builds content by **cloning**, never by shared mutable references:

- **Always clone** on paste (Gym→Home, day→next week, template→day, 28-day pack→program). Source stays intact; edit the copy.
- **Workout template library** (`WorkoutTemplate` + `source: "template"` workouts): promote any workout with **name**, **freeform category**, optional **version** tag (`v_adult`, `vyoungkids`), notes. Categories are **not** limited to adult/athletes — expect yoga, meditation, nutrition/eating, martial arts, dog training, and any future program type. Starter suggestions live in `TEMPLATE_CATEGORY_SUGGESTIONS`; coaches type new categories freely.
- **Tracks:** paste Gym and/or Home (deselect either).
- **Same day next week** and **Copy Gym → Home** on program calendar.
- **Coach note on a workout line** (`WorkoutExercise.notes`) = session cue for members — distinct from library `Exercise.description` / YouTube video.
- **28-day cycle packs** (`WorkoutCycle` library): snapshot program month → library; paste onto any program by **day number** (1–28). **Warn and require confirm if target month already has content** (`force: true` after confirm). Calendar-date alignment deferred.
- **Archive → then delete (look-back shelf):** Templates, cycle packs, **and catalog exercises** use `archivedAt`. `DELETE` soft-archives (hidden from default lists / pickers, still listable with `?archive=archived`). **Restore** via `PATCH { action: "restore" }`. **Permanent delete** only with `?hard=1` and only if already archived (or `force=1`). **Exercises:** archive hides from pickers and text-upload matching; existing `WorkoutExercise` refs stay intact so past sessions still resolve names/videos. Hard delete strips workout refs (rare). Same pattern as user soft-hide — Jeremy can look back before true purge.
- UI: program calendar → **Templates & paste** panel (templates/packs); **Admin → Exercises** archive shelf. APIs: `/api/workout-templates/*`, `/api/workout-cycles/*`, `/api/exercises?archive=…`.
- Migrations: `20260712180000_workout_templates`, `20260712230000_archive_templates_cycles`, `20260712240000_archive_exercises`.

## Deploy branches (June 2026)
- **Production:** `main` only — currently tagged `prod-fallback-2026-06-14` (`64807c9`). Do not push WIP features to `main` unless John explicitly asks for prod.
- **Preview:** `preview` branch — all new work (chat, SMS, Go to Today, etc.). Push → Vercel Preview URL → merge to `main` when stable.
- See `DEPLOY.md` top section for full workflow + chat/SMS env vars.

## Other quick notes
- **Latest handoff:** see **WHERE WE LEFT OFF** at top of this file (2026-07-12).
- Set logging + green checks in MemberWorkoutConsole are working after simplifying. Schedule green rings, hybrid options, John & Steph floating player, equipment/SMS widgets rely on data files shipping with publish.
- Dev server often :3000/:3002; hard refresh after changes. Local dev may need restart after long sessions.
- Theme Song background music: muted-until-confirmed speaker, ~22s guide, dismiss only on mute/timeout (not any gesture).

