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
| **Stripe** | **Master / merchant = Jeremy’s Train Station business Stripe** · API keys on Vercel (John wires) | Full money-flow below. **Card Live cutover still open** (prod often still Test mode). |
| **Venmo** | **Jeremy’s business Venmo** (`@JeremyByrdCSCS`) · QR on Landing store | **LIVE on prod (Jul 19)** as real-money backup. **Same Train Station business bank story as Stripe** — not a second company. Coach **Mark paid** unlocks access. |
| **Vercel / GitHub / Postgres** | John | Deploys, env, DB. |

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

**Date:** 2026-07-23  
**Status:** **Venmo LIVE** · Stripe still **test mode** on prod · tips + coach weight + mobile-only alerts + platform-admin fee UI **shipped to main** · SMS **PARKED**.

### Jul 23 ship (done)

1. **Deploy batch** — coach tips (Account / Checkout / Messages soft link), mobile-only Enable alerts, coach+member set-row weight box (live floor = on-demand), tip Checkout API + webhook/confirm skip for `kind=coach_tip`.
2. **Platform admin $275** — Admin → **Dev & partnership** → **Platform admin fee** card: Preview / Pay now via Connect (`src/lib/platform-admin-fee.ts`, `POST /api/stripe/commission/platform-admin-fee`). Not the MRR pool; not gated by $400 min. Env: `STRIPE_PLATFORM_ADMIN_FEE_DOLLARS` (default 275), `STRIPE_PLATFORM_ADMIN_PARTNER_EMAIL`.

**Ops still needed (John / Jeremy keys — not blocked on code):**
- John completes **Connect Express** on his partner row when Stripe is ready (Test or Live).
- Live keys tonight: tip prices + membership prices + `sk_live`/`pk_live`/`whsec` on Vercel.
- First real **Pay platform admin** only after Connect Ready + balance on master account.

### Jul 23 — Discount codes (shipped in code)

- **Admin → Billing → Discounts:** % / $ · duration (once / repeating N months / forever) · **applies to** recurring | one-time | all · presets (50%×3 mo feedback, first month free, one-time 20%).
- **Member checkout:** discount field + `?promo=CODE`.
- Recurring is the real use case; one-time scope built, not required for launch.
- Create first early-cohort code after Stripe prices exist (Test or Live).

### FUTURE WORK (parked from Jul 23 planning)

*Do not lose these — reorder when priorities change.*

| # | Item | Notes |
|---|------|--------|
| F1 | **Stripe Live cutover** | Create Live tip + membership `price_…`; Vercel Live keys; webhook 200; real $25 smoke (refund OK). Account `acct_1TmKSWQWWnajU9uyk`. Script: `create-stripe-tip-products.mjs`. |
| F2 | **Workout floor polish** | Weight seeds last/guess shipped; optional later: per-set weight. |
| F3 | **Gamification on prod** | Recompute/import after cutover; free-pool flags; free-member claim walkthrough. Docs: `GAMIFICATION_DESIGN.md`. |
| F4 | **Multi-part day UI** | Schema exists; coach calendar “add part 2/3” still open. |
| F5 | **Jeremy content** | Real YouTube (welcome / free chastise); real Adult W1/W2. `JEREMY_REMAINING_CHECKLIST.md`. |
| F6 | **Phone 5‑min pass** | Book Call, Messages, no false Join Live; Enable alerts once on home-screen app. |
| F7 | **Parked product** | Twilio SMS, food/store, public nutrition page, coach 2 Zoom Marketplace publish — only if asked. |
| F8 | **Discount ops** | After Live keys: create `FEEDBACK50` (50% × 3 mo, recurring); share with first testers. |

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
