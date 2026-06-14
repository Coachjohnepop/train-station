# Train Station — June 13 Customer Review Action Plan

**Source**: Jeremy's screen recording + live admin navigation (Jun 13 update.pdf in Dev Notes). Raw transcript of him walking through exercises → programs (Adult Strength Conditioning) → week/day options (Gym/Home) → referenced workouts.

**Goal**: Make the coach admin a *reliable, low-friction* tool so he can own his content. He wants: "one thing that I need taken off my plate at a time. I just wanna be able to go boom. Adult strength is good. Never worry about it again."

**Current reality (why the frustration)**: 
- The live site + easy local runs use **demo mode** backed primarily by the committed `prisma/seed-data.json` snapshot (exercises + workouts + workoutExercises + full program schedules).
- Exercise name/desc/video edits only persist to `exercises.dev.json` (separate override layer).
- Workout exercise mutations (add/remove/prescription changes inside a workout) are mostly "pretend" in demo — they return fakes but do not update the snapshot.
- Program schedule views, workout builders, and member-facing pages re-load the full seed snapshot → stale names, missing deletes, and changes that "disappear" on navigation or on trainstation.co.
- The recent hybrid Gym/Home per-day options + name-editing work made the data model more powerful but exposed gaps in the demo persistence + UI clarity for his editing workflow.
- Previous (pre-hybrid) flow felt more direct for data entry.

---

## Prioritized Action Plan (Small, Incremental, Testable)

### P0 — Critical: Edits & Deletes Must Persist and Appear Everywhere (Highest pain in the recording)
Do these first. One slice per commit/preview. Success = he can change a name or delete in the library, see it reflected in the exact workout lists he navigates to from programs, survive refresh + new preview deploy, and deletes actually remove the item.

1. **Exercise name / description / video changes must propagate to all workout and program views.**
   - When `saveDemoExercises` runs (on PATCH /api/exercises/[id]), also update the matching exercise record (by id) inside the loaded seed-data snapshot (the `exercises` array) **and** any embedded `exercise.name` (or full exercise object) inside `workoutExercises` records.
   - Update the demo workout loader (`/api/workouts/[id]`) and program data loaders so they resolve current exercise details by ID from the dev-overridden exercises list instead of (or in addition to) any baked snapshot name.
   - After a successful edit in ExerciseLibrary, optimistically update any visible lists or add a tiny "changes will appear after refresh / in other tabs" note + ensure hard reloads pick it up.
   - On deploy: changes to exercises.dev.json or seed-data.json must be committed (as called out in CLAUDE.md) for the live site to see them. Consider an admin "Export current content to seed snapshot" button that runs the equivalent of `npm run db:export-seed` logic for the demo path.

2. **Deletes in the exercise library must actually remove the item (and clean references).**
   - In DELETE /api/exercises/[id] demo path: splice from the dev list **and** from the seed snapshot's exercises + any workoutExercises that reference it.
   - In the UI (ExerciseLibrary), after delete, the table must no longer show it. If the exercise was used in scheduled workouts, either auto-remove those links (with a note) or block the delete with a clear message ("Used in 3 workouts — remove from schedules first or force delete").
   - Test the exact flow he showed: delete one, confirm, go back to list/programs/workouts — it must be gone.

3. **"Remove" and "Edit setup" (prescription) for exercises inside workouts must work reliably in demo for existing seeded workouts.**
   - The `/api/workouts/[id]/exercises` (DELETE, PATCH) routes currently have limited demo handling ("pretend it saved" for adds; recent guards for new-w-* IDs). Extend them to actually mutate a dev override layer (e.g. `workout-exercises.dev.json` or patch the seed snapshot's workoutExercises array) and return consistent data.
   - Make the WorkoutBuilder's load after remove/edit re-fetch and show the updated list (no more "nothing happens" or "something went wrong").
   - Ensure the embedded `exercise` object in the returned items always carries the *current* name from the exercises list (ties into #1).
   - Fix any label glitches he saw (repeated "straight straight" text — likely in approachLabel / formatPrescriptionSummary when data is partial or from import).

4. **Cross-page + live-site consistency loop.**
   - Full round-trip test that matches his recording:
     - Library → edit name → see updated name when drilling from Programs → Adult → specific week/day Gym or Home option → the workout exercise list.
     - Same for delete.
     - Same on a fresh Vercel preview (after the json files are committed).
   - Add a note in the admin UI: "Demo mode — content changes are persisted to local json files. Commit prisma/*.dev.json + seed-data.json (or run export) before pushing if you want them on the live site."

### P1 — Search, Categories, and Smoother Navigation (Direct requests from the review)
1. **Search + categories in /admin/exercises.**
   - Add a search input at the top of the library table (filters name + description instantly).
   - Add a simple category / tag column + filter (multi-select or chips). Suggested starting set from his words: Back, Chest, Legs, Shoulders, Arms (biceps/triceps), Core/Abs, Full Body, Mobility/Warm-up, Cardio.
   - Allow setting tags on create or via the existing edit cells. Seed reasonable tags on the current exercises during the fix (or provide a one-time script).
   - This was explicitly "like we did before."

2. **Easier drill-down from program schedule into workout content.**
   - In ProgramScheduleBuilder, for each day option (Gym, Home, etc.), make the assigned workout name a link (or add a clear "Edit exercises →" button) that goes to `/admin/workouts/${workoutId}`.
   - Show a compact preview of the first few exercise names (or count + "view/edit") right on the option card so he doesn't have to guess what "Upper Body Workout (Home)" contains.
   - Consider a "View as member would see this day" quick link.

3. **Minor program header polish.**
   - Make the program name (e.g. "Adult strength conditioning") editable in place on the /admin/programs/[slug] header (simple PATCH).

### P2 — Program Structure & 4-Week Model Clarity
1. **Document + implement (if missing) the 4-week visibility / cycling rule.**
   - Current enrollment tracks currentWeek/currentDay inside a program's durationWeeks.
   - Clarify for Jeremy: Do members only ever see/advance within the first 4 weeks of a program until they explicitly "start next phase" or re-enroll? Or is the whole duration always visible?
   - He does **not** want to write 12 weeks of detailed content only to discover the structure has to be rebuilt.
   - Options to propose/implement:
     - Keep programs as 4-week units. He creates "Adult Strength - Phase 1", "Phase 2", etc. and manages enrollment manually or via a simple "advance member to next program" admin action.
     - Or add explicit phase support (a program can declare "phaseOf: X, totalPhases: 3") and member schedule only renders the current phase's weeks + a "next phase available after..." message.
   - Update the member program view + dashboard "Continue" labels to make the boundary obvious.
   - Add a small note in the program admin UI explaining the model.

2. **Cleanup from import.**
   - The many oddly named / fragmented workouts ("Day one upper home", "fifteen, one, two, three", "Gym x section") are confusing in the workouts list.
   - After P0, use the admin to rename or consolidate the ones that are actually used in his Adult (and other) programs. Goal: clean names that match how he thinks ("Day 1 Upper Body - Home", etc.).

### P3 — Data, Deploy & Long-Term Hygiene
- After any content editing session (his or ours), run `npm run db:export-seed` (or the admin export when we add it) and commit the updated seed-data.json + relevant *.dev.json files. This is required for the live site to match (see CLAUDE.md "data is part of the deliverable").
- Consider (after this immediate batch of fixes): stand up the real Supabase Postgres for his production instance so future admin changes are instantly live without needing git commits on every tweak. Keep the committed seed as the clean "factory reset" baseline for new customers or testing.
- Update `DEMO_SCRIPT.md` (Section 10 Admin) and `JEREMY_CLIENT_TEST_SCRIPT.md` with explicit regression checks for name propagation, delete, search, remove/edit in workouts, and program day drill-down.

### P4 — Process & Validation
- **One small verifiable change per push/preview.** Compare side-by-side with a baseline preview he likes.
- Test the exact sequences he recorded (library edit → programs navigation; workout list interactions from program context).
- Once P0 is solid, do a quick live or recorded re-review with him on the new preview.
- Keep the "fresh review" vs "populated demo" distinction in mind — he was clearly testing as the coach maintaining real content.

---

**Recommended starting point**: Begin with P0 items 1-2 (exercise name propagation + delete). These were the dominant theme in the 3-page transcript and the direct cause of "it's all for fun and games from my end. I have no way to edit or do anything."

This plan directly maps every major complaint he voiced to a focused, testable engineering step while respecting the existing project principles (small increments, data snapshots matter, demo mode for the current site, preview-driven review).

File created: `JUN13_CUSTOMER_REVIEW_ACTION_PLAN.md` (at project root). Reference it alongside PROJECT_BUILD_PLAN.md, CLAUDE.md, and DEMO_SCRIPT.md.

Ready for the first slice when you are.