# The Train Station — Apps, vendors & monthly costs

**Purpose:** One place for John + Jeremy to see **what we use**, **why**, and **what it costs**.  
**Last updated:** 2026-07-21  
**Currency:** USD. List prices change — treat as a planning sheet, not an invoice.  
**Actual bills:** fill the **Our plan / ~$/mo** column from Vercel / Stripe / Supabase dashboards when you open them.  
**John confirmed:** **Grok (xAI) plan = $200/mo** (on John’s card) — include in platform admin fee to reimburse from Jeremy/Stripe.

**Related:** `JEREMY_ADMIN_MANUAL.md` (where tech lives) · `CONTEXT.md` (ops handoff)

---

## Legend

| Tag | Meaning |
|-----|---------|
| **RETAINER** | Fixed or near-fixed **recurring** charge just to keep the service on (number rental, plan seat, Pro tier). Highlighted 🔴 |
| **USAGE** | Pay-as-you-go (SMS segments, API tokens, bandwidth, transaction %). Scales with traffic |
| **REV-SHARE** | Takes a cut of money you collect (Stripe fees) — not a “subscription,” but real monthly cost |
| **FREE / $0** | No monthly fee at current usage; still a dependency |
| **PARKED** | Built or half-wired; **not** paying yet / may not turn on |

---

## Snapshot (planning)

| Status | Rough fixed floor | Notes |
|--------|-------------------|--------|
| **Grok alone (John’s plan)** | **$200/mo** | Confirmed 2026-07-21 — SuperGrok / $200 plan on John’s card |
| **Lean stack + Grok** | **~$200–245/mo** | Grok $200 + free/Hobby hosting/DB + domain ~$1–2 |
| **Comfortable prod + Grok** | **~$245–280/mo** | Grok $200 + Vercel Pro ~$20 + Supabase Pro ~$25 + domain |
| **Suggested platform admin → John** | **$275/mo** starting (or **$200** pure Grok reimbursement) | Separate from 5% membership fee pool; true-up quarterly |
| **+ Twilio live** | **+~$1–5 retainer** + **USAGE** per segment | Number rental + A2P/carrier fees can raise effective $/text |
| **+ Zoom paid** | **+$0–160/mo** | Only if free 40‑min host isn’t enough |

*Fill real numbers from invoices — this table is a planning band, not accounting.*

---

## Core product stack

| App / service | What it does for us | Cost type | List / typical price | Our plan / ~$/mo | Owner | Status |
|---------------|---------------------|-----------|----------------------|------------------|-------|--------|
| **Vercel** | Hosts Next.js app, deploys `main` → prod, env secrets | 🔴 **RETAINER** (Pro seat) + USAGE | Hobby **$0**; Pro **~$20/seat/mo** (+ usage over credits) | *TBD — check team plan* | John | **Live** |
| **Supabase (Postgres)** | Durable DB (programs, members, chat ledger, Zoom tokens…) | 🔴 **RETAINER** (Pro) + USAGE | Free **$0** (pauses / limits); Pro **~$25/mo** (+ compute/storage over) | *TBD* | John | **Live** (prod DB) |
| **GitHub** | Source code `Coachjohnepop/train-station` | FREE (typical private repo) | **$0** individual; Team higher if used | **$0** expected | John | **Live** |
| **Domain** (`thetrainstation.co`) | Public brand URL | 🔴 **RETAINER** (yearly → ~monthly) | **~$12–20/yr** (~$1–2/mo) depending on registrar | *TBD* | John | **Live** |
| **Vercel Blob** | Short chat videos / binary media only | USAGE (storage + ops) | Storage ~**$0.023/GB-mo** after included; ops/transfer extra; Pro includes a free allowance | **~$0** at low volume | John | **Live** (as needed) |
| **Resend** | Transactional email + **message hub** emails (coach alerts, hub path) | FREE then 🔴 **RETAINER** | Free **3k emails/mo** (100/day); Pro **~$20/mo** (50k) | Free until volume forces Pro | John | **Live** (hub path) |
| **Stripe** | Membership checkout ($25 / $50 / $850) | **REV-SHARE** + optional 🔴 Connect | Card fees typically **~2.9% + $0.30**/successful charge (US online); Connect/payout extras if used | **$0** fixed; **% of GMV** when Live | **Master = Jeremy’s business Stripe**; John = Connect partner later | **Code live · often Test mode** |

**Money rails note:**  
- **Stripe card** → Jeremy’s master Stripe → business bank.  
- **Venmo** (LIVE) → Jeremy’s business Venmo (`@JeremyByrdCSCS`) → **same business bank story**.  
- John’s share is **not** a second merchant and **not** auto-split at checkout — Connect later (`STRIPE_COMMISSION_SETUP.md` / `CONTEXT.md` / `JEREMY_ADMIN_MANUAL.md`).
| **Zoom** | Live class embed / host | FREE or 🔴 **RETAINER** | Basic free (often **40 min** group limits); Pro/Business paid plans higher | Free host assumed unless upgraded | Jeremy account · John app credentials | **Connect path live**; Marketplace creds need restore on Vercel |
| **xAI (Grok)** | Build agent + optional in-app AI | 🔴 **RETAINER** (+ API usage if keyed) | **$200/mo** plan (John confirmed) | **$200/mo** | John | **Live — $200/mo on John’s card** |
| **Twilio** | Carrier SMS in/out, delivery receipts | 🔴 **RETAINER** (number) + **USAGE** (segments) + possible A2P fees | US long code ~**$1.15/mo**; SMS ~**$0.0079–0.0083**/segment + **carrier** fees; toll-free ~**$2.15/mo** | **$0 now — PARKED** | John (`john@thetrainstation.co`, John’s cell on account) | **PARKED** — prefer Messages / email hub |

---

## 🔴 Retainer / “always on” charges (watch list)

These bill **whether or not** members open the app that day:

| Service | What you’re paying for monthly | Avoid / reduce by |
|---------|--------------------------------|-------------------|
| **Twilio phone number** | Holding a From number even with 0 texts | **Don’t provision** until SMS is a must; keep **PARKED** |
| **Twilio A2P / brand / campaign** (if required) | Compliance registration (often one-time + possible re-verify) | Same — only when going carrier SMS |
| **Vercel Pro seat(s)** | Commercial team features / limits | Stay Hobby only if policy allows commercial; otherwise budget seat |
| **Supabase Pro** | No free-tier pause, higher limits, backups | Stay Free only while limits/pause risk is OK |
| **Resend Pro** | Higher email volume / domains | Stay Free under 3k/mo |
| **Zoom Pro+** | Longer meetings, cloud recording tiers | Stay free if 40‑min free host is OK |
| **Domain renewal** | Keep `thetrainstation.co` | Auto-renew calendar reminder |
| **GitHub Team** (only if upgraded) | Org seats | Stay free/individual if possible |

**Twilio specifically (why Jeremy is thinking twice):**  
Even “cheap” SMS is **retainer (number) + per segment + carrier fees**, plus time for business address / A2P.  
**In-app Messages + Resend email hub** = already built, **no phone retainer**.

---

## USAGE-only (no fixed phone bill)

| Service | When cost spikes | Rough unit |
|---------|------------------|------------|
| **Stripe** | Every paid signup / invoice | ~2.9% + $0.30 (confirm Dashboard) |
| **Resend** | Broadcast / many hub emails | Free until 3k/mo |
| **Vercel** | Heavy bandwidth, serverless overages, Blob transfer | After included credits |
| **Supabase** | DB size, egress, MAUs over plan | After Pro included |
| **xAI** | Coach AI features used heavily | Per 1M tokens |
| **Twilio SMS** | Every outbound/inbound segment | ~$0.01-ish + carrier (order of magnitude) |

---

## Intentionally not used / not paid (for clarity)

| Idea | Status |
|------|--------|
| Separate paid SMS SaaS (SimpleTexting, etc.) | Not in stack |
| OpenAI / Anthropic production keys | Not required; Grok/xAI optional |
| Google Maps (if `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ever set) | Optional; free tier then billing |
| Amazon product images | Hotlinked/proxied; no affiliate fee required for display |

---

## Messaging strategy (product decision)

| Channel | Cost profile | Product status |
|---------|--------------|----------------|
| **Admin → Messages** (in-app chat) | **$0** channel fee (+ Blob if video) | **Prefer — already built** |
| **Email hub** (Resend when `MESSAGE_HUB_MODE=true`) | Free tier then Resend Pro | **Default prod path today** |
| **Twilio carrier SMS** | 🔴 Number retainer + USAGE | **PARKED** (Jul 19) — revisit only if phone texts are worth the bill |

Keep `MESSAGE_HUB_MODE=true` on prod while Twilio is parked. Do not buy a Twilio number until Jeremy says SMS is worth it.

---

## How to refresh this sheet

1. Vercel → Settings → Billing  
2. Supabase → Project → Billing  
3. Resend → Billing  
4. Stripe → reports (fees, not a subscription)  
5. Domain registrar → renewal  
6. Zoom account plan page (Jeremy)  
7. Twilio Console → only if un-parked  

Update **Our plan / ~$/mo** and the date at the top. Optionally add a line to `CONTEXT.md` WHERE WE LEFT OFF when a plan tier changes.

---

## Quick decision guide

| If you want… | Pay for… | Skip… |
|--------------|----------|--------|
| Reliable multi-user prod | Vercel (as needed) + Supabase Pro when free limits hurt | Twilio |
| Coach ↔ member talk | Messages + Resend | Twilio number |
| Take real membership money | Stripe Live (fees only) | Extra SMS product |
| Live class video | Zoom (free or paid host) | Nothing SMS-related |
| Carrier SMS reminders | Twilio retainer + USAGE | — only when ROI clear |
