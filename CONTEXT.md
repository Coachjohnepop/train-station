# Train Station — CONTEXT (shared notebook)

**This is the main handoff file** for John + any agent (Grok, Claude, etc.).  
Update **WHERE WE LEFT OFF** at the end of a session. Don’t put secrets/passwords here.

*Also findable via:* `CLAUDE.md` → points here · `SESSION_STATUS.md` → points here · search repo for `WHERE WE LEFT OFF`

---

## People & roles

| Who | Role | Notes |
|-----|------|--------|
| **John** (you) | Builder / product | Repo owner; deploys; soaks; coaches Jeremy through product |
| **Jeremy** | Customer coach | Primary admin user; stress-tests clone/templates/calendar; email `jeremy@thetrainstation.co` |
| **John & Steph** | Demo member journey | Program subs, floating video, schedule greens in demos |
| **Grok** (xAI) | Coding agent in this TUI | Not Claude — may share this file |
| **Claude** | Separate agent (e.g. Claude Code) | May read `CLAUDE.md` / this file |

---

## Production & deploy

| Item | Value |
|------|--------|
| **Live site** | https://www.thetrainstation.co |
| **Repo** | `train-station` · GitHub `Coachjohnepop/train-station` |
| **Production branch** | `main` only (unless John says otherwise) |
| **Preview branch** | `preview` → Vercel Preview URL → merge to `main` when stable |
| **Prod fallback tag** | `prod-fallback-2026-06-14` (`64807c9`) — old safety pin |
| **Data ship rule** | Commit **code + data** (`prisma/seed-data.json`, `prisma/*.dev.json`) — see Publish section below |
| **Full deploy doc** | `DEPLOY.md` |

---

## Durable product rules (don’t forget)

### Always clone
Jeremy builds by **cloning**, never shared mutable refs:
- Paste Gym→Home, day→next week, template→day, 28-day pack→program → **always deep clone**
- Edit the copy; source stays intact

### Archive → then forever-delete (look-back shelf)
Templates, **28-day packs**, and **catalog exercises** use `archivedAt`:
- `DELETE` = soft-archive (hidden from default lists/pickers)
- `GET ?archive=archived` or `all` for shelf
- `PATCH { action: "restore" }`
- Forever delete only `?hard=1` when already archived (or `force=1`)
- **Exercises:** archive hides from pickers + text-upload matching; **existing workout lines keep working**; hard delete strips refs (rare)
- UI: **Templates & paste** panel + **Admin → Exercises** archive shelf
- Migrations: `…workout_templates`, `…archive_templates_cycles`, `…archive_exercises` (prod applied)

### Coach notes vs library
- `WorkoutExercise.notes` = session cue for members  
- `Exercise.description` / YouTube = library catalog  

### Template categories
Freeform (not only adult/athletes): yoga, meditation, nutrition, martial arts, dog training, etc.

### Do not
- Put joke soak names as warm-ups on **live member** program days  
- Push WIP to `main` without John asking for prod  

---

## Publish / data deliverable

When shipping for real demos to match local:
- `prisma/seed-data.json` (canonical snapshot)
- `prisma/logs.dev.json`, `user-equipment.dev.json`, `user-settings.dev.json`, `enrollments.dev.json`, `exercises.dev.json`, other `*.dev.json`
- After admin content edits: `npm run db:export-seed` (or equiv) **before** final commit
- Details: this file historically lived in `CLAUDE.md`; also `DEPLOY.md`, `DEMO_SCRIPT.md`

---

## Coach surfaces (Jeremy-friendly)

| Screen | URL | Purpose |
|--------|-----|---------|
| Dashboard | `/admin/day` | Day pick, plan/publish, roster |
| Go to Today | `/admin/today` | Live floor: sets, Zoom embed |
| Exercises | `/admin/exercises` | Library + archive shelf |
| Programs / calendar | `/admin/programs/…` | Builder, templates & paste, hybrid Gym/Home |

---

## Soak markers (prod QA labels)

Funny names so leftovers are greppable and safe to sweep:

| Marker | Purpose |
|--------|---------|
| `MARSHMALLOW-BADGER` | Archive + clone + restore + forever-delete (Jul 12) — **89/89 pass** · script `scripts/marshmallow-badger-soak.mjs` |
| `CLONE-PARTY-SOAK` | Template/paste/clone independence |
| `LASER-CHICKEN` / `CONFETTI-GOOSE` | Earlier CRUD / confetti soaks |

**Coach-only trail left for Jeremy** (not on schedule):
- Exercise (active): `MARSHMALLOW-BADGER · toast the shoulders (coach egg)`
- Exercise (archived shelf): `MARSHMALLOW-BADGER · fluff on the archive shelf`
- Template: `MARSHMALLOW-BADGER · hello Jeremy` · `marshmallow-badger` · `v_trail`
- Workout: `MARSHMALLOW-BADGER · coach playground (not on schedule)`

Audit Jeremy: `MINUTES=120 npx tsx scripts/jeremy-post-audit-prodtest.mjs`

---

## Key code map (recent)

| Area | Paths |
|------|--------|
| Exercise archive | `src/lib/catalog-exercise-archive.ts`, `src/app/api/exercises/*`, `ExerciseLibrary.tsx` |
| Templates / paste | `src/lib/workout-templates.ts`, `ProgramTemplatePastePanel.tsx` |
| Cycle packs | `src/lib/workout-cycle-db.ts`, `/api/workout-cycles/*` |
| Theme Song / music | `BackgroundMusic`, globals CSS — muted until playhead confirms sound |
| Demo vs DB | `isDemoMode` / `isCoachCatalogDemo`, `demo-*.ts`, dummy DATABASE_URL |

---

## Related docs (when it matters)

| File | What |
|------|------|
| **`CONTEXT.md`** | **You are here** — living handoff |
| `CLAUDE.md` | Thin pointer + Claude Code `@AGENTS.md` hook |
| `SESSION_STATUS.md` | Older Jul 2 snapshot (Go to Today/Zoom era) — historical |
| `AGENTS.md` | Next.js agent rules (breaking changes; read next dist docs) |
| `DEPLOY.md` | Deploy + data deliverable |
| `DEMO_SCRIPT.md` | End-to-end demo plan |
| `JUN13_CUSTOMER_REVIEW_ACTION_PLAN.md` | Jeremy Jun 13 feedback (P0 persistence) |
| `JEREMY_*.md` | Customer-facing test scripts |

---

## WHERE WE LEFT OFF

**Date:** 2026-07-12 evening PT  
**Status:** Taking a break.

### Done this stretch
- Site hardening around admin/coach content durability  
- Always-clone paste, freeform template categories, overwrite warnings  
- Archive shelf for **templates, 28-day packs, exercises** — on **prod** (`main`)  
- Theme Song / muted speaker honesty  
- Soak **MARSHMALLOW-BADGER** green; coach-only trail planted for Jeremy  
- Commits of note: `0ac0df5` exercise archive · `f71efb6` template/pack archive · handoff note `d5f0e28`

### Explicit decision
No MARSHMALLOW warm-up on Jeremy’s **live/member** workouts — coach library / shelf / playground only.

### When back
1. Did Jeremy find the trail / use archive? (post-audit)  
2. Optional: commit soak scripts under `scripts/`  
3. More DEMO_SCRIPT / Jeremy workflow; always ship data with content changes  
4. Local `npm run dev` may need restart (:3000 / :3002)

### Branch
`main` · in sync with origin for shipped archive work; local untracked soak artifacts under `scripts/` OK to leave or commit later.
