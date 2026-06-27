# Jeremy — Customer demo test script

**Site:** https://www.thetrainstation.co  
**Time:** ~10 minutes (Stripe path) · ~15 minutes (Stripe + Venmo + Admin)  
**Mode:** Stripe **test mode** (no real charges)

Use this script before a customer demo or investor walkthrough.

---

## Before you start

- [ ] **Incognito / private window** for the fake member signup
- [ ] **Normal window** — you logged in as coach → **Admin**
- [ ] Fresh test email each run (`demo+coach@yourdomain.com`, `demo+biz@…`, etc.)
- [ ] Stripe Dashboard open → **Test mode** ON (toggle top right)

**Memberships on the site today:**

| Ticket | Price | Billing |
|--------|-------|---------|
| Coach Class | $25 | Monthly subscription |
| Business Class | $50 | Monthly subscription |
| 1st Class | $850 | One-time (8 sessions / 30 days + full access) |

---

## Part 1 — Stripe signup (Coach Class) · ~5 min

**Opening line:**

> “A new member picks a ticket on the home page, signs up, pays on Stripe, and lands in onboarding — no manual step from you.”

### Steps

1. Open **https://www.thetrainstation.co** (incognito).
2. Scroll to tickets → tap **Coach Class** ($25/mo).
3. Sign up:
   - Name: `Demo Member`
   - Email: fresh test address (e.g. `jeremy-demo+1@gmail.com`)
   - Password: anything you’ll remember for this run
4. **Expected:** Redirect to `/member/checkout?plan=member`.
5. Click **Continue to secure checkout** (or wait for auto-redirect if no Venmo QR).
6. On **Stripe Checkout**, enter:

   | Field | Value |
   |-------|-------|
   | Card | `4242 4242 4242 4242` |
   | Expiry | any future date (e.g. `12/34`) |
   | CVC | `123` |
   | Name on card | `Demo Member` (anything works in test mode) |
   | ZIP | `95814` (any 5 digits) |

7. Complete payment.
8. **Expected:**
   - Brief “Confirming payment…” on success page
   - Redirect to **onboarding** (`/member/onboard`)
   - After onboarding → member dashboard / programs unlock

**Say:**

> “That subscription shows up in Stripe under Customers → Subscriptions. The site marked them paid automatically — I didn’t touch Admin.”

---

## Part 2 — Admin verification · ~2 min

1. In your **coach window** → **Admin → Members**.
2. Find the test signup.
3. **Expected:**

   | Field | Value |
   |-------|-------|
   | Payment status | **paid** |
   | Payment method | **Stripe** |
   | Plan | Coach Class |

4. Optional: open **Program store** as that member (or trust the gate) — **Adult Strength** and included programs should be startable after pay.

**Pass if:** member is paid without you clicking **Mark paid**.

---

## Part 3 — Business Class (optional) · ~3 min

Repeat Part 1 with **Business Class** ($50/mo) and a **new email**.

- **Expected:** Stripe shows **$50/mo** recurring.
- Same test card `4242…`.

---

## Part 4 — 1st Class one-time (optional) · ~3 min

Repeat Part 1 with **1st Class** ($850 one-time) and a **new email**.

- **Expected:** Stripe shows **$850** one-time (not monthly).
- Same test card `4242…`.

---

## Part 5 — Venmo backup path · ~5 min

> “If someone prefers Venmo, they scan the QR on checkout. You mark them paid in Admin.”

1. Incognito → Coach Class signup with **another new email**.
2. On checkout, use **Venmo** (QR on page) — do **not** complete Stripe.
3. **Expected:** Member stays **pending payment** until you act.
4. Admin → **Members** → find member → **Mark paid**.
5. Choose **Venmo**, optional note → **Confirm paid**.
6. **Expected:** Member gets access on next page load / refresh.

**Pass if:** Venmo signup unlocks after **Mark paid** only.

---

## Test cards (Stripe test mode only)

| Scenario | Card number |
|----------|-------------|
| **Success** (use this) | `4242 4242 4242 4242` |
| Decline | `4000 0000 0000 0002` |
| Requires 3D Secure | `4000 0025 0000 3155` |

More: https://docs.stripe.com/testing

---

## Quick pass/fail checklist

| # | Check | Pass? |
|---|-------|-------|
| 1 | Coach Class checkout opens Stripe | ☐ |
| 2 | Stripe shows **$25/mo** | ☐ |
| 3 | After `4242…` → member reaches onboarding | ☐ |
| 4 | Admin → Members shows **paid / Stripe** (no manual mark) | ☐ |
| 5 | Business Class shows **$50/mo** (optional) | ☐ |
| 6 | 1st Class shows **$850** one-time (optional) | ☐ |
| 7 | Venmo path → **Mark paid** unlocks member (optional) | ☐ |

---

## If something breaks

| Symptom | What to check |
|---------|----------------|
| “Payments not configured” | John: Vercel `STRIPE_SECRET_KEY` + redeploy |
| “No such price” on checkout | Price IDs must match **your** Stripe Dashboard (copy from Product catalog → Price ID) |
| Paid on Stripe but member still blocked | Stripe → Webhooks → event delivery failed; John checks `STRIPE_WEBHOOK_SECRET` |
| Stuck on “Confirming payment…” | Refresh once; webhook may still be processing |
| Only Venmo, no Stripe button | `STRIPE_SECRET_KEY` missing or checkout error — screenshot for John |

**Live diagnostic (John):**  
`https://www.thetrainstation.co/api/payments/public` — in test mode shows `stripeDiag.memberPriceExists: true` when prices are wired correctly.

---

## What you say in the room (30-second close)

> “Pick a ticket, sign up, pay on Stripe — they’re in. Subscriptions bill through your Stripe account. Venmo is the backup; you mark paid in Members. Commission splits run from Admin when we turn that on for partners.”

---

## John’s prep (not Jeremy’s job)

- Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs, `STRIPE_AUTO_APPROVE=true`
- Webhook URL: `https://www.thetrainstation.co/api/stripe/webhook`
- Smoke test: `BASE_URL=https://www.thetrainstation.co npm run test:s5`