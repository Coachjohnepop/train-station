# Stripe demo script — The Train Station

**Site:** https://www.thetrainstation.co  
**Who this is for:** John (setup + demo to Jeremy) or Jeremy (follow along on a screen share)  
**Time:** ~15 min first time (includes Stripe Dashboard setup); ~5 min after keys are live  

**Plans wired today:**

| Landing ticket | Internal plan | Price | Stripe env var |
|----------------|---------------|-------|----------------|
| Coach Class | `member` | $25/mo | `STRIPE_PRICE_MEMBER` |
| 1st Class | `pro` | $50/mo | `STRIPE_PRICE_PRO` |

Adult Strength and other included programs unlock **after** membership is paid — no separate Stripe product yet.

---

## Part A — One-time setup (John, ~10 min)

Do this in **Stripe Test mode** first. Toggle **Test mode** on in the Stripe Dashboard (top right).

### A1. Create products & prices

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → **Product catalog** → **Add product**
2. **Coach Class**
   - Name: `Coach Class`
   - Description: `The Train Station — Coach Class membership`
   - Pricing: **Recurring**, **Monthly**, **$25.00 USD**
   - Save → open the price → copy **Price ID** (`price_…`)
3. **1st Class**
   - Name: `1st Class`
   - Pricing: **Recurring**, **Monthly**, **$50.00 USD**
   - Copy **Price ID**

### A2. API keys

1. **Developers** → **API keys**
2. Copy **Secret key** (`sk_test_…` for test, `sk_live_…` for production)

### A3. Webhook

1. **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL:
   ```
   https://www.thetrainstation.co/api/stripe/webhook
   ```
3. Select events (minimum):
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.deleted`
4. Create → reveal **Signing secret** (`whsec_…`)

### A4. Vercel environment variables

In the Train Station Vercel project → **Settings** → **Environment Variables** (Production + Preview):

| Variable | Example | Notes |
|----------|---------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_…` or `sk_live_…` | Required for checkout |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Required for auto mark-paid |
| `STRIPE_PRICE_MEMBER` | `price_…` | Coach Class $25/mo |
| `STRIPE_PRICE_PRO` | `price_…` | 1st Class $50/mo |
| `STRIPE_AUTO_APPROVE` | `true` | Optional — auto-approve member after pay |

Redeploy after saving (or wait for the deploy from the latest `main` push).

### A5. Sanity check (no browser yet)

```bash
BASE_URL=https://www.thetrainstation.co npm run test:s5
```

Expect: `payments/public` returns `stripeEnabled: true`, price labels `$25/mo` / `$50/mo`, checkout page loads.

---

## Part B — Live demo script (~5 min)

Use a **fresh email** each run (`stripe-demo+1@gmail.com`, `+2`, etc.).

### B0. Opening line (30 sec)

> “Someone picks Coach Class or 1st Class on the home page, signs up, pays on Stripe, and lands in onboarding — no manual step from you unless you want Venmo as a backup.”

### B1. Member path — Coach Class ($25)

1. Open **https://www.thetrainstation.co** (incognito is fine).
2. Scroll to tickets → tap **Coach Class** ($25/mo).
3. Complete signup (name, email, phone optional).
4. **Expected:** Redirect to `/member/checkout?plan=member`.
5. Checkout shows **Pay with Stripe** and price **$25/mo**.
   - If Venmo QR is configured, Stripe does **not** auto-open — click **Pay with Stripe**.
6. On Stripe Checkout, use test card:
   - **Card:** `4242 4242 4242 4242`
   - **Expiry:** any future date (e.g. `12/34`)
   - **CVC:** any 3 digits (e.g. `123`)
   - **ZIP:** any 5 digits
7. Complete payment.
8. **Expected:** Redirect to `/member/checkout/success` → brief “Confirming payment…” → **onboarding** (`/member/onboard?plan=member`).
9. Finish onboarding (or skip through demo fields).
10. **Expected:** Member dashboard / programs accessible — payment gate cleared.

**Say:** “That subscription is in your Stripe Dashboard under Customers → Subscriptions.”

### B2. Admin verification — Jeremy’s view

1. Sign in as coach → **Admin → Members**.
2. Find the test signup.
3. **Expected:**
   - Payment: **paid**
   - Method: **Stripe**
   - Paid timestamp shown
4. Member can open **Program store** → **Start** on Adult Strength (included with membership).

### B3. Optional — 1st Class ($50)

Repeat B1 with **1st Class** ticket and a new email.

**Expected:** Checkout shows **$50/mo**; after pay, plan shows **1st Class** in Admin → Members.

### B4. Optional — Canceled checkout

1. New signup → on checkout click **Pay with Stripe**.
2. On Stripe page click **← Back** or close.
3. **Expected:** Return to checkout with “Checkout was canceled…” and **Pay with Stripe** still available.

### B5. Optional — Venmo backup (already live)

> “If someone prefers Venmo, they use the QR on the same checkout page. You mark them paid in Members — same access as Stripe.”

1. Admin → **Landing** → Venmo QR saved.
2. Signup without paying Stripe.
3. Admin → **Members** → **Mark paid** → method **Venmo**.

---

## Part C — Stripe Dashboard tour (2 min)

Show Jeremy (or note for yourself):

1. **Home** — recent test payment volume
2. **Customers** — test member email, linked subscription
3. **Subscriptions** — active Coach Class / 1st Class
4. **Developers → Webhooks** — endpoint `…/api/stripe/webhook` — last delivery should be **200**

---

## Part D — Commission split (John)

Tiered partner commission is configured separately. See **`STRIPE_COMMISSION_SETUP.md`**.

Quick path:

1. Jeremy enables **Stripe Connect** on the business account
2. John: **Admin → Commission** → **Connect my Stripe account**
3. After MRR exists: **Preview payout** → **Run payout now** (monthly)

---

## Part E — Go live checklist

When ready for real money:

- [ ] Flip Stripe Dashboard to **Live mode**
- [ ] Recreate (or copy) products/prices in **Live** — new `price_…` IDs
- [ ] Live **Secret key** + **Webhook signing secret** in Vercel
- [ ] Update `STRIPE_PRICE_MEMBER` and `STRIPE_PRICE_PRO` to live price IDs
- [ ] Redeploy
- [ ] One real $25 signup (or refund immediately after verifying)
- [ ] Confirm webhook **200** in Live mode

Jeremy does **not** need to log into the website for Stripe — only Dashboard access if he wants to see payouts (or invite John as team member).

---

## Test cards (Stripe test mode only)

| Scenario | Card number |
|----------|-------------|
| Success | `4242 4242 4242 4242` |
| Decline | `4000 0000 0000 0002` |
| Requires authentication | `4000 0025 0000 3155` |

More: [Stripe testing docs](https://docs.stripe.com/testing)

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Checkout says “not configured” | `STRIPE_SECRET_KEY` missing or deploy not finished |
| Stripe opens but wrong amount | Wrong `STRIPE_PRICE_*` ID — must match $25 / $50 recurring price |
| Paid on Stripe but member still blocked | Webhook failed — check Vercel logs + Stripe Webhooks → event delivery; confirm `STRIPE_WEBHOOK_SECRET` |
| Stuck on “Confirming payment…” | Return URL works but `/api/stripe/confirm` failed — check member is logged in; webhook may still mark paid on retry |
| Only Venmo shows, no Stripe | `STRIPE_SECRET_KEY` not set, or price IDs missing |
| Auto-redirect to Stripe skipped | Venmo QR is configured — intentional; click **Pay with Stripe** |

---

## Local dev (optional)

```bash
# Terminal 1
npm run dev

# Terminal 2 — forward webhooks to localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use `sk_test_…` and the `whsec_…` from `stripe listen` in `.env.local`, plus test price IDs.

---

## Quick pass/fail (demo complete?)

| Step | Pass? |
|------|-------|
| Coach Class signup → Stripe → onboarding | ☐ |
| Admin → Members shows **paid** / **Stripe** | ☐ |
| Adult program **Start** works after pay | ☐ |
| Stripe Dashboard shows customer + subscription | ☐ |
| Webhook endpoint last status **200** | ☐ |