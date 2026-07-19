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

### Vendor account ownership (ops)

| Vendor | Login / owner | Notes |
|--------|---------------|--------|
| **Twilio** (carrier SMS) | **`john@thetrainstation.co`** · account phone = **John’s personal cell** | **PARKED (Jul 19)** — Jeremy weighing cost vs **Messages + email hub** already built. Account started under John; address wait is optional until un-parked. Do **not** put tokens here. Cost sheet: **`VENDOR_COSTS.md`**. |
| **Zoom** (live class) | Coach Connect as **`jeremy@thetrainstation.co`** · Marketplace app credentials on Vercel (John) | Host / recordings = Jeremy’s Zoom when he Connects. |
| **Stripe** | **Master / merchant = Jeremy’s Train Station business Stripe** · API keys on Vercel (John wires) | Full money-flow below. Live cutover still open (prod often still Test mode). |
| **Vercel / GitHub / Postgres** | John | Deploys, env, DB. |

**Jeremy-facing tech map:** → **`JEREMY_ADMIN_MANUAL.md`**  
**Stripe training:** → **`STRIPE_COMMISSION_SETUP.md`**, **`STRIPE_DEMO_SCRIPT.md`**, **`STRIPE_PRODUCT_CATALOG.md`**, **`PAYMENT_ADMIN_DEMO_SCRIPT.md`**

### Stripe money flow (durable — train every agent/human)

**Master Stripe account (merchant of record):** Jeremy’s **business Stripe account** for The Train Station — the Dashboard that owns products, customers, and bank payouts for the platform. Login is the **email that owns that Stripe account** (not a social “username”; confirm in Dashboard → Settings / Team). Vercel `STRIPE_SECRET_KEY` / publishable key / webhook secret **must belong to this same account**.

| Step | What happens |
|------|----------------|
| 1. Member pays | Card checkout (subscription **or** one-time — only two fee shapes) |
| 2. Money lands | **100% of the charge** (minus Stripe processing fees) hits **Jeremy’s master Stripe balance** |
| 3. Company keeps | Most revenue stays on that platform account (“company feed”) |
| 4. Partner split | **Not** at the moment of charge. Later: Admin → **Commission** (`/admin/commission`) + **Stripe Connect Express** transfers to partners |
| 5. John’s share | Seeded as **100% of the partner pool** (`john@thetrainstation.co`). Pool = **5% of MRR** until $5k goal, then **30% of MRR** (milestone mode). John must complete Connect onboarding before transfers. |
| 6. Test vs Live | **`sk_test_` / Test mode** = fake money only. Real dollars only after Live keys + live `price_…` IDs. |

**Fee types (product):** every paid package is **monthly subscription** or **one-time fee** (amounts can vary). See `STRIPE_PRODUCT_CATALOG.md`.

**Do not:** put a second merchant secret on Vercel for John; do not assume checkout auto-splits to John’s bank.

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

### Always use the database (Postgres) for app data
**Production and any multi-user / coach content path stores durable state in PostgreSQL (Prisma).**  
Do not add new features that write only to JSON files, Vercel Blob, or in-memory maps.

| Rule | Meaning |
|------|---------|
| **Default storage** | Prisma models + migrations — programs, workouts, members, SMS, payments, chat, settings, logs |
| **New features** | Design the schema first; ship API that reads/writes DB when `DATABASE_URL` / `POSTGRES_PRISMA_URL` is real |
| **No new blob/JSON stores** | Legacy `*-store.ts` / `prisma/*.dev.json` / Blob paths are **migration debt only** — do not grow them |
| **Local without DB** | Demo/JSON is a **dev fallback** when DB is unset/dummy — never the product-of-record for prod |
| **Seed files** | `prisma/seed-data.json` / `*.dev.json` are **export/import snapshots** for shipping content with code — not the runtime store on prod |
| **Secrets / media** | Env vars for keys; Blob/object storage OK for **files** (images, short chat video) — metadata still in DB |

When in doubt: **if a coach or member would lose work when a deploy restarts, it belongs in Postgres.**

See `PERSISTENCE.md` for demo-vs-DB matrix and blob→Postgres cutover.

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
| **`JEREMY_ADMIN_MANUAL.md`** | **Jeremy’s admin + tech map** — Admin screens, vendors (Twilio/Zoom/Stripe/Vercel), who owns what |
| **`VENDOR_COSTS.md`** | **All apps + monthly cost sheet** — retainer (🔴) vs usage vs parked (Twilio) |
| **`STRIPE_COMMISSION_SETUP.md`** | **Master Stripe + revenue split** (Jeremy merchant, John Connect, milestone %) |
| **`STRIPE_DEMO_SCRIPT.md`** / **`PAYMENT_ADMIN_DEMO_SCRIPT.md`** | Training walkthroughs (money flow at top) |
| **`STRIPE_PRODUCT_CATALOG.md`** | Products + subscription vs one-time fee types |
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
5. **Zoom / Go to Today** phone verify (embed, host Connect) — **not** blocked on SMS  
6. **Messages polish** (in-app + email hub) — preferred channel while Twilio **PARKED**  
7. **Infra hygiene** (blob→Postgres pace, seed commits, soak scripts)  
8. **Twilio carrier SMS** — only if Jeremy decides texts are worth retainer + usage (`VENDOR_COSTS.md`)  
9. **Parked product** only when Jeremy asks (food, store, more programs)

---

### 1. Stripe — finalize money

**Money model (always true):** Master account = **Jeremy’s business Stripe**. Charge → full amount there → **Commission / Connect** later for John (and future partners). Details: **Stripe money flow** under People & roles above + `STRIPE_COMMISSION_SETUP.md`.

**Live probe:** `/api/payments/public` → `stripeEnabled: true`, often **`stripeTestMode: true`**. Test prices: **$25/mo**, **$50/mo**, **$850** one-time. Not Live money until Live keys.

| Item | Status / notes |
|------|----------------|
| Products/prices in **Test** | Done (member / business / pro) |
| Checkout + webhook code paths | Shipped; prove on Live |
| Fee types only two | **Subscription** vs **one-time** (`product-offers` / catalog / join picker fixed Jul 19) |
| **Go Live checklist** | Flip Dashboard Live · new live `price_…` · live `sk`/`pk`/`whsec` in Vercel · redeploy · one real $25 (or refund) |
| Live webhook **200** | `checkout.session.completed`, invoice paid/failed, subscription updated/deleted |
| `STRIPE_PRICE_MEMBER` / `BUSINESS` / `PRO` | All three on Live env |
| `STRIPE_AUTO_APPROVE` | Optional — auto-approve member after pay |
| Full `STRIPE_DEMO_SCRIPT.md` pass/fail | Signup → paid → Adult Start → Admin Members shows Stripe |
| **Venmo backup** | Landing QR + Admin → Members **Mark paid**. **Same business bank as Stripe** (not a second merchant). Asset: `/images/venmo-jeremy-qr.png`. Script: `npx tsx scripts/set-venmo-landing-prod.mjs`. Docs: `JEREMY_S5_PAYMENTS_TEST.md` |
| **Commission / Connect** | Not auto-at-checkout. Enable Connect on **Jeremy’s** Stripe → John Express onboard → Admin → Commission → Preview/Run payout. Envs: `STRIPE_COMMISSION_*` |
| Referral promos | Optional coupons / `promo_…` in commission panel |
| Per-program Stripe products | **Not planned** — Adult unlocks with membership only |

Docs: `STRIPE_DEMO_SCRIPT.md`, `STRIPE_COMMISSION_SETUP.md`, `STRIPE_PRODUCT_CATALOG.md`, `PAYMENT_ADMIN_DEMO_SCRIPT.md`, `JEREMY_ADMIN_MANUAL.md` § Stripe

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
| SMS (Twilio) | **PARKED (Jul 19)** — code/ledger ready; prefer **Messages + Resend hub**. Un-park only with budget buy-in. Costs: `VENDOR_COSTS.md` |
| Publish speed | Smoke republish saved class → open students |
| Optional: commit soak scripts | `scripts/marshmallow-badger-soak.mjs`, `clone-party-soak.mjs`, etc. |

---

### 4. Infra / data hygiene

| Item | Notes |
|------|--------|
| **DB is source of truth** | Prod always Postgres; finish any remaining blob/JSON stores → Prisma |
| **Always ship data** with content | `prisma/seed-data.json` + `*.dev.json` (snapshots — not prod runtime) |
| Export seed after coach content sessions | `npm run db:export-seed` (or admin export) |
| Blob → Postgres migration | Phased stores (`DEPLOY.md`) — dual-write / backfill / parity; **no new stores** |
| Demo vs real DB consistency | Dummy URL = local demo only; prod Postgres for durable multi-user |
| Local dev | Prefer real local Postgres when testing multi-part / SMS / payments; restart `npm run dev` after long sessions |

---

### 5. Parked / later (not active unless asked)

- Eating / food logging (“coming soon”)  
- Store section (placeholder by design)  
- Coming-soon programs: military, glute, yoga, nutrition, stretching waitlists  
- **Nutrition guidance (Jeremy, Jul 18):** After intro Zoom, coach captures weight + goals, then sends **individual** guidelines + macros via **in-app messaging** (not a public Nutrition page dump). **Yes — product fits:** Admin chat → that member. Member Nutrition stays sample tiers / landing copy until personal plans exist. Later optional: save macros on member profile in **Postgres**, reusable message templates, pin plan in thread.  
- AB tests, extra coach tools from old `PROJECT_BUILD_PLAN.md`  
- **Coss family story** (separate repo) — live Speechify free tier (~50k chars/mo hard cap) OK for rare use; pre-record later if binge listening  

---

### Multi-part program days (military double/triple)

**Schema (prod applied `20260714120000_program_day_sessions`):**

| Layer | Role |
|-------|------|
| `ProgramDay` | Calendar day (+ `partCount` 1–5) |
| `ProgramDaySession` | Ordered part: AM / midday / PM (`partIndex`, `label`, `sessionKind`, `timeSlot`) |
| `ProgramDayOption` | Gym/Home **track under a session** (`sessionId` + legacy `dayId`) |

- **Not** the same as Gym vs Home — those stay options *inside* a part.
- Middle part of a 3-part day defaults to **cardio** (fasted cardio) via helpers in `src/lib/program-day-sessions.ts`.
- Backfill: every existing day has one **Main** session; all options attached.
- **UI next:** coach calendar “add part 2 / 3”, pick session kind, insert workouts per part. Members see multiple sessions on that day.

---

### Shipped recently (not backlog)

- Always-clone paste, freeform template categories, overwrite warnings  
- Archive shelf: templates, 28-day packs, **exercises** (prod)  
- Theme Song / honest muted speaker  
- MARSHMALLOW-BADGER soak green + coach-only easter egg (not on member schedule)  

---

## WHERE WE LEFT OFF

**Date:** 2026-07-19  
**Status:** SMS **PARKED**. Stripe packages = **monthly subscription vs one-time fee** (amounts vary). Join pricing + rest/equipment/program paste polish in working tree — **deploy when ready**. Zoom Vercel creds still empty. Full open list → **OPEN BACKLOG**.

### Jul 19 — Stripe fee types + rest / equipment / program polish
- **Fee model:** only two paid shapes — **subscription** (Coach $25/mo, Business $50/mo) and **one-time** (1st Class $850, custom training, merch). Admin → Pricing + `/api/payments/public` expose `feeCategory` / labels. Checkout UI shows fee type.
- **Money docs (same day):** Master Stripe = **Jeremy’s business account**; full charge lands there; John via **Connect later** — written into `CONTEXT.md`, `JEREMY_ADMIN_MANUAL.md`, `STRIPE_COMMISSION_SETUP.md`, `STRIPE_DEMO_SCRIPT.md`, `PAYMENT_ADMIN_DEMO_SCRIPT.md`, `STRIPE_PRODUCT_CATALOG.md`, `VENDOR_COSTS.md`.
- **Purchase path:** `/join` plan picker fixed → `/signup?plan=…` → Stripe. Shipped `f2a303a` to `main`.
- **Live money still needs:** Live `sk`/`pk`/`whsec` + live `STRIPE_PRICE_*` + Connect Ready for division.
- **Rest / equipment / program paste polish** as above.
- **Also earlier Jul 19:** Twilio PARKED, `VENDOR_COSTS.md`, `JEREMY_ADMIN_MANUAL.md`.
- **Zoom multi-coach (Jul 19 evening):** Jeremy hosts OK in prod. Confirmed per-coach isolation in code + prod DB (only Jeremy token row). Full **add coach 2…n** checklist written into `JEREMY_ADMIN_MANUAL.md`; no extra product work required unless Marketplace Publish for external Zoom orgs.
- **Tracks 2/3/5 (same session):** Coach Messages **quick-replies** (Macros / Welcome / Check-in / Rest / Great job); member Today **multi-part** list (`?part=`); Programs + Landing content rails for Jeremy.

### Prior stretch (Jul 15–16) — still true
Signing-off notes from Jeremy’s first AM client era; SMS audit migration **applied on prod**; per-exercise notes shipped `ebcc168`.

### Done this stretch (Jul 15)
- **Zoom OAuth:** Marketplace app under Jeremy; Vercel `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` (bare Dev credentials, not Secret Token / not authorize URL); Connect succeeded as **jeremy@thetrainstation.co** / Ready for class  
- **Week 2 program write:** Jump-to-week opens Monday so editor matches grid (was stuck on week 1)  
- **Per-exercise coach notes:** inline note under sets/reps on selected row; blur/Enter saves; no longer only top-bar field that disabled mid-save  
- **Workout titles:** strip `S1D-timestamp W2 Sat Gym` noise; auto-repair garbage names in Postgres when day opens  
- **Equipment / Gear:** category dropdown + freeform “Add category”; image proxy + Amazon MAIN tiles; multi-column catalog; single-column add form; DB CRUD with storage badge; **publish requires working product photo**  
- **Member rest timer v1:** set complete → countdown from exercise `restSec` (fallback workout-level timer); beep (Cybertruck horn); Skip + Mute; last set skips timer  
- **Coach nav:** resizable left sidebar (desktop, localStorage); badges inline next to label text (member tabs still corner)  
- **Prod junk purge:** ~132 S1D/clone-party soak workouts + ~30 empty shells (marshmallow-badger, orphan Fasted/Rest/Workout); **kept** linked Day-N Home placeholders + anything with logs. Scripts: `cleanup-junk-workouts.ts`, `cleanup-empty-workout-shells.mjs`  
- Jeremy feedback: week copy + editing good; first client next day **11:00** — will break more in morning  

### Explicit decisions
- No joke soak warm-ups on live member sessions  
- Multi-part = sequential sessions; Gym/Home = tracks *inside* a part  
- Zoom host for recordings = **jeremy@thetrainstation.co** (`ZOOM_HOST_EMAIL`)  
- Equipment with product link must have a **fetchable** image to publish to Gear  
- Rest timer: sticky countdown (default 90s); **skip last set**; ticks **last 5s** + soft complete buzz; live partner checkoff starts rest on both sides

### Multi-coach Zoom (shipped Jul 16 · verified Jul 19)
- **Per-coach OAuth:** `CoachZoomOAuth.id` = lower-case coach login email (not singleton `coach`).
- Each coach Connects **their** Zoom; disconnect only clears that coach (`clearZoomOAuthRecord(session.email)` — not global wipe).
- Host rule: Zoom profile email **matches coach login** OR `ZOOM_HOST_EMAIL` / `ZOOM_HOST_EMAILS` / domain flag.
- Meetings / ZAK use the **logged-in coach’s** tokens.
- **Ops still required for external Zoom accounts:** Marketplace app **Publish** (Development = same Zoom org as app owner only). After publish, put Production Client ID/Secret in Vercel if different.
- **Prod (Jul 19):** only `jeremy@thetrainstation.co` row with tokens; pending OAuth state rows for jeremy + john are leftover, not second connections.
- **Isolation proof (code):** save/upsert is `where: { id: coachEmailKey }`; disconnect deletes only that key / that coach’s `connectedByEmail` / legacy singleton if it belonged to them — **John Connect cannot overwrite Jeremy’s id**.
- **Coach checklist:** `JEREMY_ADMIN_MANUAL.md` → **Checklist: add coach 2…n (Zoom)**.

### SMS / Twilio deep polish + M&A audit (started — John sleeping)

**Why it matters (business):** member trust, coach ops, TCPA/carrier readiness, acquisition diligence (who was messaged, when, delivery outcome, consent/opt-out).

**Principle:** **Postgres everywhere durable state is needed** — no demo JSON for SMS when `DATABASE_URL` is real.

**Shipped in code (local; not necessarily deployed):**
- Migration `20260716120000_sms_audit_mna` — expand `SmsLog`; `SmsDeliveryEvent`; `AuditEvent`; User `phoneE164` / `smsConsentAt` / `smsOptOutAt` / `smsOptInAt`
- `src/lib/sms-delivery.ts` — single audited send path (`deliverSmsAudited`)
- `src/lib/audit-event.ts` — append-only `AuditEvent`
- Inbound: STOP/START/HELP + unknown-number ledger
- Status callback: `POST /api/sms/status`
- Hub logs read from ledger API

**When back — SMS next steps:**
1. Apply migration on prod (`prisma migrate deploy`)
2. Set `TWILIO_INBOUND_WEBHOOK_URL` + `TWILIO_STATUS_CALLBACK_URL` exact public URLs
3. E2E: send → SID on `SmsLog` → status delivered → STOP blocks
4. Coach hub UX: Live/Simulated/Paused chip + status column
5. Consent capture on onboard (timestamp `smsConsentAt`)
6. Continue replacing any remaining JSON message stores with DB

### Jeremy AM Jul 16 — per-exercise notes
- He still “can’t add little notes to each exercise” (felt unchanged overnight).
- Root cause: note inputs were nested inside a `<button>` (invalid HTML) → typing/focus flaky; also notes only appeared after click (“Click to add note…”).
- **Shipped `ebcc168` to prod** — always-visible violet note field per exercise; blur saves; “Note saved.” Hard-refresh program day builder.

### SMS audit (same ship)
- Migration `20260716120000_sms_audit_mna` **applied on prod Postgres**
- Also applied pending `20260716010000_zoom_oauth_per_coach` if it was waiting

### When back (undone / next)

1. **Jeremy re-test** — violet note under each exercise on a program day  
2. **SMS E2E** — send → SID → STOP; set exact Twilio webhook URL envs if not set  
3. **Stripe Live** — still test mode  
4. **Zoom Marketplace publish** — second coach on external Zoom  
5. **Rest timer / equipment / multi-session** as before  

### Branch / deploy
`main` @ `ebcc168` — notes UX + SMS audit ledger. Vercel Production auto-deploys from `main`. Prod DB migrations applied.
