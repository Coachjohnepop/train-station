# The Train Station — Admin & tech map (for Jeremy)

**Live app:** https://www.thetrainstation.co  
**Your coach login:** `jeremy@thetrainstation.co`  
**Builder / ops partner:** John (`john@thetrainstation.co`)

This is the **where does this live?** manual — not a day-to-day coaching playbook.  
Use it when something breaks, when you need a password reset on a third-party tool, or when you want to know which screen vs which vendor owns a feature.

**Related (content / checklists):**
- `JEREMY_REMAINING_CHECKLIST.md` — your content + 5‑min verify list  
- **`VENDOR_COSTS.md`** — every app we use + monthly cost / retainers (Twilio, Vercel, etc.)  
- `JEREMY_*_TEST.md` / `DEMO_SCRIPT.md` — guided walkthroughs  
- `CONTEXT.md` — engineering handoff (John + agents; not required reading)

---

## 1. Who owns what

| Area | Who | Notes |
|------|-----|--------|
| **Coaching, programs, members, live class** | **You (Jeremy)** | Day-to-day product use |
| **Code, deploys, database, env secrets** | **John** | Vercel, GitHub, Postgres, API keys |
| **Twilio (carrier SMS)** | **John** | Account email `john@thetrainstation.co`; signed up with **John’s cell** for the Twilio account phone |
| **Zoom live rooms (coach Connect)** | **You** for your Zoom login · **John** for app credentials in Vercel | You Connect Zoom inside the app; Marketplace app credentials sit on the server |
| **Stripe (membership money)** | **You (Jeremy) = master merchant account** · John wires Vercel keys + Connect payouts | Card money lands in **your** Stripe first; John’s share is a later transfer (see Stripe section) |
| **Domain / site uptime** | John (Vercel + DNS) | Report outages to John |

**Rule of thumb**
- If you can fix it **inside** https://www.thetrainstation.co → try Admin first.  
- If it needs a **vendor dashboard** (Twilio, Stripe, Zoom Marketplace, email DNS) → John usually holds keys; ask him before changing billing or production secrets.

---

## 2. In-app map (your coach console)

Sign in → left sidebar. Paths below are full URLs on prod.

### Overview
| Screen | URL | What lives here |
|--------|-----|-----------------|
| **Dashboard** | `/admin/day` | Day pick, plan/publish, roster snapshot |

### People
| Screen | URL | What lives here |
|--------|-----|-----------------|
| **Queue** | `/admin/queue` | Approvals / waiting list style work |
| **Members** | `/admin/members` | Roster, paid flags, mark paid (Venmo backup), member tools |
| **Leads** | `/admin/leads` | Landing / waitlist interest |
| **Bookings** | `/admin/bookings` | Booking-related ops + some broadcast tools |

### Talk
| Screen | URL | What lives here |
|--------|-----|-----------------|
| **Messages** | `/admin/chat` | In-app coach ↔ member chat (short video via Blob when enabled) |
| **SMS Hub** | `/admin/sms-hub` | Text-style hub: recipients, logs, broadcast. **Until Twilio is fully live, many sends are email hub / simulated, not carrier SMS.** |

### Live
| Screen | URL | What lives here |
|--------|-----|-----------------|
| **Live Floor** | `/admin/live` | Floor view for live sessions |
| **Assign** | `/admin/assign` | Assignment tooling |
| **Go to Today** | `/admin/today` | Live class: sets, Zoom embed, “show video here”, paste/build |

### Content
| Screen | URL | What lives here |
|--------|-----|-----------------|
| **Programs** | `/admin/programs` | Calendar builder, Gym/Home tracks, templates & paste (**always clones**, never share-by-reference) |
| **Workouts** | `/admin/workouts` | Workout library / shells |
| **Exercises** | `/admin/exercises` | Exercise catalog + **archive shelf** (soft delete → restore → hard delete) |
| **Prescriptions** | `/admin/prescriptions` | Prescription examples / scheme helpers |
| **Equipment** | `/admin/equipment` | Gear catalog (product photo required to publish) |

### Site
| Screen | URL | What lives here |
|--------|-----|-----------------|
| **Landing** | `/admin/landing` | Public landing copy, **YouTube links** (welcome, free-ticket chastise, weekly coach, dinner) |
| **Settings** | `/admin/settings` | Coach prefs, warm-up, **Zoom Connect / disconnect**, messaging toggles |

### Platform (staff / business — if your role sees it)
| Screen | URL | What lives here |
|--------|-----|-----------------|
| **Platform dashboard** | `/admin/platform` | Platform overview |
| **Payments** | `/admin/commission` | Stripe commission / referral UI |
| **Pricing** | `/admin/pricing` | Plan prices catalog (wired to Stripe price IDs in env) |
| **Offers** | `/admin/offers` | Promos / offers |
| **Users** | `/admin/users` | Broader user admin |
| **Reports / Insights** | `/admin/reports`, `/admin/insights` | Analytics-style views |
| **Coach suggestions** | `/admin/coach-suggestions` | Help / suggestion queue |

### Member side (what clients use)
| Screen | Approx URL | Notes |
|--------|------------|--------|
| Today | `/member/today` | Workout day, videos, rest timer, live join |
| Chat | `/member/chat` | Member messages |
| Schedule / log / equipment | under `/member/…` | Progress, gear, settings |

---

## 3. External tech stack (where the plumbing lives)

Nothing below is “inside the workout calendar.” These are the services that power the product.

| System | Purpose | Dashboard | Account / owner | What you do vs John |
|--------|---------|-----------|-----------------|---------------------|
| **The app (Next.js)** | All coach + member UI | https://www.thetrainstation.co | Deployed by John | Use daily |
| **Vercel** | Hosting, env secrets, deploys from `main` | vercel.com | John | Don’t need login for normal coaching |
| **Postgres (Supabase)** | Durable data: programs, members, SMS ledger, Zoom tokens, etc. | Supabase project (John) | John | Data edits via the **app**, not the DB UI |
| **GitHub** | Source code | `Coachjohnepop/train-station` | John | Feature requests → John |
| **Twilio** | Real carrier SMS + delivery receipts | console.twilio.com | **John** — email `john@thetrainstation.co`, account phone = **John’s cell** | You send/test from **SMS Hub** / automations; John owns number, balance, webhooks |
| **Zoom** | Live class rooms + recordings | zoom.us + marketplace.zoom.us | Your Zoom: **you** · App credentials in Vercel: **John** | **Settings → Connect Zoom** as `jeremy@…`; keep that Zoom account the class host |
| **Stripe** | Membership checkout, webhooks, bank for the business | dashboard.stripe.com | **Master = your Train Station business Stripe** (login = that account’s owner email — not a “username”) | You own products + Dashboard; John puts keys on Vercel; commission to John via Connect later |
| **Resend** | Transactional email (alerts, message hub email path) | resend.com | John | If email alerts stop, tell John |
| **Vercel Blob** | Short chat video files only | (token on Vercel) | John | Metadata still in DB |
| **Domain** | `thetrainstation.co` | DNS + Vercel | John | Site down? John |

### Twilio specifics (read once)
- **Account login email:** `john@thetrainstation.co`  
- **Account verification / owner phone:** John’s personal cell (the number used when the Twilio account was created — **not** necessarily the SMS “From” number members see)  
- **Cost:** phone number is a small **monthly retainer** + **per-text** fees (see **`VENDOR_COSTS.md`**). As of Jul 19, carrier SMS is **parked** while you decide if texts are worth paying for.  
- **Prefer for now:** **Admin → Messages** (in-app) + email alerts via the hub — already built, no Twilio bill.  
- **If you later want carrier SMS:** send John a business address for Twilio profile, then he wires keys + webhooks:  
  - Inbound: `https://www.thetrainstation.co/api/sms/inbound`  
  - Status: `https://www.thetrainstation.co/api/sms/status`  
- Members who reply **STOP** are opted out in the database; **START** re-opts in.  
- Today, **SMS Hub** may still show email-hub / non-Twilio logs (no carrier SID).

### Zoom specifics (read once)

**How it works (multi-coach):** Each coach has their **own** Zoom connection in the database, keyed by their Train Station login email. When **you** (Jeremy) start class, **your** Zoom launches — not John’s. When coach N starts class while signed in as themselves, **their** Zoom launches. Disconnect only clears **that** coach’s row.

**You (Jeremy) day-to-day:**
1. Sign in as `jeremy@thetrainstation.co`
2. **Admin → Settings → Zoom** → Connect if not already **Ready for class**
3. Prefer Zoom profile email = `jeremy@thetrainstation.co` (recordings land on the host Zoom)
4. **Go to Today** / Live Floor → start video as usual

**If Connect fails:** John checks Vercel `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` and Marketplace OAuth redirect exactly:  
`https://www.thetrainstation.co/api/admin/zoom/callback`

---

### Checklist: add coach 2…n (Zoom)

Use this every time a new coach should host live class.

#### A. Train Station account
- [ ] Create / confirm a **staff coach** login for them (email they will use daily, e.g. `name@thetrainstation.co` or their work email).
- [ ] They can sign in at https://www.thetrainstation.co/login and open **Admin → Settings**.

#### B. Host email rule (pick one)
- [ ] **Best:** Their Zoom account email **exactly matches** their Train Station login email.  
- [ ] **Or** John adds their Zoom email to Vercel `ZOOM_HOST_EMAILS` (comma list), e.g.  
  `jeremy@thetrainstation.co,john@thetrainstation.co,newcoach@…`  
- [ ] **Or** (all coaches on brand domain) set `ZOOM_ALLOW_TRAIN_STATION_DOMAIN=1` so any `@thetrainstation.co` Zoom is allowed.

#### C. Marketplace app (only if Connect fails for them)
- [ ] Same Zoom company/org as the Marketplace app owner (often Jeremy) → Development app is usually enough.  
- [ ] **Different Zoom org** (personal Zoom, other company) → Marketplace app must be **Published**; if Zoom shows separate **Production** Client ID/Secret, John puts those on Vercel and redeploys.  
- [ ] Redirect URL still: `https://www.thetrainstation.co/api/admin/zoom/callback` (and optional non-www twin if used).

#### D. They Connect (while logged in as **themselves**)
- [ ] Coach N signs into The Train Station as **their** email (not Jeremy).  
- [ ] **Admin → Settings → Zoom** → **Connect Zoom**.  
- [ ] Approve Zoom OAuth as **their** Zoom user.  
- [ ] Status shows connected / Ready; Zoom email matches expectation (or allowlist).  
- [ ] **Go to Today** → start a short test meeting — host should be **coach N’s** Zoom, not Jeremy’s.

#### E. Safety checks (do not skip)
- [ ] Jeremy still **Ready** under **his** login (his connection was not wiped).  
- [ ] **Disconnect** under coach N only removes coach N — Jeremy’s Settings still show connected.  
- [ ] Recordings for N’s session land on **N’s** Zoom account.

#### F. Optional env (John / Vercel)
| Variable | Purpose |
|----------|---------|
| `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | Marketplace OAuth app (shared by all coaches) |
| `ZOOM_HOST_EMAIL` | Primary expected host (default Jeremy) |
| `ZOOM_HOST_EMAILS` | Extra allowed Zoom emails |
| `ZOOM_ALLOW_TRAIN_STATION_DOMAIN=1` | Allow any `@thetrainstation.co` Zoom host |
| `ZOOM_MEETING_SDK_KEY` / `SECRET` | Only if embedded Meeting SDK needs them |

#### G. What you do **not** need
- Re-Connect Jeremy when adding coach N  
- A second Stripe or Twilio step for Zoom  
- Sharing Jeremy’s Zoom password with other coaches (each Connects their own)

**Deep / engineering:** `CONTEXT.md` (multi-coach Zoom) · code: `CoachZoomOAuth` per email · `src/lib/zoom-env.ts` host rules.

### Stripe specifics (read carefully — money)

**Master account:** Your **business Stripe account** for The Train Station is the **merchant of record**. Every paid member charge settles into **that** account (after Stripe’s card fees). There is no separate “John’s merchant checkout” — John is paid later, not as the card merchant.

**Login:** Stripe uses the **email that owns the Dashboard** for that business (Settings → Team / account email). We do not treat it as a social username; use whatever email you created the business Stripe with. Keys on the website (`sk_…` / `pk_…`) must be from **this same account**.

**Where the dollars go (order matters):**

1. Member chooses a package and pays with card.  
2. **100% of the payment** (minus Stripe fees) → **your master Stripe balance**.  
3. Most of it stays there as the **company / business** money.  
4. **Division is not instant at checkout.** Partner share is calculated from membership revenue (MRR rules) and paid out through **Stripe Connect** when you (or John) run **Admin → Platform → Payments / Commission** (Preview → Run payout).  
5. **John’s cut (default model):** of a **partner pool** (5% of MRR under $5k goal, then 30% of MRR), John is seeded at **100% of that pool** until you add other shareholders. He must finish **Connect Express** (bank + identity) before a transfer can succeed.

**Only two fee types (dollar amounts can change):**

| Fee type | Examples |
|----------|----------|
| **Monthly subscription** | Coach Class (~$25/mo), Business Class (~$50/mo) |
| **One-time fee** | 1st Class (~$850), custom training offer, merch |

Change amounts in **Admin → Pricing** (and Stripe product prices). Fee type stays subscription vs one-time.

**In-app money screens:**

| Screen | URL | Use |
|--------|-----|-----|
| Members | `/admin/members` | Paid / pending; **Mark paid** for Venmo |
| Pricing | `/admin/pricing` | Display + sync Stripe prices |
| Commission / Payments | `/admin/commission` | Partners, Connect, payouts |
| Landing | `/admin/landing` | Venmo QR backup |

**Test vs Live:** If the site is still on **Test mode**, cards do **not** move real money. Live money requires Live products + Live keys in Vercel (John).  

**Venmo backup (real money without Live Stripe):**
1. **Admin → Landing** → Venmo QR image URL (default site asset:  
   `https://www.thetrainstation.co/images/venmo-jeremy-qr.png`), handle, instructions → Save.  
2. Member checkout shows **Or pay with Venmo** (works even while Stripe is Test).  
3. Member pays you on Venmo (business / same bank destination as your Stripe payouts).  
4. **Admin → Members** (or Queue) → **Mark paid** → method **Venmo** → Confirm.  
5. Member access unlocks like a Stripe payment.

**Important:** Venmo and Stripe card charges both fund the **same Train Station business bank story** — Venmo is not a second company; it is just a different rail until Stripe Live is on (or for members who prefer Venmo).  

**Deep training:** `STRIPE_COMMISSION_SETUP.md`, `STRIPE_DEMO_SCRIPT.md`, `PAYMENT_ADMIN_DEMO_SCRIPT.md`, `STRIPE_PRODUCT_CATALOG.md`, `JEREMY_S5_PAYMENTS_TEST.md`.

---

## 4. “Where do I fix X?”

| Symptom / goal | First place to look |
|----------------|---------------------|
| Wrong landing videos | Admin → **Landing** |
| Adult Strength days wrong | Admin → **Programs** → Adult Strength |
| Exercise missing from pickers | Admin → **Exercises** (check **archive shelf**) |
| Paste overwrote a month | Templates & paste always **clones**; overwrite of a full pack needs confirm — tell John if that failed |
| Member can’t log in / pay | Admin → **Members** + Stripe Dashboard (John if Live keys) |
| Texts not arriving | Admin → **SMS Hub** logs → then Twilio (John: balance, From number, webhooks) |
| Zoom “not connected” / no embed | Admin → **Settings** → Connect Zoom; then **Go to Today** / Live Floor |
| Add another coach’s Zoom | See **Checklist: add coach 2…n (Zoom)** above — they Connect under **their** login |
| New coach Connect wiped Jeremy | Should not happen (per-email rows). If it did, Jeremy re-Connect; tell John to check DB `CoachZoomOAuth` |
| Member needs personal macros | **Messages** (chat) to that person — not a public Nutrition dump |
| Gear image won’t publish | Admin → **Equipment** — product needs a working photo URL |
| Site 500 / blank | John (Vercel + DB) |

---

## 5. Durable product rules (so you don’t get surprised)

1. **Database is source of truth** — coach work survives deploys (Postgres).  
2. **Always clone** when pasting Gym↔Home, week↔week, template→day, 28‑day pack→program. Source stays intact.  
3. **Archive first** for templates, packs, and exercises; hard-delete only after archive.  
4. **Template categories are freeform** (yoga, martial arts, dog training, etc.) — not only Adult/Athletes.  
5. **Don’t put joke QA names** on live member program days.  
6. **Nutrition for real clients:** after intro Zoom, capture goals → send **individual** guidance in **Messages**.

---

## 6. When to ping John (fast)

- Twilio login / number / billing / “no SID on messages”  
- Zoom Marketplace credentials, redirect URL, multi-coach publish  
- Stripe Live cutover, webhook failures, wrong price IDs  
- Domain, SSL, full site down  
- “I deleted something forever by mistake” (DB restore)  
- New feature or bug that isn’t a content typo  

**What to send him:** what you clicked, approximate time, member email if any, screenshot, and whether it was phone or desktop.

---

## 7. Quick daily paths

| Job | Path |
|-----|------|
| Build the week | Programs → day → edit Gym/Home → Save / Publish |
| Run class | Settings (Zoom connected) → **Go to Today** or Live Floor |
| Text a client | Messages (or SMS Hub when carrier SMS is live) |
| Onboard paid member | Members + Queue; confirm plan / mark paid if needed |
| Update marketing videos | Landing |

---

*Last updated: 2026-07-19 — Twilio account ownership recorded (John email + cell); Zoom/SMS still finishing prod cutover.*  
*John: keep this file in sync when vendors or owners change. Agents: also update `CONTEXT.md`.*
