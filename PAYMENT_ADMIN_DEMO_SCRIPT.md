# Payment admin demo script — The Train Station

**Site:** https://www.thetrainstation.co  
**Audience:** Jeremy (coach) + John (platform) — screen share or solo walkthrough  
**Time:** ~20 min full pass; ~8 min if Stripe keys already live  
**Sign in:** Coach account at `/login` → **Admin**

## Money map (open with this)

| | |
|--|--|
| **One business** | Stripe **and** Venmo fund the **same Train Station business bank** (not two companies). |
| **Master Stripe account** | **Jeremy’s Train Station business Stripe** — merchant of record. Login = that Dashboard’s **owner email** (Stripe has no “username”). |
| **Card charge** | Full amount → **Jeremy’s Stripe** (minus fees) → business bank on payout. |
| **Venmo charge** | Member pays **@JeremyByrdCSCS** (QR on checkout) → same business bank. Access only after **Mark paid**. |
| **John’s share** | **Not at swipe.** Admin → Commission + **Connect Express**; partner pool 5%→30% of MRR (milestone); John seeded 100% of pool. |
| **Fee types** | **Monthly subscription** (Coach $25/mo, Business $50/mo) or **one-time** (1st Class $850, custom, merch). |
| **Test vs Live (cards)** | Test keys = fake cards only. **Venmo is real money** even while Stripe is Test. Live keys required for real Amex/Visa. |

**Prod Venmo (already live Jul 19):**  
QR `https://www.thetrainstation.co/images/venmo-jeremy-qr.png` · handle `@JeremyByrdCSCS` · `/api/payments/public` → `venmo.hasQr: true`.

Deep docs: `STRIPE_COMMISSION_SETUP.md`, `STRIPE_DEMO_SCRIPT.md`, `JEREMY_ADMIN_MANUAL.md`, `JEREMY_S5_PAYMENTS_TEST.md`, `CONTEXT.md`.

This script covers **all payment admin** in one place:

| Admin area | Path | Purpose |
|------------|------|---------|
| **Landing** | `/admin/landing` | Venmo QR, handle, instructions on member checkout |
| **Members** | `/admin/members` | Who signed up, payment status, **Mark paid**, approve |
| **Pricing** | `/admin/pricing` | Display amounts + sync Stripe prices (subscription vs one-time) |
| **Commission** | `/admin/commission` | Partner roster, share splits, Connect, monthly/on-demand payouts |

Member money paths (for context during demo):

- **Stripe (Test or Live)** — Coach $25/mo, Business $50/mo, 1st Class **$850 one-time** (auto **paid** via webhook + confirm when card succeeds)
- **Venmo (LIVE for real $)** — QR + `@JeremyByrdCSCS` on checkout; **same business bank as Stripe**; Jeremy **Mark paid** in Members (required for access)
- **Commission** — Partner pool from membership MRR → Connect transfer to John (not auto at checkout; cards/Live first)

---

## Before you start

### One-time (John — Vercel)

```bash
STRIPE_SECRET_KEY=sk_test_…          # or sk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_MEMBER=price_…          # Coach Class $25/mo (subscription)
STRIPE_PRICE_BUSINESS=price_…        # Business Class $50/mo (subscription)
STRIPE_PRICE_PRO=price_…             # 1st Class $850 one-time
STRIPE_AUTO_APPROVE=true             # optional — paid members skip manual approval

STRIPE_COMMISSION_ENABLED=true
STRIPE_COMMISSION_TIER1_CAP_DOLLARS=5000
STRIPE_COMMISSION_TIER1_RATE=0.05
STRIPE_COMMISSION_TIER2_RATE=0.30
STRIPE_COMMISSION_CRON_SECRET=…      # optional — automated monthly payout
```

### One-time (Jeremy — **your** master Stripe Dashboard)

1. Products on **this** account only: **Coach Class** $25/mo recurring, **Business Class** $50/mo recurring, **1st Class** $850 **one-time**  
2. Webhook → `https://www.thetrainstation.co/api/stripe/webhook`  
   Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`  
3. **Connect** enabled on **this same account** (platform) so partner transfers to John can run

### Demo prep

- [ ] Incognito window for fake member signups (`demo+1@…`, `demo+2@…`)  
- [ ] Coach logged in on **Admin** in normal window  
- [ ] Jeremy’s Venmo QR already on site (see Section 1)

---

## Section 1 — Landing: Venmo on checkout (~3 min)

**Nav:** Admin → **Landing** (`/admin/landing`)

### 1.1 Configure Venmo (Jeremy) — **already live on prod**

Skip re-save unless QR/handle changes. Current prod values:

1. **Venmo QR image:**

   ```
   https://www.thetrainstation.co/images/venmo-jeremy-qr.png
   ```

2. **Venmo handle:** `@JeremyByrdCSCS`
3. **Instructions:** include full name; same business account as Stripe bank deposits.
4. If blank on a new environment: paste above → **Save landing media** (or John: `npx tsx scripts/set-venmo-landing-prod.mjs`).

**Expected:** Checkout shows **Or pay with Venmo** + QR. Money → business bank; access after **Mark paid**.

### 1.2 Verify on checkout (anyone)

1. Open **Preview checkout (Coach Class)** link at bottom of Landing page (or incognito signup → Coach Class).
2. **Expected on `/member/checkout`:**
   - **Pay with Stripe** (if keys are set)
   - **Or pay with Venmo** — Jeremy’s QR, handle, instructions
   - If both exist, Stripe does **not** auto-redirect; member picks a method

| Check | Pass? |
|-------|-------|
| QR image loads | ☐ |
| Handle + instructions show | ☐ |
| Save persists after hard refresh on Landing admin | ☐ |

**Say:** “Venmo is the backup path — you still control access with Mark paid.”

---

## Section 2 — Members: signups, payment, approval (~5 min)

**Nav:** Admin → **Members** (`/admin/members`)

### 2.1 Dashboard read

Point out header chips:

- **Pending approval** — onboarding done, waiting for Jeremy (if `REQUIRE_MEMBER_APPROVAL=true`)
- **Awaiting payment** — Coach/1st Class signups not paid yet

Table columns:

| Column | Meaning |
|--------|---------|
| Plan | Coach Class / 1st Class / Free Explorer |
| Payment | `pending` / `paid` / `free` |
| Method | After paid: **Stripe**, **Venmo**, **Manual**, **Other** |
| Onboard | In progress vs Done |
| Approval | pending / approved |

### 2.2 Demo — Venmo member (incognito)

1. Incognito → home → **Coach Class** → sign up `venmo-demo+1@test.com`.
2. On checkout → show Venmo QR → **do not** pay on Stripe.
3. Back in Admin → **Members** → refresh.
4. **Expected:** New row, Payment **pending**, Plan **Coach Class**.

### 2.3 Mark paid (Jeremy)

1. Click **Mark paid** on that row.
2. Method: **Venmo**
3. Note: `Venmo @Jane Doe — June signup`
4. **Confirm paid**

**Expected:**

- Payment chip → **paid**
- Subtext → `via Venmo` + timestamp + note
- **Awaiting payment** count drops by 1
- Member (incognito) refreshes → onboarding / dashboard unlocks

### 2.4 Demo — Stripe member (optional, needs keys)

1. New incognito signup → Coach Class → **Pay with Stripe** → card `4242 4242 4242 4242`.
2. Admin → Members → **Expected:** **paid** / **Stripe** without Mark paid.

### 2.5 Approve (if approval gate on)

If member finished onboarding and Approval is **pending**:

1. Click **Approve**.
2. **Expected:** Approval **approved** + timestamp.

| Check | Pass? |
|-------|-------|
| Unpaid Coach signup shows **Mark paid** | ☐ |
| Mark paid → Venmo method stored | ☐ |
| Member access unlocks after mark paid | ☐ |
| Stripe signup shows paid / Stripe automatically | ☐ |

---

## Section 3 — Commission: partners & monthly split (~8 min)

**Nav:** Admin → **Commission** (`/admin/commission`)

**Model (say this once):**

> Membership MRR on Jeremy’s Stripe feeds a **commission pool**: 5% on the first $5,000 MRR, 30% above that. The pool is **split by partner share %** and paid monthly via Stripe Connect.

Example: $8,000 MRR → pool **$1,150** → John 60% = **$690**, partner B 40% = **$460**.

### 3.1 Partner roster

1. Review **Payout partners** table.
2. **Shares** badge must show **100%** before payout (amber warning if not).

**Add a partner (demo):**

| Field | Example |
|-------|---------|
| Name | John Popham |
| Email | john@… |
| Share % | 100 (or 60 if splitting later) |
| Notes | Platform commission |

Click **Add partner**.

**Edit later:** **Edit** → change share, disable partner, remove.

### 3.2 Stripe Connect per partner

For each partner row:

| Status | Action |
|--------|--------|
| **Not linked** | Click **Connect** → Stripe Express onboarding (bank, identity) |
| **Onboarding** | **Connect** again to resume |
| **Ready** | **Stripe** opens partner Express dashboard |

**Expected after Connect:** Status **Ready**, Payouts **Enabled**.

**Note:** Each person completes **their own** Connect flow — no shared passwords.

### 3.3 MRR & pool preview

Scroll to **MRR & commission pool**:

- **Current MRR** — sum of active Stripe subscriptions
- **Total commission pool** — tiered 5% / 30% calculation
- Bar — green = tier 1 band, violet = tier 2
- Partner table **Est. payout** — each partner’s share of the pool

With zero subscriptions, pool is $0 — that’s OK for demo; explain it fills as members pay on Stripe.

### 3.4 Monthly payout

1. **Preview payout** — dry run, no money moves; check partner lines in history.
2. When MRR > 0 and all partners **Ready** and shares = 100%:
3. **Run payout now** — one Stripe **Transfer** per partner.

**Expected:**

- History row: period, MRR, pool, status **paid** (or **partial** if one transfer fails)
- Per-partner amounts in **Partners** column
- Same period cannot be paid twice

**Optional automation:** Monthly cron hits `/api/stripe/commission/payout` with `STRIPE_COMMISSION_CRON_SECRET` (see `STRIPE_COMMISSION_SETUP.md`).

| Check | Pass? |
|-------|-------|
| Add / edit / remove partner | ☐ |
| Share total warns when ≠ 100% | ☐ |
| Connect onboarding completes | ☐ |
| Est. payout matches share % | ☐ |
| Preview payout works | ☐ |
| Run payout creates transfer(s) in Stripe (test mode) | ☐ |

---

## Section 4 — End-to-end story (2 min close)

**Script for Jeremy:**

1. “Member picks Coach Class on the home page.”
2. “They pay on **Stripe** or scan **your Venmo** on checkout.”
3. “**Stripe** marks them paid automatically; **Venmo** you click **Mark paid** in Members.”
4. “They onboard and start Adult — included with membership.”
5. “Once a month, **Commission** splits platform share to partners — you don’t touch that unless you add someone new to the roster.”

---

## Quick reference — admin URLs

| Task | URL |
|------|-----|
| Venmo QR | https://www.thetrainstation.co/admin/landing |
| Member payments | https://www.thetrainstation.co/admin/members |
| Commission | https://www.thetrainstation.co/admin/commission |
| Member checkout preview | https://www.thetrainstation.co/member/checkout?plan=member |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No Stripe button on checkout | `STRIPE_SECRET_KEY` or price IDs missing in Vercel |
| Paid on Stripe, still blocked | Webhook failed — Stripe Dashboard → Webhooks → 200 on `/api/stripe/webhook` |
| Venmo QR broken | URL must be direct image link; use `/images/venmo-jeremy-qr.png` |
| Mark paid missing | Only **Coach Class** / **1st Class** with payment ≠ paid |
| Commission payout blocked | Shares ≠ 100%, or partner Connect not **Ready**, or pool $0 |
| Connect button errors | Enable **Connect** on Jeremy’s Stripe account |

---

## Related docs

- `STRIPE_DEMO_SCRIPT.md` — member Stripe signup + test cards  
- `STRIPE_COMMISSION_SETUP.md` — Connect + cron + go-live  
- `JEREMY_S5_PAYMENTS_TEST.md` — Jeremy 5-min smoke test  

---

## Full admin pass/fail (one page)

| Area | Check | Pass? |
|------|-------|-------|
| Landing | Venmo QR live on checkout | ☐ |
| Members | Mark paid (Venmo) | ☐ |
| Members | Stripe auto-paid row | ☐ |
| Commission | Partner roster + 100% shares | ☐ |
| Commission | Connect Ready | ☐ |
| Commission | Preview / run payout | ☐ |