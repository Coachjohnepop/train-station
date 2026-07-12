@AGENTS.md

# Train Station - Claude / Project Context Notes

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
- **Archive → then delete (look-back shelf):** Templates and cycle packs use `archivedAt`. `DELETE` soft-archives (hidden from default lists, still listable with `?archive=archived`). **Restore** via `PATCH { action: "restore" }`. **Permanent delete** only with `?hard=1` and only if already archived (or `force=1`). Same pattern as user soft-hide — Jeremy can look back before true purge. Extend to catalog workouts later if needed.
- UI entry: program calendar → **Templates & paste** panel. APIs under `/api/workout-templates/*` and `/api/workout-cycles/*` (+ snapshot|paste).
- Migrations: `20260712180000_workout_templates`, `20260712230000_archive_templates_cycles`.

## Deploy branches (June 2026)
- **Production:** `main` only — currently tagged `prod-fallback-2026-06-14` (`64807c9`). Do not push WIP features to `main` unless John explicitly asks for prod.
- **Preview:** `preview` branch — all new work (chat, SMS, Go to Today, etc.). Push → Vercel Preview URL → merge to `main` when stable.
- See `DEPLOY.md` top section for full workflow + chat/SMS env vars.

## Other quick notes
- Current focus (as of latest): Set logging + green checks in MemberWorkoutConsole are working again after simplifying (removed per-click coach live save complexity that was interfering with local state → visual). Schedule green rings for done sessions, hybrid options, John & Steph floating player, equipment/SMS dashboard widgets, etc. all rely on the data files above being present on publish.
- More testing (per DEMO_SCRIPT.md) then publish is the plan. Publishing with the full data committed will make the live experience match what you've been validating locally and reduce flakiness.
- Dev server usually runs on :3002 in this env (check with lsof/curl if needed); hard refresh after changes.
- User will return from testing/BBQ and give next signal.

