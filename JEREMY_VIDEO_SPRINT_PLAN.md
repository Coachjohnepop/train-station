# Jeremy Video Review — Sprint Plan

**Source:** Client screen recording transcript (June 2026)  
**Client deadline context:** July is last month of paid clients; program content entry is the blocker.  
**Principle:** One sprint = one shippable preview. Jeremy’s #1 need is *entering programs like last year’s tool* — everything else is secondary until that works.

---

## What Jeremy said (distilled)

| Pain | Quote / intent |
|------|----------------|
| **Delete doesn’t stick** | Deletes bench press → looks like it worked → still there. “Shiny box with nothing in it.” |
| **Program entry ASAP** | Click Monday → add whole workout → copy week to week 2 → tweak sets/reps. “Like the other one.” |
| **Catalog cleanup** | Keep: Adult (home/gym), Adolescent (soon), Athletes S&C, Mom & Dads w/ Little Time, Military Prep. Drop/rename junk (Muscle Max, Gracefully Age, Weight Loss, QA workouts). |
| **Payments that matter** | Adult program + 1st Class + Coach ticket only. Yoga etc. can wait; payout structure later. |
| **Leads** | Don’t care — word of mouth. |
| **Free ticket** | “There is nothing free” — don’t make free follow-up feel like a job. |
| **Member book call** | Calendly shows every time on every day — wrong. Should reflect real availability. |
| **Member preview** | Adult → Start → “Preview upper body” missing actual workout content. |
| **Landing** | Likes tickets + coming soon (Military prep, glute, yoga, nutrition, stretching). Needs **Train Station logo** visible (desktop + phone). |
| **Admin users** | Phone not saving; doesn’t know who John/Steph/Alex/Chad are. |

---

## Sprint map (recommended order)

```
S1 ──► S2 ──► S3 ──► S4 ──► S5 ──► S6 ──► S7
persist  builder  catalog  bulk    pay     member  landing
```

| Sprint | Name | Est. | Blocks Jeremy? |
|--------|------|------|----------------|
| **S1** | Content persistence | 2–3 days | Yes — can’t trust any edit |
| **S2** | Program builder (last year’s flow) | 3–5 days | **Yes — #1 business need** |
| **S3** | Catalog & naming cleanup | 1–2 days | Yes — confusion / clutter |
| **S4** | Bulk entry (text upload + seed export) | 1–2 days | Helps August deadline |
| **S5** | Payments focus | 2–3 days | Revenue |
| **S6** | Member book + preview workout | 1–2 days | Client-facing polish |
| **S7** | Landing brand + de-noise admin | 1–2 days | Marketing / trust |

---

## Sprint 1 — Content persistence (P0)

**Goal:** Any delete or rename in Exercises survives refresh, navigation, and redeploy.

### Scope
- [x] Fix exercise **DELETE** to atomically update exercises list + `workoutExercises` in one seed mutation
- [x] Ensure Vercel demo mode **fails loudly** if blob save fails (no fake 204)
- [ ] Verify `TS_BLOB_TOKEN` on preview/prod OR commit workflow (`db:export-seed` + push)
- [x] Exercise **rename** propagates to workout lists and program drill-down (same as delete)
- [x] Admin banner: “Changes persist to blob; run export + commit for permanent live snapshot”

### Key files
- `src/app/api/exercises/[id]/route.ts`
- `src/lib/demo-exercises.ts`, `src/lib/demo-seed-store.ts`, `src/lib/demo-json-blob.ts`
- `src/components/ExerciseLibrary.tsx`

### Acceptance (Jeremy test)
1. Admin → Exercises → delete “Bench Press” → confirm → **gone from list**
2. Hard refresh → still gone
3. Programs → Adult → Week 1 Monday Gym → **no bench press / no “Unknown” slot**
4. New Vercel preview after commit → still gone

---

## Sprint 2 — Program builder: “like last year” (P0)

**Goal:** Jeremy can build a full week, copy it forward, and edit sets/reps per week without shared-workout bugs.

### Scope
- [x] **Click day → build:** Mon row gets obvious CTA (`+ Gym` / `+ Home` opens editor immediately; click “Mon” label)
- [x] **Assign whole workout:** picker to attach an existing workout library item to a day option (not only exercise-by-exercise)
- [x] **Copy week — real clone:** `Copy to this week` duplicates each day’s Gym/Home **options** AND **clones workouts** (new workout IDs, copied exercises + sets/reps) so Week 2 edits don’t mutate Week 1
- [x] **Copy to remaining weeks** (stretch): one action after Week 1 is set
- [x] Persist `options` array on **production Prisma path** (not demo-only)
- [x] Inline on day row: first 3 exercise names + “Edit →” link to workout

### Key files
- `src/components/ProgramScheduleBuilder.tsx`
- `src/app/api/programs/days/[dayId]/route.ts`
- `src/lib/program-data.ts`, `src/lib/demo-workout-items.ts`
- New: `cloneWorkoutForWeekCopy()` helper

### Acceptance (Jeremy test)
1. Adult Strength → Week 1 → Monday Gym → add full upper workout → save
2. Repeat Tue–Sun
3. Week 2 → **Copy to this week** → all days populated with same structure
4. Change sets/reps on Week 2 Monday only → Week 1 **unchanged**
5. Member view shows Week 1 workout content (not empty preview)

---

## Sprint 3 — Catalog & naming cleanup (P1)

**Goal:** Only the programs Jeremy listed; sensible names everywhere.

### Target program list

| Status | Program |
|--------|---------|
| **Live** | Adult Strength Conditioning (Gym + Home tracks) |
| **Live** | Athletes — Speed, Strength & Conditioning |
| **Live** | Mom & Dads with Little Time *(rename from Gracefully Age)* |
| **Live** | Military Preparation *(rename Boot Camp Preparation)* |
| **Coming soon** | Adolescent Training |
| **Coming soon (landing)** | Glute Building, Yoga, Nutrition, Stretching |
| **Remove / hide** | Muscle Max, Weight Loss, Gracefully Age slug, Combat Training?, Yoga Channel? (confirm with Jeremy) |
| **Remove test junk** | QA Workout, QA Smoke, fragmented “Day one upper home” names |

### Scope
- [x] Update `TOP_LEVEL_PROGRAMS`, `seed-data.json`, admin + member catalog
- [ ] Rename exercises: “Bench Press” → delete; use “Flat Bench Barbell Chest Press” etc.
- [x] Admin workouts list: hide or delete QA-* entries
- [x] Landing `COMING_SOON_PROGRAMS`: adolescent + glute/yoga/nutrition/stretching; align names with member catalog

### Key files
- `prisma/seed-data.json`
- `src/lib/programs.ts`, `src/lib/landing-tickets.ts`
- `src/components/ProgramCatalog.tsx`, `ComingSoonPrograms.tsx`

### Acceptance
- Member `/member/programs` shows only Jeremy’s list
- No “Muscle Max”, “Gracefully Age”, or “QA” visible to Jeremy
- Military Prep naming consistent landing + member + admin

---

## Sprint 4 — Bulk entry & export (P1)

**Goal:** Fast path to load August’s content without hand-clicking every exercise.

### Scope
- [x] Verify **Text Upload** on program week still works end-to-end after S2
- [x] Admin **Export seed snapshot** button → downloads / commits-ready JSON
- [x] Document 10-minute “load a week from text” recipe for Jeremy
- [ ] Optional: import from structured paste (week template)

### Acceptance
- Jeremy can paste a week block → assigns workouts to Mon–Sun
- Export produces `seed-data.json` diff he can review before push

---

## Sprint 5 — Payments: adult + tickets only (P1)

**Goal:** Money for the three things Jeremy cares about today.

### Scope
- [x] Stripe checkout: **Coach Class ($25)** and **1st Class ($50)** from landing tickets
- [x] Adult Strength included with paid membership (no separate SKU yet)
- [x] Venmo QR on checkout + admin **Mark paid** for Venmo/manual
- [x] Hide or soft-disable checkout for non-priority programs (yoga, etc.) — “Join waitlist” only
- [x] De-prioritize **Leads** admin nav (hide or collapse) — Jeremy doesn’t use it
- [x] Free ticket: change copy — no “follow-up” implication; optional lead capture off

### Key files
- `src/lib/stripe.ts`, `src/components/PricingWithInlineSignup.tsx`
- `src/lib/landing-tickets.ts`, `src/components/FreeTicketModal.tsx`
- `src/components/MemberShell.tsx` (nav)

### Acceptance
- Landing → Coach ticket → Stripe test payment → member access
- Free path doesn’t trigger nagging follow-up emails

---

## Sprint 6 — Member: book call + preview workout (P2)

**Goal:** Katie’s phone flow matches what Jeremy expects.

### Scope
- [x] **Preview workout:** Adult enroll → day view shows real exercises (not empty “Preview: Upper Body Power” shell)
- [x] **Book call:** Calendly primary; backup slots use admin availability (not fake every-hour grid)
- [x] Wire admin availability → member slot list in demo mode (or hide manual picker when Calendly is primary)
- [ ] Store section: leave placeholder; no scope creep

### Key files
- `src/lib/demo-workout.ts`, `src/components/MemberProgramSchedule.tsx`
- `src/app/member/book/page.tsx`, `src/lib/booking.ts`

### Acceptance
- Katie: Adult → Start → sees exercise list with sets/reps
- Book call opens Calendly with real availability (or clear “opens in Calendly” if embed not possible)

---

## Sprint 7 — Landing brand & admin hygiene (P2)

**Goal:** Feels like The Train Station; admin noise reduced.

### Scope
- [ ] **Logo on landing** — circle badge “on the wall” desktop; corner on mobile
- [ ] **“The Train Station”** wordmark in hero or header on phone
- [ ] Coming soon cards: Military prep, glute, yoga, nutrition, stretching (already liked)
- [ ] Admin Users: fix phone save for demo/signup members OR merge signups into editable roster
- [ ] Clarify demo users (John, Steph, Alex, Chad) — label as test accounts or remove

### Acceptance
- Landing on phone says “The Train Station” and shows logo
- Jeremy can save Katie’s phone and see it after refresh

---

## Explicitly parked (Jeremy said later)

- Employee / coach payout splits ($25/person until 200+ members)
- Yoga ticket checkout & revenue share
- Leads pipeline & follow-up automation
- Music monetization
- Train-station location video / brand film
- Full eating-program enrollments (fat loss, etc.)

---

## How we run each sprint

1. **Kickoff:** Confirm scope slice with John (5 min)
2. **Build:** One branch / preview per sprint
3. **Test:** Jeremy-style script from acceptance criteria above
4. **Deploy:** Push preview → Jeremy clicks on phone + desktop
5. **Sign-off:** Jeremy “boom, never worry about it again” OR fix-forward before next sprint

---

## Suggested immediate next step

**Start Sprint 1** (delete persistence) — same day as Sprint 2 design spike on copy-week clone, since S2 is the business deadline but S1 unblocks all content work.

When John says *“do S1”*, we implement persistence only — no scope creep into landing or payments.