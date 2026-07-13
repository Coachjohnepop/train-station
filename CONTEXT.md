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
| `JEREMY_REMAINING_CHECKLIST.md` | Jeremy’s content + 5-min verify list |
| `STRIPE_DEMO_SCRIPT.md` / `STRIPE_COMMISSION_SETUP.md` | Payments go-live + revenue share |
| `PAYMENT_ADMIN_DEMO_SCRIPT.md` | Coach payment walkthrough |
| `SESSION_STATUS.md` | Older Go to Today / Zoom verify list |

---

## OPEN BACKLOG (sticky — more than Stripe)

*Last expanded: 2026-07-12. Reorder when priorities change; tick mental boxes here when done.*

### Suggested stack order
1. **Stripe Live + webhook + one real payment** (+ Venmo path)  
2. **Commission / Connect** if John payouts matter before revenue grows  
3. **Jeremy content** (YouTube + real Adult W1/W2)  
4. **E2E money + member path** (ticket → pay → onboard → Adult → log sets)  
5. **Zoom / Go to Today / SMS** phone verify  
6. **Infra hygiene** (blob→Postgres pace, seed commits, soak scripts)  
7. **Parked product** only when Jeremy asks (food, store, more programs)

---

### 1. Stripe — finalize money

**Live probe (Jul 12):** `/api/payments/public` → `stripeEnabled: true`, **`stripeTestMode: true`**. Prices exist: **$25/mo**, **$50/mo**, **$850** one-time. Not Live money yet.

| Item | Status / notes |
|------|----------------|
| Products/prices in **Test** | Done (member / business / pro) |
| Checkout + webhook code paths | Shipped; prove on Live |
| **Go Live checklist** | Flip Dashboard Live · new live `price_…` · live `sk`/`pk`/`whsec` in Vercel · redeploy · one real $25 (or refund) |
| Live webhook **200** | `checkout.session.completed`, invoice paid/failed, subscription updated/deleted |
| `STRIPE_PRICE_MEMBER` / `BUSINESS` / `PRO` | All three on Live env |
| `STRIPE_AUTO_APPROVE` | Optional — auto-approve member after pay |
| Full `STRIPE_DEMO_SCRIPT.md` pass/fail | Signup → paid → Adult Start → Admin Members shows Stripe |
| **Venmo backup** | Landing QR + Admin → Members **Mark paid** (`JEREMY_S5_PAYMENTS_TEST.md`) |
| **Commission / Connect** | `STRIPE_COMMISSION_*` envs · Connect Express for John · Admin → Commission · optional monthly cron |
| Referral promos | Optional coupons / `promo_…` in commission panel |
| Per-program Stripe products | **Not planned** — Adult unlocks with membership only |

Docs: `STRIPE_DEMO_SCRIPT.md`, `STRIPE_COMMISSION_SETUP.md`, `STRIPE_PRODUCT_CATALOG.md`, `PAYMENT_ADMIN_DEMO_SCRIPT.md`

---

### 2. Jeremy’s plate (content + verify)

Mostly **his** work — from `JEREMY_REMAINING_CHECKLIST.md`:

| Item | Notes |
|------|--------|
| Landing YouTube links | Welcome, free-ticket chastise, weekly coach, “what’s for dinner” |
| Real **Adult Strength** W1/W2 | Replace calendar templates with real Gym/Home content; copy-week then tweak |
| Phone 5-min verify | Free ticket → chastise; welcome video; Member Today videos; SMS self-test; builder delete/reorder sticky |
| Optional cleanup | Rename generic exercises; hide unused workouts; nutrition tier wording |

**Watch:** Did he find MARSHMALLOW-BADGER trail / archive shelf? (`jeremy-post-audit-prodtest.mjs`)

---

### 3. Coach product / engineering polish

| Item | Notes |
|------|--------|
| Archive + clone | **Shipped + soaked** — monitor Jeremy usage |
| Jun 13 leftovers | Demo-path edge cases if still on dummy DB; messy imported workout names; **4-week / phase model** clarity |
| Program UX | Day-card drill-down to edit exercises; hybrid Gym/Home clarity |
| Go to Today / Zoom | Re-verify embed (not new tab), set checkoffs live, sticky video, “Show video here” |
| Zoom → member SMS join | E2E after coach Start Video |
| Nav cleanup | Live Floor vs Go to Today overlap; mobile bottom nav simplification |
| Chat | Routes exist; Blob for short video uploads; coach/member chat polish as needed |
| SMS (Twilio) | Real outbound/inbound when `TWILIO_*` set; else simulated |
| Publish speed | Smoke republish saved class → open students |
| Optional: commit soak scripts | `scripts/marshmallow-badger-soak.mjs`, `clone-party-soak.mjs`, etc. |

---

### 4. Infra / data hygiene

| Item | Notes |
|------|--------|
| **Always ship data** with content | `prisma/seed-data.json` + `*.dev.json` |
| Export seed after coach content sessions | `npm run db:export-seed` (or admin export) |
| Blob → Postgres migration | Phased stores (`DEPLOY.md`) — dual-write / backfill / parity |
| Demo vs real DB consistency | Dummy URL = demo JSON; prod Postgres path for durable multi-user |
| Local dev | Restart `npm run dev` (:3000 / :3002) after long sessions |

---

### 5. Parked / later (not active unless asked)

- Eating / food logging (“coming soon”)  
- Store section (placeholder by design)  
- Coming-soon programs: military, glute, yoga, nutrition, stretching waitlists  
- AB tests, extra coach tools from old `PROJECT_BUILD_PLAN.md`  
- **Coss family story** (separate repo) — live Speechify free tier (~50k chars/mo hard cap) OK for rare use; pre-record later if binge listening  

---

### Shipped recently (not backlog)

- Always-clone paste, freeform template categories, overwrite warnings  
- Archive shelf: templates, 28-day packs, **exercises** (prod)  
- Theme Song / honest muted speaker  
- MARSHMALLOW-BADGER soak green + coach-only easter egg (not on member schedule)  

---

## WHERE WE LEFT OFF

**Date:** 2026-07-12 evening PT  
**Status:** Taking a break. Full open list → **OPEN BACKLOG** above.

### Done this stretch
- Site hardening around admin/coach content durability  
- Always-clone paste, freeform template categories, overwrite warnings  
- Archive shelf for **templates, 28-day packs, exercises** — on **prod** (`main`)  
- Theme Song / muted speaker honesty  
- Soak **MARSHMALLOW-BADGER** green; coach-only trail planted for Jeremy  
- Commits of note: `0ac0df5` exercise archive · `f71efb6` template/pack archive · handoff `d5f0e28` · `CONTEXT.md` hub `b0cbdeb`  
- Stripe: **test mode live on prod** (not Live money yet) — go-live still open  
- **Jeremy video IMG_2662 (Jul 12):** Published day locked “Day one” notes after copy-week — fixed `42e122e` (edit notes while published; Unpublish; copy-week no longer copies published)

### Explicit decision
No MARSHMALLOW warm-up on Jeremy’s **live/member** workouts — coach library / shelf / playground only.

### When back
1. **Stripe Live** (+ webhook + Venmo + optional Commission) — top money path  
2. Jeremy content / did he use archive? (post-audit)  
3. Optional: commit soak scripts; E2E money→member→Adult  
4. Zoom / SMS / Go to Today phone verify  
5. Infra as needed (seed export, blob migration)  

### Branch
`main` · shipped archive work on origin; local untracked soak artifacts under `scripts/` OK to leave or commit later.
