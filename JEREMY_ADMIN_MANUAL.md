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
| **Stripe (membership money)** | **Jeremy’s business** (merchant) · John wires code/env | Live vs Test mode is a Stripe Dashboard + Vercel setting |
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
| **Stripe** | Membership checkout, webhooks | dashboard.stripe.com | Jeremy business account (merchant of record) | John wires Live/Test keys; you track members + “mark paid” if Venmo |
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
- Connect: **Admin → Settings → Zoom**  
- Your connected profile should match **`jeremy@thetrainstation.co`** (or an allowed host John configures).  
- Recordings land on the **Zoom account that hosts** the meeting.  
- If Connect fails with “credentials” / redirect errors → John restores `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` and checks Marketplace redirect URL:  
  `https://www.thetrainstation.co/api/admin/zoom/callback`  
- Second coach on a **different** Zoom org may need the Marketplace app **published** (John).

### Stripe specifics (read once)
- Plans are membership products (e.g. Coach Class / Business / 1st Class) — **not** one Stripe product per training program.  
- **Test mode** may still be on until John flips Live keys.  
- Backup path: landing Venmo + **Members → Mark paid**.

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
