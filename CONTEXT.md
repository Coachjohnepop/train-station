# Train Station — CONTEXT (shared notebook)

**This is the main handoff file** for John + any agent (Grok, Claude, etc.).  
Update **WHERE WE LEFT OFF** at the end of a session. Don’t put secrets/passwords here.

*Also findable via:* `CLAUDE.md` → points here · `SESSION_STATUS.md` → points here · search repo for `WHERE WE LEFT OFF`

---

## People & roles

| Who | Role | Notes |
|-----|------|--------|
| **John** (you) | Builder / product | Repo owner; deploys; soaks; coaches Jeremy. **App admin: `john@thetrainstation.co`**. **Member smoke account: `john@bcxvoice.com`** (not staff). **Vercel/GitHub deploy login: `john@bcxvoice.com`** (CLI `john-9066`) — platform only, not member role. **`john@lemonvoice.com` free** for fresh paid-signup tests (demo John & Steph = `johnsteph@thetrainstation.co`). **Stripe Dashboard login (TheTrainStation Brave profile): Google `john@bcxvoice.com`** — sees BCX Voice + Eco Delight only until Jeremy invites that same email to TS Live. |
| **Jeremy** | Customer coach | Primary admin user; stress-tests clone/templates/calendar; email `jeremy@thetrainstation.co` |
| **John & Steph** | Demo member journey | Program subs, floating video, schedule greens in demos |
| **Grok** (xAI) | Coding agent in this TUI | Not Claude — may share this file |
| **Claude** | Separate agent (e.g. Claude Code) | May read `CLAUDE.md` / this file |

### Vendor account ownership (ops)

| Vendor | Login / owner | Notes |
|--------|---------------|--------|
| **Twilio** (carrier SMS) | **`john@thetrainstation.co`** · account phone = **John’s personal cell** | **PARKED (Jul 19)** — Jeremy weighing cost vs **Messages + email hub** already built. Account started under John; address wait is optional until un-parked. Do **not** put tokens here. Cost sheet: **`VENDOR_COSTS.md`**. |
| **Zoom** (live class) | Coach Connect as **`jeremy@thetrainstation.co`** · Marketplace app credentials on Vercel (John) | Host / recordings = Jeremy’s Zoom when he Connects. |
| **Stripe** | **Master / merchant = Jeremy’s Train Station business Stripe** · Live keys on Vercel Production (John wires) | Full money-flow below. **Card Live is ON prod** (`pk_live_51SuLDr…`). John = Connect partner for fee pool later — not the card merchant. |
| **Venmo** | **Jeremy’s business Venmo** (`@JeremyByrdCSCS`) · QR on Landing store | **LIVE on prod (Jul 19)** as real-money backup. **Same Train Station business bank story as Stripe** — not a second company. Coach **Mark paid** unlocks access. |
| **Vercel / GitHub / Postgres** | **John · `john@bcxvoice.com`** (Vercel user `john-9066` · team johnepop's projects) | Deploys, env, DB. Project `train-station` → thetrainstation.co. |

**Jeremy-facing tech map:** → **`JEREMY_ADMIN_MANUAL.md`**  
**Payments training:** → **`JEREMY_VENMO_SCRIPT.md`** (2‑min see Venmo) · **`JEREMY_S5_PAYMENTS_TEST.md`** · **`STRIPE_COMMISSION_SETUP.md`** · **`STRIPE_DEMO_SCRIPT.md`** · **`PAYMENT_ADMIN_DEMO_SCRIPT.md`** · **`STRIPE_PRODUCT_CATALOG.md`**

### Money flow (durable — train every agent/human)

**One business.** Stripe card deposits and Venmo membership payments both fund the **Train Station business** (Jeremy’s merchant / bank story). Venmo is a **rail**, not a second merchant.

#### A. Stripe (card)

**Master Stripe account (merchant of record):** Jeremy’s **business Stripe account** — products, customers, bank payouts. Login = **owner email** of that Dashboard (not a social “username”). Vercel `STRIPE_*` keys **must** be from this account.

| Step | What happens |
|------|----------------|
| 1. Member pays | Card checkout (subscription **or** one-time — only two fee shapes) |
| 2. Money lands | **100%** (minus Stripe fees) → **Jeremy’s master Stripe balance** → business bank on payout schedule |
| 3. Company keeps | Most revenue on platform (“company feed”) |
| 4. **Dev & partnership fees** | **Not** at swipe. Later: Admin → **Dev & partnership** + **Connect Express** |
| 5. John’s share | **100% of fee pool** until partners change (5% MRR → 30% after $5k goal) — development & partnership fees |
| 5b. **Payout minimum** | Fee pool must reach **$400** before **Run payout**. Env: `STRIPE_COMMISSION_PAYOUT_MIN_DOLLARS` (default 400). Preview always OK. |
| 6. Test vs Live | **`sk_test_`** = fake money. Real cards only after Live keys + live `price_…` |

#### B. Venmo (backup — **live on prod**)

| Step | What happens |
|------|----------------|
| 1. Member pays | Checkout **Or pay with Venmo** — scan QR / use `@JeremyByrdCSCS` |
| 2. Money lands | **Jeremy’s Venmo** → **same business bank account story as Stripe** |
| 3. Access unlock | **Not automatic.** Coach **Admin → Members** (or Queue) → **Mark paid** → method **Venmo** |
| 4. App state | Same `paymentStatus: paid` path as Stripe (no Stripe webhook for Venmo) |

**Prod Venmo config (Landing Blob `demo/landing-media.json`):**
- QR: `https://www.thetrainstation.co/images/venmo-jeremy-qr.png` (also `public/images/venmo-jeremy-qr.png`)
- Handle: `@JeremyByrdCSCS`
- Re-seed: `npx tsx scripts/set-venmo-landing-prod.mjs`
- Verify: `/api/payments/public` → `venmo.hasQr: true`

**Fee types (product):** every paid package is **monthly subscription** or **one-time fee** (amounts can vary). See `STRIPE_PRODUCT_CATALOG.md`.

**Do not:** put a second merchant secret on Vercel for John; do not assume checkout auto-splits to John’s bank; do not treat Venmo as a different company entity.

---

## Production & deploy

| Item | Value |
|------|--------|
| **Live site** | https://www.thetrainstation.co |
| **Repo** | `train-station` · GitHub `Coachjohnepop/train-station` |
| **Production branch** | `main` only — **default: ship straight to main** (Jeremy tests only on live thetrainstation.co; few users, OK) |
| **Preview branch** | `preview` → Vercel Preview URL — optional when John wants a gated pass first |
| **Prod fallback tag** | `prod-fallback-2026-06-14` (`64807c9`) — old safety pin |
| **Data ship rule** | Commit **code + data** (`prisma/seed-data.json`, `prisma/*.dev.json`) — see Publish section below |
| **Full deploy doc** | `DEPLOY.md` |

---

## Durable product rules (don’t forget)

### Always use the database (Postgres) for app data — **non-negotiable**
**Every new module, feature, or data element that a member or coach relies on must persist in PostgreSQL (Prisma).**  
No exceptions for “quick” features, admin desks, measurements, SEO copy, hero slides, check-ins, photos metadata, or future modules.

**Production and any multi-user / coach content path stores durable state in PostgreSQL (Prisma).**  
Do not add new features that write only to JSON files, Vercel Blob JSON, localStorage, or in-memory maps as the system of record.

| Rule | Meaning |
|------|---------|
| **Default storage** | Prisma models + migrations — programs, workouts, members, measurements, SMS, payments, chat, settings, logs, ops |
| **New modules / data elements** | **Schema first** (model + migration) → API that **reads/writes DB** when `DATABASE_URL` / `POSTGRES_PRISMA_URL` is real → UI. Do not ship UI that only saves to Blob/JSON/localStorage |
| **No new blob/JSON stores** | Legacy `*-store.ts` / `prisma/*.dev.json` / Blob JSON paths are **migration debt only** — do not grow them for product state |
| **Local without DB** | Demo/JSON is a **dev fallback** when DB is unset/dummy — never the product-of-record for prod |
| **Seed files** | `prisma/seed-data.json` / `*.dev.json` are **export/import snapshots** for shipping content with code — not the runtime store on prod |
| **Secrets / media** | Env vars for keys; Blob/object storage OK for **binary files only** (images, short video) — **URLs + all fields still live in Postgres** |
| **Agent checklist** | Before coding a new surface: (1) table/columns? (2) migration? (3) write path to Prisma? (4) no sole reliance on Blob JSON? |

When in doubt: **if a coach or member would lose work when a deploy restarts, it belongs in Postgres.**  
Same bar for **new** work: if it is product data, it is a **database** concern first.

See `PERSISTENCE.md` for demo-vs-DB matrix and blob→Postgres cutover.

### Measurements (member sheet · coach visibility) — **Postgres**
All measurement product state is durable in the DB (not localStorage, not Blob JSON as source of truth).

| Data | Storage |
|------|---------|
| Each **check-in** (tape fields, weight, body fat, notes, measuredAt, source) | `UserMeasurement` |
| **Original** (all-time first) vs **Check-in** (latest entry) | Derived from `UserMeasurement` history (oldest non-null per field = original) |
| **Now** progress photo URL per check-in | `UserMeasurement.photoUrl` (file bytes on Blob; URL in DB) |
| **Before** portrait URL | `MemberProfile.beforePhotoUrl` |
| Sheet identity: gender, ageYears | `MemberProfile.gender`, `MemberProfile.ageYears` |
| Name (optional edit on sheet) | `User.name` |

APIs: `/api/member/measurements`, `/api/member/measurements/photo`, `/api/admin/members/[userId]/measurements`.  
Requires real `DATABASE_URL` — create/list **fail closed** if DB is not configured.

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

### Search / SEO (Admin → Search)
Public findability for **thetrainstation.co**. Desk: titles, OG, robots, sitemap, Google/Bing recrawl ping. Stored in Postgres `SiteSeoSettings` (Blob fallback). Third-word list (`src/lib/search-third-words.ts`) + public `/find`. **Do not expect** generic “train station” (Safari/maps/railroad) to rank — win “The Train Station fitness / workout / Jeremy Byrd / …”. Recrawl hours–days; snippets 2–14 days; third-word ranks 2–8 weeks. Preview until John ships main.

### Man / woman (product, not a sermon)
Members are **man** or **woman** only (sex). Onboard, measurements, and coach roster use those two. No third gender, no “prefer not to say” on sex, no Bible/Christian copy on the site. Paths differ (women: weight-loss goal + timeline; men: starting weight + goals). Do not add preaching.

### User feedback videos (phone recordings) — **check every session**

Drop folder:

`~/Desktop/Stuff/Lemon Voice/The Train Station/App Feedback Video/`

| Rule | Meaning |
|------|---------|
| **Look first** | List that folder by modification time at the start of a Train Station session (and any time John points at it). Newest `.mp4` / `.mov` wins unless he names a file. Two files minutes apart = one walkthrough — process both. |
| **New file = at least one issue** | If a recording was put in this folder, **assume something is still wrong.** Do not treat the path as done. Review the video (skill: `feedback-video-review` → `scripts/prepare-feedback-video-review.mjs`) and fix what you see. |
| **John says when it is perfect** | Only stop iterating this path when John explicitly says the video is perfect. Until then, keep watching new drops and keep fixing. |
| **Do not** | Claim you watched it without the review pack + frames. Do not ignore a newer file because an older one was already processed. |

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
| **`MA_AUDIT.md`** | **M&A / diligence readiness** — money, auth, audit, PII, hardening roadmap |
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
1. **Stripe Live** + webhook + one real card payment (Venmo real-money path already live)  
2. **Dev & partnership fees / Connect** if John payouts matter before revenue grows  
3. **Jeremy content** (YouTube + real Adult W1/W2)  
4. **E2E money + member path** (ticket → pay Stripe **or** Venmo → Mark paid → Adult → log sets)  
5. **Zoom / Go to Today** — working for Jeremy; coach 2…n ops checklist as needed  
6. **Messages** — quick-replies shipped; more polish only if Jeremy asks  
7. **Infra hygiene** (blob→Postgres pace, seed commits, soak scripts)  
8. **Twilio carrier SMS** — only if Jeremy decides texts are worth retainer + usage (`VENDOR_COSTS.md`)  
9. **Parked product** only when Jeremy asks (food, store, more programs)

---

### 1. Stripe — finalize money

**Money model (always true):** Master account = **Jeremy’s business Stripe**. Charge → full amount there → **development & partnership fees** via **Connect** later for John (and future partners). Details: **Stripe money flow** under People & roles above + `STRIPE_COMMISSION_SETUP.md`.

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
| **Venmo backup** | **LIVE on prod** (`hasQr: true`, `@JeremyByrdCSCS`). Same business bank as Stripe. Mark paid for access. Asset + script + docs under Money flow § B above |
| **Dev & partnership fees / Connect** | Not auto-at-checkout. Connect on Jeremy’s Stripe → John Express → Admin → **Dev & partnership**. **Min pool $400** before Run payout (`STRIPE_COMMISSION_PAYOUT_MIN_DOLLARS`). Envs still `STRIPE_COMMISSION_*` |
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

**Date:** 2026-08-16  
**Status:** Ship member mobile nav + home-kit filter to **prod (`main`)**. Man/woman (sermon-adjacent gender path) stays **preview-only** — do not merge `6a13984` to main. Checkout merchant is **Jeremy TS Live** (`acct_1TmKSWQWnajU9uyk`); leftover Eco purchases were dropped. Home kit = original 9 names + custom add-ons (Amazon titles stay on Gear). Member top nav is **Today / Messages / Scores / Gear** plus a **More** hamburger (Measure, Partners, Book Call, Account).  
**Feedback videos:** always check `~/Desktop/Stuff/Lemon Voice/The Train Station/App Feedback Video/`. A new drop means **at least one issue**. John will say when the video is perfect — do not close the path before that. Latest (2026-08-16): Free-ticket rickroll timing confirmed good. Phone screenshot still showed Amazon home-kit titles + 10px nav — this session.  
**Free concat job:** changing Admin → Videos **Free Explorer intro** queues `scripts/rebuild-free-ticket-full.mjs` (5s chorus + that intro → `free-ticket-full.mp4`). Manual: `npm run free-ticket:rebuild` or Admin **Rebuild gag + intro now**. Cron safety net every 15m. Needs `ffmpeg`.  
**Prior (2026-08-16 landing):** Guest home has **three choices only** — **Free Tour**, **Start membership**, **Explore Content** (triangle fold for programs / services / footer). White nav Join pill is gone. Explore tap = confetti + phone vibrate. Sign in lives in the hamburger.  
**Prior (2026-08-15):** Landing conversion shipped: **Join** = 7-day Coach Class look (`/signup?plan=explorer&week=1` + `grantLandingFreeWeek`), **Free Tour** stays the 15s peek. Tickets still at `/join#tickets`.  
**Prior (2026-08-14 night):** John out. Ali is mid re-onboard (still paid). She was texted to tap Free first (joke), then Coach Class → Continue already paid. Gag + Jeremy intros are site files. Paid checkout Free tap plays the gag and does not downgrade her (`ce77353`).  
**Rule reaffirmed:** **any new module / data element → Postgres first** (see Durable product rules).  
**Vercel login:** `john@bcxvoice.com` · CLI `john-9066` · team johnepop's projects.  
**Brave profile for TS work:** **TheTrainStation** (keep using this for future logins).  
**Stripe user in that profile (2026-08-16, remember this):** John Popham · login/Google **`john@bcxvoice.com`** · backup **`john@lemonvoice.com`** · phone **+1 (279) 282-4208** · 2FA authenticator (added Apr 8, 2026). Accounts on this login: **BCX Voice**, **Eco Delight Coffee**, and **TS Live** after Jeremy invite (`acct_1TmKSWQWnajU9uyk` — note one W; older notes had an extra W typo). Authenticator lives on **bcxvoice**, not `john@thetrainstation.co`.  
**Branches:** `preview` / `main` (same tip after this session) · prod: https://www.thetrainstation.co  

### Live members (2026-08-13)

| Who | Plan | Notes |
|-----|------|--------|
| **Ali Fletcher** `fletcherboys@att.net` | Coach Class paid (Aug 10, LETSGO26 ~$5) | Async/on-demand. **Re-onboard.** Texted: private window, Free joke first, then Coach Class → Continue already paid → woman → goals → book Jeremy. Temp **14-day** Today preview. Copy: `ALI_FLETCHER_SCRIPT.md`. |
| **Bella Roy** `bellaroyy03@gmail.com` | Coach Class paid (Aug 12) | **Onboard incomplete.** Same welcome retry + onboard gate. |
| **Stephanie Popham** `sprealty9@gmail.com` | Member paid | Onboard done. |
| **John Popham** `john@bcxvoice.com` | Business paid | Member smoke. Onboard done. |
| **Jeremy Byrd 2** `coachbyrd84@aol.com` | Business paid | Onboard done. |
| Coop Fletcher `cooperfletcher892@gmail.com` | Merchandise | Payment pending, onboard incomplete. |
| ~~Will / Quinn~~ | — | Purged 2026-08-12. |

**Auth note:** Jeremy + John **admin** accounts have passwords (blank login is dead). Soak scripts still try `CoachTest123!`. 2026-08-13 admin crawl used a one-shot password on `john@thetrainstation.co` then sent **Forgot password** to that inbox — John should set his own password from that email.

### Session 2026-08-13 — shipped

| Area | What | Commit / ops |
|------|------|----------------|
| **Resend off Eco** | Team **thetrainstation** (`john@thetrainstation.co`). Domain `send.thetrainstation.co` already verified. Prod `RESEND_API_KEY` = TS key (not Eco send-only). `RESEND_FROM` = `The Train Station <accounts@send.thetrainstation.co>`. `reply_to` sanitized to one address. | `3c9c536` `00044d5` `6447400` + Vercel env |
| Welcome retries | Ali + Bella welcome resent from TS domain: “IT fixed this, sorry for the duplicate.” | `9692834` `4582ed5` |
| Email/SMS voice | No em dashes / “Next step” / “— Coach Jeremy”. Sign-off **Jeremy**. John’s member texts: short lines, casual, a little incomplete is fine. Canonical Ali copy: `ALI_FLETCHER_SCRIPT.md`. | `66aee7f` |
| Onboard on resume | Login already aimed unfinished paid members at setup. Stale `ts_needs_payment` + empty-path hole let Today stay open. Sync-gates now navigates; member layout no longer treats missing pathname as exempt. | `25c28ff` |
| Site sweep | Public 79/80 (only `/free` 404). Admin crawl as John: all coach + platform pages 200 except wrong slugs `/admin/programs/athletes` + `/military` (real: `strength-training`, `boot-camp-preparation`). | — |

**Still on Eco (infra):** Stripe Live keys (`pk_live_51Su…`). Checkout says Eco Delight Coffee. Billing ~$803 available / $125 MRR is Eco’s account. Venmo already Jeremy. Partners / coffee affiliate **keep** Eco on purpose.

**Shipped 2026-08-14 (after EOD):** in-app 5s chorus + `/free` share loop. Welcome + Free Explorer intros are site files (`/videos/jeremy-welcome.mp4`, `/videos/jeremy-free-intro.mp4`). Free tap never loads YouTube.

### Workouts are Postgres only

When a real `DATABASE_URL` is set, program days, workout lines, and member workout views come from Prisma. Seed blob (`demo/seed-data.json`) and schedule-override blob are not read or written. Demo JSON is local-only if Postgres is missing.

### Paid re-onboard checkout

If someone is kicked back to setup and already paid this period, login goes to ticket picker. They tap their seat again. Checkout shows **Continue already paid** only after `resolvePaidCoverage` matches email + paid stamp + ledger/grant still in period. Different ticket still charges. File: `src/lib/paid-coverage.ts`.

### TEMP — Ali 14-day schedule preview (scale back)

**Do not forget.** `fletcherboys@att.net` can see **14 upcoming days** of Adult workouts (names + exercises) so we can verify Jeremy’s calendar. Default members stay yesterday/today/tomorrow.

- Code: `src/lib/member-schedule-preview.ts`
- Pull back after review (aim **2026-09-01**): remove her row from `OVERRIDES`.

### Session 2026-08-14 PM — onboard path (women / men / intro / measurements)

Setup no longer asks for tape. After equipment: **gender**. Women = weight-loss goal + timeline. Men = weight + goals. Last wizard step **must book** the free 15-min Calendly intro. After Jeremy marks intake complete, first tape sheet is required (`/member/measurements?first=1`). Later check-ins land on **Today like a workout block**, announced the day before (every 28 days).

### Session 2026-08-14 AM — Ali test + content gate

Ali (`fletcherboys@att.net`) onboarded 7:42 PT then hammered `/member/today`. Videos “didn’t play” because she was on **pre-intake warmup** (`videoUrl: null`), not Jeremy’s Adult day. Friday 8/14 Adult is **Shoulder/Tricep/Ab/Calves** (7). Intake no longer blocks the program player. Paid explorer stamps resolve to Coach Class. Workout fine print (set/weight labels) enlarged.

### Explicit decision 2026-08-14 — no member pull-down reload

Leave iOS/Android pull-to-refresh **off** on member screens (`DisablePullToRefresh` + `overscroll-behavior-y: none`). It is not a product feature. Do not turn it back on.

### Session 2026-08-14 EOD — shipped (on `main`)

| Area | What |
|------|------|
| Pull-down | Off on member app |
| Set progress | Postgres `LiveWorkoutSession` + local cache; empty GET cannot wipe |
| Finish workout | Phone buzz with score confetti (`99d6990`) |
| Catalog | No workout blob read/write when Postgres is live (`69226d7`) |
| Re-onboard pay | Ticket picker + **Continue already paid** after coverage check (`17b2212`) |
| Ali preview | 14 upcoming days, scale back by **2026-09-01** |
| Onboard path | Gender → women goals/timeline or men weight/goals → book Jeremy; tape after intake |

### NEXT SESSION — pick up here (priority)

**Check the feedback-video folder first** (`~/Desktop/Stuff/Lemon Voice/The Train Station/App Feedback Video/`). Newest `.mp4` / `.mov` by mtime. If a new file is there, there is at least one issue — review it before other work. Path is not done until John says the video is perfect.

**Stripe still first for money.** Log into Jeremy’s Train Station Stripe (`acct_1TmKSW…`, **Live**). Wrong account if Eco Delight / `acct_1Su…`. Don’t copy keys until the top-left name is The Train Station. Then `.env.jeremy.live` (`sk_live` / `pk_live` / prices / `whsec` + Eco `*_LEGACY`) → `node scripts/wire-jeremy-master-stripe.mjs --identify` → `--push-vercel` → redeploy. Existing Ali/Bella/Jeremy2 Eco subs stay on Eco; new charges go to Jeremy.

1. **Stripe cutover** — paste Jeremy Live keys into `.env.jeremy.live` (gitignored). Also copy current Vercel Production Eco `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` into `STRIPE_SECRET_KEY_LEGACY` / `STRIPE_WEBHOOK_SECRET_LEGACY`. Then `--identify` (must print `acct_1TmKSW…` + The Train Station) → `--push-vercel` → redeploy.  
2. **Then: Google + Apple account create/sign-in** — see decision below. Credentials only (buttons already built). Smoke: new paid signup + existing-email link.  
3. **Ali** — she re-onboards: tickets → Continue already paid → Woman → goals → book Jeremy. Then Today 14-day preview. Bella still needs onboard.  
4. **Scale back Ali 14-day preview** after Jeremy calendar check (`src/lib/member-schedule-preview.ts`).  
5. **John admin password** — use the Forgot password mail to `john@thetrainstation.co`.  
6. **Gag shipped** (`47faf4d`) — still do the phone check: signed-out Safari Free tap, then iMessage `https://www.thetrainstation.co/free` OG must be the Train Station ticket (not YouTube).  
7. **Web Push** — still `skipped_no_recipient` (0 staff device subs). Jeremy Home Screen → Enable alerts.  
8. **Zoom** — Jeremy must Connect as himself for live class.  
9. Queue cleanup: `loop-*@example.com`, Stripe E2E leftover. Weekly/dinner video slots still empty.

### Explicit decision 2026-08-13 — social login (after Stripe)

**Do this next after the Stripe key swap.** Code is already there (`OAuthButtons` on `/signup?plan=…` + `/login`; `completeOAuthSignIn`). Buttons stay hidden until env is set.

| Do | Don’t |
|----|--------|
| **Google** + **Apple** only | Facebook (coded — leave env unset) |
| Ticket pick first, then Continue with Google/Apple | Landing-hero “create account” via social |
| Keep email + password as fallback | TikTok or Instagram as identity / create-account |
| Same-email Google/Apple **links** to existing member | Merge by name if emails differ |
| Phone still collected in onboard | Treat TikTok/IG as login (they are share/megaphone only) |

**Enable:** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` + Apple (`APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY`) on Vercel → redeploy. Callback: `/api/auth/oauth/{google\|apple}/callback`. OAuth fails closed without a verified email — that is why TikTok/IG are out.

**Parked (do not un-park without explicit ask)**

- Twilio SMS (prefer Messages + Resend)  
- $400 commission Connect (after Jeremy is merchant)  
- Eco name on Stripe checkout (until key swap)  
- Facebook / TikTok / Instagram **login** (share links only)  
- **Rickroll clip license** — in-app 5s chorus is gray on purpose. Plays only on **Free Explorer**. If a rights holder writes: Admin → Videos gag kill switch (do not flip back to YouTube — embeds are too slow).  

**Re-run onboard smoke anytime:**  
`BASE_URL=https://www.thetrainstation.co node scripts/onboard-tier-loop.mjs`

### Explicit decision 2026-08-12 — Stripe merchant (interim, intentional)

**Keep Production on Eco Delight Live Stripe for now** so card checkout **works**. Do **not** block product or force Venmo-only.

| Item | Decision |
|------|----------|
| **Merchant of record (interim)** | Eco Delight Live (`pk_live_51SuLDr…` on Vercel Production) |
| **Why park Jeremy cutover** | Admin invite / 2FA / time — not worth another long Zoom; site must keep working |
| **Customer brand** | Checkout may still say Eco Delight until keys swap — accepted for now |
| **Money trail** | **FactSubscriptionPayment** + **AcctJournalEntry** (Books GL) log every card/Venmo mark-paid amount — transfer/reconcile to Jeremy’s TS Stripe later when cutover happens |
| **Venmo** | Still Jeremy `@JeremyByrdCSCS` (unchanged) |
| **$400 commission min** | **Not urgent** — fee-pool payout gate; won’t hit soon. Connect/cutover can wait |
| **Do not** | Remove Eco keys, pause card UX, or rename Eco’s Stripe business name |

**Later (when ready):** `.env.jeremy.live` with Jeremy Live `sk`/`pk`/prices/`whsec` → `scripts/wire-jeremy-master-stripe.mjs --identify` then `--push-vercel` → redeploy → verify brand name. Existing Eco subs stay on Eco; new charges after cutover on Jeremy.

### Session 2026-08-12 — shipped

**Money / accounting (earlier same day):**

| Area | What |
|------|------|
| Paid-stuck fix | Gate cookie re-sync; paid → onboard; members stay off landing |
| Payment ledger | `FactSubscriptionPayment` on checkout + Mark paid amount required |
| Books GL | Double-entry `Acct*` tables; seed COA; auto-post cash receipts; Admin → Accounting → **Books** |
| Ali Fletcher | Paid Coach Class, async/on-demand, ~$5 LETSGO26 backfilled + JE-00001 |
| Card pause | Tried then **reverted** — keep normal card UX on Eco |
| Stripe cutover | **Parked** — Eco interim (`8ba170a`) |

**Coach awareness + landing UX (afternoon):**

| Area | What | Commit-ish |
|------|------|------------|
| Purple People badges | New signups + leads next to Msgs | `8ffbe87` |
| All-channel alerts | Free/paid signup + first payment (in-app + email + push plumbing) | `6f25d8d` |
| Jelly-bean thread tabs | Compact wrap beans; per-bean unread (no side-scroll hunt) | `4841864` |
| Free Tour top nav | Guests: top **Free Tour** (opens overlay); hamburger Free Tour + Sign in; kill hero CTA pulse | `005935e` |
| Message groups access | Coach Class = Coach 1:1 + **enrolled only**; Free = Coach only; no always-on Station/Adult | `63976bc` |
| Rickroll mobile | Pin gag src; mute→single unMute; never dual YT iframes (no chorus restart) | `f2e92d3` |
| In-app chorus | Free gag is local 5s file (`/videos/free-ticket-chorus.mp4` + mp3). Play starts on the Free tap; YouTube iframe gone. | `47faf4d` |
| Free share loop | After gag: **Send this Free ticket to a friend**. Share URL is `/free` (Train Station OG + ticket art — not YouTube). Recipient taps Open → same gag. UTM `gag / share / free_ticket`. | `47faf4d` |

### Session 2026-08-05 — mobile free signup polish (still true / prior)

| Item | Detail |
|------|--------|
| **Commit** | `499de23` → `main` + `preview` |
| **Theme song** | Speaker mute sticks; no force-restart after free video / route |
| **Free ticket modal** | Video first on phone; free enroll secondary |
| **No silent Free** | Register rejects empty plan |
| **Test account** | `john@lemonvoice.com` for fresh Free signup (purge if reused) |

### Stripe master — **WRONG ACCOUNT on Production (2026-08-03)** (still open)

John reported Admin Billing shows **his** Stripe balances. That means Production `STRIPE_SECRET_KEY` is **John’s Live account** (`pk_live_51SuLDr…`), not Jeremy’s Train Station business.

| Item | Status |
|------|--------|
| **Symptom** | Money desk balances wrong; **Checkout** footer: *“authorize Eco Delight Coffee to charge you”* = Stripe **business name** on Production Live keys (not app copy) |
| **Public** | LIVE + prices ready — charges settle on **whoever owns that Live key** (currently Eco Delight Coffee account) |
| **Fix** | Point Production `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (+ prices/webhook) at **Jeremy’s Train Station Live** only → redeploy |
| **Verify** | Checkout no longer says Eco Delight; Billing master is Jeremy’s TS business |
| **John / Eco Stripe** | Not TS membership merchant. John Connect for TS fees later; Eco coffee commissions stay on Eco platform |
| **Venmo** | Still `@JeremyByrdCSCS` (separate rail) |
| **Email (2026-08-03)** | Off Eco for mail: `RESEND_FROM` / `LEAD_NOTIFY_FROM` → **john@thetrainstation.co**; `RESEND_REPLY_TO` → **jeremy@**; notify both. **Eco sponsorship UI kept** (Partners / admin Sponsorships only) |

**Helper:** `scripts/wire-jeremy-master-stripe.mjs` once `.env.jeremy.live` has his `sk_live` / `pk_live`.  
**Do not** leave Eco Delight / John `sk_live` on TS `STRIPE_SECRET_KEY`.

### Measurements (current product)
- Member **Measure** (`/member/measurements`): D&D-style sheet; key column (name/age/weight/gender/body fat); Before|Now photos; tape list (neck, chest, shoulders, biceps flexed R/L, waist, glutes/hips, upper quad pocket R/L, calf R/L); each field **Original** (left, first-ever) + **Check-in** (right, enter now); **Inscribe check-in** → `UserMeasurement` in DB.
- Coach: Admin → Members → **Measurements** (same dual layout + history).
- How-to video slot: Admin → Videos → **Measurements how-to**.

### Landing · See inside (Jul 30) — product decisions

| Rule | Decision |
|------|----------|
| Cold CTA | **See inside** (not free-first Board Now) |
| Tour | Full **auto-play** (~2s/step; set-3 hold longer for confetti); left/right arrows pause auto |
| Workout demo | Weight → set1 → set2 → **set3 + confetti** (live-console last-set) · caption **Exercise Finished.** |
| Then auto | Business Class demo → Adult program → equip blank → 5 gear → book open/day/confirm |
| End choices | **Where next?** Left → `/join?from=tour#tickets` · Right → `/join?from=tour#programs` · **Create Account & Pay** → join tickets — **wizard ends**, normal site nav |
| End layout | Top-aligned (no huge blank top); **bottom step dots** through final choice |
| After join | Members get welcome shell — **never see See inside again** |
| Pay | **Anytime** after ticket on real join/signup — we take the money |
| Start date | **Only after full onboard** |
| Free | Rickroll product gag → Jeremy free intro on join tickets |
| Theme song | Unlocks on **first click/tap anywhere** (browser policy); Free modal ducks BG music |
| Memberships nav | `/join#tickets` — ticket grid always on join |
| Programs nav | `#programs` — **live** Adult/Athletes/Military/Mom-Dads first, then waitlist |

**Key files:** `LandingSeeInsideTour.tsx` · `LandingHero.tsx` · `JoinProgramThenTickets.tsx` · `ComingSoonPrograms.tsx` · `media-volume.ts` · Admin → Videos volume steppers  

**Admin volume:** `uploadedContentVolumeDb` in landing-media blob — **±3 dB steps**, default **+6 dB** for intros. Save under Admin → Videos.

### Still open after this pass (landing)

1. **Program choice card art** — **Done:** tour “Where next?” uses `public/images/programs/choose-program-collage.jpg` (2×3: Adult, Athletes, Military, Mom&Dads, Adolescent, Speaking; real photos prioritized in crop).  
2. **Jeremy content:** free-ticket intro upload, welcome slots (Admin → Videos).  
3. Volume only fully boosts **HTML5 uploads**; YouTube capped at 100.

### Still open (not landing — durable backlog)

- Coach **phone-level notify** on signup (push never registered for Jeremy; SMS off) — Jul 27 voice.  
- Shared **needs-done** checklist productization.  
- Optional routes 404: `/pricing`, `/privacy`, `/terms`.  
- Twilio SMS **PARKED**.  
- Untracked soak scripts under `scripts/` — intentional, don’t commit.

### Free ticket product rules (John · Jul 28)

| Rule | Decision |
|------|----------|
| Guest Free | Always **5s in-app chorus file** → Jeremy Free Explorer file (`/videos/jeremy-free-intro.mp4`). No YouTube. |
| Signed-in | **No gag** — straight to Jeremy intro |
| Free product | Real Explorer path (~20% of Coach Class capabilities), not joke-only |
| Autoplay | Yes — mute-first then unMute ASAP after Free tap |
| Admin gag URL | **Not used** for Free modal (custom Shorts @ 60s broke kids); store reset to defaults |

**Kids “Free video not working”:** free-ticket + welcome slots were **empty**; gag was a **YouTube Short 60s** in admin. Code now hard-codes product gag; content still needs Admin → Videos free intro.  

### Shipped this session (prod)

| Item | Detail |
|------|--------|
| Video model | **Stored site files:** overall + free-ticket + per ticket class (Explorer / Coach / Business / 1st) + gear/measurements. **YouTube:** purchase thank-you, weekly, dinner, daily, exercises. Gag is the in-app chorus file. |
| Admin → Videos | Multi-upload library (MP4/WebM/MOV, max 200 MB, Blob client upload) → rename → assign to slots → **Save all videos**. Gag on/off + start/duration still in section 3. |
| Playback | `PlayableVideoFrame` (HTML5 for intros). Free ticket is one local file (`/videos/free-ticket-full.mp4`). Welcome slots refuse YouTube. |
| APIs | `POST /api/admin/landing-media/upload` · `GET/POST/DELETE /api/admin/site-videos/library` · store `demo/site-video-library.json` |
| Loop script | `scripts/pages-admin-videos-loop.mjs` — post-deploy verified library + upload routes **200** |
| Weeks / builder | Athletes / Military / Mom-Dads **22 weeks**; cross-program **Import week** (earlier same day) |

### Jeremy next (content, not code)

1. **Admin → Videos** — upload intros, assign Overall / Free-ticket / Coach Class / Business / etc., Save.  
2. Confirm free path: gag ~5s in-app chorus → free-ticket intro.  
3. Fill empty program week shells when ready.  
4. Session times ops: 11–12, 1–2, 2:45–3:45.

### Open / not done

- Optional marketing routes missing (404): `/pricing`, `/privacy`, `/terms`, `/partners` — not in product nav.  
- Coach notify P0 still open (push/SMS experience; Jul 27 voice note below).  
- Local-only untracked soak scripts / reports not committed (on purpose).

### Video storage model (product decision)

| Stored (upload / `public/videos`) | YouTube links |
|-----------------------------------|----------------|
| Default welcome (`/videos/jeremy-welcome.mp4`) | Purchase thank-you |
| Per ticket class welcome (`welcomeVideosByPlan`) | Weekly / dinner / daily inspiration |
| Free-ticket intro (`/videos/jeremy-free-intro.mp4`) | Exercise library demos |
| Free gag + Jeremy (`/videos/free-ticket-full.mp4`) | |
| Gear / measurements intros | |

**Library UX:** Admin → Videos — multi-upload into **Jeremy’s video library**, rename clips, then **assign** to Overall / Free-ticket / Free Explorer / Coach Class / Business Class / 1st Class. Save publishes slot URLs into landing-media.

API: `POST /api/admin/landing-media/upload` · library `/api/admin/site-videos/library`. Player: `PlayableVideoFrame` (HTML5 for intros; YouTube only for thank-you / weekly / dinner / daily).

### Jeremy voice (Jul 28) — reply checklist

| # | Ask | Status |
|---|-----|--------|
| 1 | Signup bottom “Eco Delight” / “under the rules” | Brand = **The Train Station**; footer = **Powered by Lemonvoice**. Eco only on **Partners**. Not on signup path in code. |
| 2 | Stripe payments | **Live** on prod. |
| 3 | 2-min intro + free video to promote | **Prod:** Admin → Videos library + assign. Placeholders cleared; **content not uploaded yet**. |
| 4 | Copy week Adult/Athletes → Military | **Import week from another program** in program builder. |
| 5 | Athletes / Mom & Dads only 4 weeks | **Expanded to 22 weeks** (empty shells to fill). |
| 6 | Sessions 11–12, 1–2, 2:45–3:45 | Ops note. |

### Jeremy voice-note (Jul 27) — coach notify + accountability (P0)

**His words (paraphrase kept close):**  
Did **not** get notification. Difference vs every other website: we must **hold members accountable**. He needs to be notified when **new members sign up**, and he needs to **notify them** — **email is not accountability** (most people don’t check email). If he just goes about his day he would have **no idea** someone signed up. Also need a **shared list of things that need done** so they stay on top of it and don’t circle back from forgetting. Personal: training ~3h then home (Corvette overheating hope).

| # | Ask | Why it matters | Status / fact |
|---|-----|----------------|---------------|
| 1 | **Phone-level alert when someone signs up** | Can’t coach what he doesn’t know about | Emails **did** send (see audit) but he didn’t experience them; **no web push** on his account; **newMember SMS = false** in coach prefs |
| 2 | **Notify members in a way that works** (not email-only) | Accountability product — email ≠ behavior change | In-app Messages + badge exist; **PWA Enable alerts** underused; **Twilio SMS PARKED**; need design: push + in-app + optional SMS when unparked |
| 3 | **Shared “needs done” list** | Ops memory — Queue alone not enough as a working checklist | Partial: Queue / Bookings / Members; **missing** durable coach action list (signup → equipment → start date → intro call → first workout) |
| 4 | Hold **them** accountable day-to-day | Core product differentiator vs generic fitness sites | Gamification / Today / Messages exist; **coach-initiated nudges** and **missed-day loops** still thin |

#### Prod audit (Jul 27) — “Did not get notification”

Recent real signup trail (**Lemon John** `john@lemonvoice.com`, ~Jul 26 evening PT):

| When (PT) | Outbound | To | Status |
|-----------|----------|-----|--------|
| ~7:28–9:00 PM | `lead` + `coach-newMember` **New signup** | `jeremy@thetrainstation.co` (+ john on lead) | **sent** (Resend) |
| ~9:40 PM | `coach-newMember` **finished onboarding** + lead | `jeremy@thetrainstation.co` | **sent** |
| Same windows | `push` chat-push / coach | — | **`skipped_no_recipient`** (no device) |

**CoachSettings (prod):**  
- `coachEmail` = `jeremy@thetrainstation.co`  
- `coachPhone` = `6159438400`  
- `newMember`: email **on**, sms **off**, inApp **on**  
- Stored alertPrefs missing newer keys until re-save (`equipmentSelected` / `programStartChosen` / `messagesOpened` — defaults apply in code)  

**Staff web push:**  
- `jeremy@thetrainstation.co` → **0** subscriptions  
- `john@thetrainstation.co` → **0** subscriptions  

**Root cause (ops, not “code never fired”):**  
1. **Email is invisible** during training / day — matches Jeremy’s own complaint about members.  
2. **No push device** registered for Jeremy → nothing hits the phone lock screen.  
3. **SMS off** for `newMember` even though phone is on file (and Twilio still PARKED for product SMS).  
4. In-app system notes only help if he **opens admin/Messages** — no ambient interrupt.

#### Product work implied (design + ship — ranked)

1. **Coach interrupt channel that works while he’s training**  
   - Jeremy: install PWA / home screen → **Enable alerts once** as `jeremy@thetrainstation.co`  
   - Prefer **SMS on for newMember** (even before full Twilio product path if a single coach alert number is allowed)  
   - Optional: iMessage/email secondary is fine but **not primary**  

2. **Member accountability channel (not email)**  
   - Push + in-app Messages + badge as primary nudge  
   - Coach one-tap “nudge member” from Queue/Members  
   - SMS when unparked for no-show / missed workout  

3. **Coach “Needs done” board** (shared list)  
   - Durable checklist per member: signed up · equipment · start date · intro booked · paid · first workout · coach follow-up  
   - Surfaces on Dashboard / Queue so neither John nor Jeremy forgets  
   - Tie to the funnel events we already emit  

4. **Prove notify end-to-end with Jeremy watching**  
   - Test signup → phone buzzes within seconds  
   - Log in OutboundNotification + show last notify in Admin  

**Code already shipped (still insufficient alone):** `4976417` funnel events (signup, equipment, start date, messages open) force email + staff push attempt; one-shot claims for spam control.

### John · Eco business partner (2026-07-27)

| Item | Value |
|------|--------|
| **Eco partner login** | `john@thetrainstation.co` · ref **JOHNPARTNER** · ACTIVE |
| **Stripe Connect Express** | Linked (same Express as legacy `john@bcxvoice.com` / FRESHCOFFEE) · onboarded · bank on Express |
| **Platform** | Eco Delight Coffee Live Stripe — partner draws / Eco commissions → Express → bank |
| **Not this** | Eco is **not** merchant of record for Train Station memberships (still Jeremy’s TS Stripe) |
| **TS Money desk** | Partner pool + $275 still need **Connect on Jeremy’s TS Stripe** when TS goes Live |
| **Seed script** | `eco-coffee/scripts/seed-john-business-partner.mjs` |
| **Legacy** | `john@bcxvoice.com` still holds pending Eco affiliate balance (~$47) until paid; use trainstation email going forward |

**Prior session:** Military paste/save kick-out fixed · logo white plate · soak green.

### Jeremy voice-note (Jul 26) — knock-out list

| # | Item | Owner | Status |
|---|------|--------|--------|
| 1 | Military builder kicks to Programs / paste “not saving” | Us | **Fixed in code** — root cause: after template paste, builder `GET /api/programs/[slug]` (no GET existed) so UI never reloaded new clones; editor stayed on old empty workout |
| 2 | Template paste multi-part + rename friction | Us | **Fixed** — paste grows partCount if needed; onPasted reloads + reopens Gym/Home clones; clearer rename errors |
| 3 | Logo needs white background | Us | **Fixed** — solid white plate in `TrainStationBrand` + baked into `logo.png` / icon / hero / favicon |
| 4 | Military content entry | Jeremy | Next for him after deploy |
| 5 | Adult first weeks OK · Athletes ~6 weeks | Jeremy | Leave stable |
| 6 | Mom & Dads after Military | Jeremy | Catalog slug `mom-dads-little-time` already live |
| 7 | 3 exercise video uploads | Jeremy | In progress on his side |
| 8 | Landing YouTube / phone 5-min | Jeremy | Still open |
| 9 | Stripe Live cutover | Us + keys | Still blocked on Live secret |

### Shipped this session (Jul 26)

| Piece | Notes |
|-------|--------|
| **GET `/api/programs/[slug]`** | Coach program tree for paste/refresh (was PATCH-only → silent fail) |
| **Paste reopen** | After paste: reload tree + open the new Gym/Home clones on the correct part |
| **Multi-part paste-day→next week** | Copies all parts, not just part 1 |
| **patchDay merge** | Prefer full server response (sessions/options) so multi-part never half-overwrites |
| **Logo white plate** | UI + static assets (backups under `public/images/logo-backups/*-pre-white-2026-07-26.png`) |
| **Prod deploy** | `4d4de44` on main · Ready |

### Prod soak (Jul 26 post-deploy · 4 passes each)

| Loop | Result |
|------|--------|
| **MILITARY-PASTE-LOGO** | **153/153 pass · 4 rounds** — GET program, 2-part day, template paste→part2, GET sticky clones, logo white plate · `scripts/military-paste-logo-soak.mjs` |
| **TRIPLEDAYS** | **141/141 pass · 4 rounds** — 3-part Military day structure · `scripts/tripledays-soak.mjs` |
| **site-loop-sweep** | **0 errors** · pages/APIs/nav healthy · Stripe still TEST (warn only) |
| **FULL-SITE-4-LOOP** | **462 pass · 0 fail · 48 warn** — known: Stripe TEST, Zoom disconnected, billing Stripe flaky 500s, optional /pricing|/privacy|/terms 404 |

### Eco Delight sponsorship (Jul 26)

| Item | Value |
|------|--------|
| **Member** | `/member/sponsorship` (nav: **Partners**) |
| **Coach** | `/admin/sponsorship` · commission board |
| **Affiliate email** | `jeremy@thetrainstation.co` |
| **Ref** | `TRAINSTATION` |
| **Code** | `JEREMYDISC` · 10% · 100 uses · expires ~2027-07-26 |
| **Buy link** | `https://buyecodelight.com/store/subscriptions?ref=TRAINSTATION&discount=JEREMYDISC` |
| **Eco seed** | `eco-coffee` · `scripts/seed-jeremy-trainstation-affiliate.mjs` (DB seeded) |
| **Stats API** | `GET /api/affiliate/sponsor-stats?ref=TRAINSTATION` (Eco) |
| **Commercial** | Subscriptions page 5s Jeremy spot; set `NEXT_PUBLIC_JEREMY_YT_SHORT_ID` when Short is filmed |
| **Payouts** | Jeremy Stripe Connect in Eco affiliate portal (still `stripeOnboarded: false`) |

### Suggested next (ranked)

1. **P0 — Coach phone interrupt** so Jeremy feels signup in real time (Enable alerts + SMS-on for newMember + prove E2E). See Jul 27 voice-note.  
2. **P0 — “Needs done” shared checklist** (signup → gear → start → intro → first session).  
3. **P0 — Member accountability nudges** (push/in-app primary; not email-only).  
4. **Tell Jeremy** Military paste + logo live — retry content entry.  
5. Jeremy: Eco affiliate portal + Stripe Connect for coffee commissions.  
6. **Stripe Live cutover (F1)** — still the money desk blocker.  
7. Landing YouTube / phone pass (Jeremy).

### Stripe Live — morning action (blocked)

Bootstrap `POST /api/admin/ops/stripe-bootstrap` with OPS_BOOTSTRAP_SECRET returned:

```
Invalid API Key provided: sk_live_…P7TI
```

Earlier error showed **`sk_Live_…`** (capital L) — code now normalizes `sk_Live_` → `sk_live_` (`f67b77d`). **Still invalid after normalize** → key body is wrong/revoked/truncated, or not from Train Station Live (`acct_1TmKSW…`).

**Do this morning:**
1. Stripe Dashboard **The Train Station** → toggle **Live** → Developers → API keys  
2. **Reveal / roll** secret → copy **`sk_live_…`** (all lowercase `live`)  
3. Copy **`pk_live_…`**  
4. Vercel Production: update `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (exact paste, no spaces)  
5. Redeploy  
6. Re-run bootstrap (Bearer OPS_BOOTSTRAP_SECRET) → write returned `membershipEnv` + `tipEnv` `price_…` into Vercel  
7. Live webhook `whsec_…` for `https://www.thetrainstation.co/api/stripe/webhook`  
8. Confirm `/api/payments/public` shows **`pk_live_…`**

**Do not** paste `sk_` into `STRIPE_PRICE_*` (must be `price_…` only).

### Jul 25 ship (done this stretch)

1. Coach app search + **Discount codes** nav `/admin/discounts` (prod).
2. Site sweep + cron middleware fix.
3. Coach notify: signup + intro booked (with time when known).
4. Calendly webhook code (`/api/calendly/webhook`).
5. Ops bootstrap creates membership + tip prices + FEEDBACK50 once key works.
6. Normalize `sk_Live_`/`pk_Live_` prefix casing.

### Next wake-up (suggested)

1. **Fix Live secret** (above) — unblocks everything money-related.  
2. Bootstrap → set price env → redeploy → $25 smoke.  
3. Calendly webhook signing key + subscribe.  
4. Create Live discount codes.  
5. Optional: Connect Express for $275.

### Jul 23 ship (done)

1. **Deploy batch** — coach tips (Account / Checkout / Messages soft link), mobile-only Enable alerts, coach+member set-row weight box (live floor = on-demand), tip Checkout API + webhook/confirm skip for `kind=coach_tip`.
2. **Platform admin $275** — Admin → **Dev & partnership** → **Platform admin fee** card: Preview / Pay now via Connect (`src/lib/platform-admin-fee.ts`, `POST /api/stripe/commission/platform-admin-fee`). Not the MRR pool; not gated by $400 min. Env: `STRIPE_PLATFORM_ADMIN_FEE_DOLLARS` (default 275), `STRIPE_PLATFORM_ADMIN_PARTNER_EMAIL`.
3. **Discounts** — Admin Billing %/duration/applies-to + member checkout field; free-ticket 10s chorus → Jeremy intro.
4. **Gamification prod** — Blob import + season recompute ran (Jul 23). Open claim promos exist (demo + member). Feature enabled in levers.
5. **Multi-part day UI** — already on program calendar (1/2/3 parts + part picker); not missing.

**Ops completed (2026-07-23, Test Stripe):**
- Tips **enabled** on prod (`tips.enabled: true`, presets 5/10/25/50 + custom) via server bootstrap + Vercel `STRIPE_PRICE_TIP_*`.
- **FEEDBACK50** live on Test Stripe (50% × 3 months, applies to Coach + Business products).
- Security: `SECURITY_ENFORCED=true`, `ALLOW_DEV_SWITCHER=false`, `STRIPE_REQUIRED=true` (still `ALLOW_BLANK_PASSWORD=true` for coach email login until passwords set).
- Bootstrap route: `POST /api/admin/ops/stripe-bootstrap` (staff or `OPS_BOOTSTRAP_SECRET`).
- DSAR sample exports written under `exports/` (local only). Persistence snapshot: Postgres durable.

**Agent hardening (same day, free-access):**
- Free-week promos clear payment gate (`memberNeedsPaymentAsync` / login + cookies + `requireMemberAccess`).
- Workout log API enforces free-pool / content-tier (`assertMemberCanLogWorkout`) — not UI-only.

**Still needs a human browser:**
- **Connect Express** for John (`has_connect: false`) — Admin → Dev & partnership → Connect. Required before platform admin $275 transfer.
- **Stripe Live** — later (parked).
- Landing / free-tier **Jeremy intro** YouTube — later (parked); 10s gag works alone.
- Optional verify: Account tip chip · checkout `FEEDBACK50` · Admin → Audit after Mark paid.

### Jul 23 — Discount codes (shipped in code)

- **Admin → Billing → Discounts:** % / $ · duration (once / repeating N months / forever) · **applies to** recurring | one-time | all · presets (50%×3 mo feedback, first month free, one-time 20%).
- **Member checkout:** discount field + `?promo=CODE`.
- Recurring is the real use case; one-time scope built, not required for launch.
- Create first early-cohort code after Stripe prices exist (Test or Live).

### FUTURE WORK (parked from Jul 23 planning)

*Do not lose these — reorder when priorities change.*

| # | Item | Notes |
|---|------|--------|
| F1 | **Stripe Live cutover** | **Mostly done (2026-08-03):** Jeremy Live keys + prices on Vercel Production; public LIVE + three plans ready (`pk_live_51SuLDr…`). Remaining: optional $25 smoke + webhook 200 proof; then John’s **Connect** for commission (not merchant). |
| F2 | **Workout floor polish** | Weight seeds last/guess shipped; optional later: per-set weight. |
| F3 | **Gamification free-pool / access gaps** | **Mostly closed** — free-week async gates + log API free-pool enforce. Coach still curates Adult freePool pins if wanted. |
| F4 | **Multi-part day UI** | **Shipped** on calendar (1/2/3 parts). Polish only if Jeremy asks. |
| F5 | **Jeremy content** | Real YouTube (welcome / free-tier intro after gag); real Adult W1/W2. |
| F6 | **Phone 5‑min pass** | Book Call, Messages, no false Join Live; Enable alerts once on home-screen app. |
| F7 | **Parked product** | Twilio SMS, food/store, public nutrition page, coach 2 Zoom Marketplace publish — only if asked. |
| F8 | **Discount/tip ops** | **Done on Test** — tip prices + FEEDBACK50 + tips.enabled. Live = F1. |
| F9 | **M&A hardening Phase A** | **Shipped** code + ops (security flags, tips, FEEDBACK50, DSAR samples). Remaining: Connect (browser) + Phase B Live. |

### Jul 23 — Coach tips (product homes)

| Surface | Role |
|---------|------|
| **Account → Tip Coach Jeremy** | Primary evergreen home (`#tip-coach`) |
| **Membership Checkout** | One optional tip line (prefer $10; qty min 0 to skip) |
| **Messages (coach 1:1)** | Soft link → Account |
| **Not on** | Live floor, mid-workout, bottom nav |

### Jul 21 EOD — Stripe Live cutover (still open — see F1)

**Live Stripe account id (Jeremy / The Train Station):** `acct_1TmKSWQWWnajU9uyk` (not sandbox `acct_1TmKT3…`).

### Jul 21 — Money agreements (John + Jeremy)
- **Platform admin fee → John: $275/mo AGREED** — Grok **$200/mo** + infra buffer. Separate from 5% MRR fee pool. PDF: Desktop `Train-Station-Platform-Costs-and-Admin-Fee.pdf` · `VENDOR_COSTS.md`.
- **Membership split:** 100% → Jeremy master Stripe; **5% of MRR** partner pool (John 100% of pool) via Connect later. Not auto-split at swipe.
- **Tips:** Dashboard tip product + env price IDs; optional add-on at membership Checkout (not a plan change).

### Jul 20 PM — Admin Billing desk
- **New:** Platform **Admin → Billing** (`/admin/billing`) — Overview KPIs (30d net/gross, MRR, balance), Transactions (search + full/partial refund), Refunds ledger, Discounts (create Stripe coupon + promo code, enable/disable, optional app referral map), Subscriptions list.
- APIs: `/api/admin/billing/{overview,transactions,refunds,discounts,subscriptions}` (platform staff).
- Checkout: `allow_promotion_codes` when no pre-applied referral discount.
- Billing is the money desk; partner cut UI is **Dev & partnership** (development & partnership fees; route still `/admin/commission`).

### Jul 20 PM — process-flow review (checkout / gates / coach CRUD)
- **S5 payments public smoke:** 6/6 on prod (Stripe labels, Venmo, mark-paid auth).
- **Flow APIs unauthenticated:** workouts/exercises/templates/paste/enroll/checkout/onboard → **401** (signup 400 on empty body).
- **HIGH fixed:** `memberNeedsPayment` no longer clears when `onboardingComplete` — unpaid paid-plan members who finished setup could unlock Today. Post-onboard now routes to **checkout** if still unpaid. Login deep-links cannot skip payment/onboard/pending.
- **Checkout:** already-paid plan stamp deferred until confirm/webhook (abandoned upgrade no longer mutates ticket early). Sub switch still uses proration when `stripeSubscriptionId` present; Venmo/one-time fall through to new Checkout.
- **Coach create path (code):** workout create → exercise add → template promote (title required) → paste clone with overwrite confirm — staff-gated, always-clone model intact.

### Jul 20 PM — full site page review
- **HTTP:** 0 route 404s; all admin/member pages gate to login (307); public pages 200; nav anchors `#tickets/#services/#coming-soon-programs` OK; join `#plans` OK.
- **Internal hrefs:** static scan — no dead app paths from Link/href.
- **Fixed:** join/login stale “waitlist / coming soon” copy; middleware public allowlist for `/api/landing-media`, `/api/brand/public`, `/api/push/vapid-public-key`; removed rickroll **fallback** + join plan placeholder YouTube; scrubbed **prod Blob** welcome/free-chastise that had `dQw4w9WgXcQ` (Venmo kept); Calendly placeholder → real Jeremy URL.
- **Content still for Jeremy:** real welcome + free-ticket YouTube via Admin → Landing.
- **Intentional:** `/admin/sms-hub` exists but hidden from nav (SMS parked); `/landing` → `/join`.

### Jul 20 PM — residual five (one at a time)
1. **Phone-pass surfaces** — Book Call API + Calendly, SW v3, payments/Venmo, Zoom host-only join logic verified in code/public APIs. **You still do 5-min phone pass** (Book Call UI, Account, badge, Messages, no false Join Live).
2. **Jeremy Enable alerts** — steps in Admin → Settings + `JEREMY_ADMIN_MANUAL.md`. Only **john@bcxvoice.com** subscribed until he enables once.
3. **Train whistle** — in-app message alert uses `/audio/train-whistle.mp3` (rest timer still cybertruck horn).
4. **Stripe Live prep** — expanded **Part E** in `STRIPE_DEMO_SCRIPT.md` (products, Vercel vars, one real $25). Cutover still needs Jeremy + live keys.
5. **Downgrade polish** — stronger confirm modal (Esc / backdrop), checkout `intent=downgrade` banner + CTA + cancel back to Account.

### Jul 20 — checklist pass + fixes
- **Book Call hang:** members were calling staff-only `/api/admin/contact` → stuck on “Loading booking info…”. Now `/api/bookings/contact` + Calendly fallback (`calendly.com/jeremy-thetrainstation/new-meeting`).
- **Web Push / PWA badge:** VAPID on Vercel; SW v3; Enable alerts is **one-time**; manage under Account / Settings. Only **john@bcxvoice.com** device subscribed so far — Jeremy still needs Enable once.
- **Community:** Everyone (`station`) vs by-program cohorts; coach multi-select post.
- **Zoom Join Live:** only when host actually started (not merely room exists); 2h window + End live for members.
- **Phone format:** `916.284.1994` (dots, no parens) on inputs + Leads display.
- **Member Account:** password reset, notifications, seat-art **upgrades only**, downgrade + confirm in Membership, smaller plan pill, flexed-bicep avatar for all users.
- **Loop-test fixes:** `localTodayIso` uses `APP_TIMEZONE` default **America/Los_Angeles** (Vercel UTC was shifting “today”); chat SMS defaults **off** unless explicit; ensure MemberProfile so Account doesn’t 404.
- **Content audit:** Adult has linked days through today; 4 live day templates; 0 junk workouts left; leads = Jayden (615.636.2074), Lemon, Gator, bcxvoice.
- **Money:** `/api/payments/public` → `venmo.hasQr: true`, `@JeremyByrdCSCS`; `stripeTestMode: true`.

### Jul 19 — Venmo LIVE + money manuals
- **Venmo on prod:** Blob landing media set — QR `…/images/venmo-jeremy-qr.png`, handle `@JeremyByrdCSCS`, instructions note **same Train Station business account as Stripe bank deposits**. `/api/payments/public` → `venmo.hasQr: true`.
- **Ops:** Member pays Venmo → coach **Mark paid (Venmo)** → access. No Stripe webhook for Venmo.
- **Jeremy script:** `JEREMY_VENMO_SCRIPT.md` (see checkout QR + Mark paid in 2–3 min).
- **Re-seed:** `npx tsx scripts/set-venmo-landing-prod.mjs`. Docs: this file (Money flow § B), `JEREMY_ADMIN_MANUAL.md`, `JEREMY_S5_PAYMENTS_TEST.md`, `PAYMENT_ADMIN_DEMO_SCRIPT.md`, checkout UI copy.
- **Stripe cards:** still `stripeTestMode: true` until Jeremy Live + Vercel live keys. Use Venmo for real $ now, or `4242…` for test card E2E.
- **Dev & partnership fee payout min $400:** fee pool must reach $400 before **Run payout**. `STRIPE_COMMISSION_PAYOUT_MIN_DOLLARS` default 400.
- **Zoom co-coach join:** Live room prefers Jeremy’s OAuth; non-host coaches open **join_url** (participant), not host start_url — avoids Zoom host/member login trap.
- **Earlier Jul 19 ships:** fee types subscription vs one-time; join picker fix; rest/equipment/program paste; multi-coach Zoom checklist; Messages Macros chips; multi-part Today; Twilio PARKED.

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
