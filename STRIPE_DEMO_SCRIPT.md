# Stripe demo script — The Train Station

**Site:** https://www.thetrainstation.co  
**Who this is for:** John (setup + demo to Jeremy) or Jeremy (follow along on a screen share)  
**Time:** ~15 min first time (includes Stripe Dashboard setup); ~5 min after keys are live  

**Money flow (always teach this first):**

| | |
|--|--|
| **Master Stripe account** | **Jeremy’s business Stripe** (merchant of record). Login = that Dashboard’s **owner email** (not a “username”). |
| **On card charge** | Full payment → **Jeremy’s Stripe** (minus Stripe fees). |
| **Division to John** | **Not at checkout.** Later: Connect + Admin → Commission payout. See `STRIPE_COMMISSION_SETUP.md`. |
| **Test mode** | Fake money. Live keys required for real bank money. |

**Fee types:** only **monthly subscription** or **one-time fee**.

**Plans wired today:**

| Landing ticket | Internal plan | Fee type | Price | Stripe env var |
|----------------|---------------|----------|-------|----------------|
| Coach Class | `member` | Monthly subscription | $25/mo | `STRIPE_PRICE_MEMBER` |
| Business Class | `business` | Monthly subscription | $50/mo | `STRIPE_PRICE_BUSINESS` |
| 1st Class | `pro` | One-time fee | $850 (8×1hr / 30 days + full access) | `STRIPE_PRICE_PRO` |

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
3. **Business Class**
   - Name: `Business Class`
   - Pricing: **Recurring**, **Monthly**, **$50.00 USD**
   - Copy **Price ID** → `STRIPE_PRICE_BUSINESS`
4. **1st Class** (one-time package — not monthly)
   - Name: `1st Class`
   - Pricing: **One time**, **$850.00 USD**
   - Copy **Price ID** → `STRIPE_PRICE_PRO`

All paid packages fall under two fee types only: **monthly subscription** (`member`, `business`) or **one-time fee** (`pro`, custom training, merch).

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
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Create → reveal **Signing secret** (`whsec_…`)

### A4. Vercel environment variables

In the Train Station Vercel project → **Settings** → **Environment Variables** (Production + Preview):

| Variable | Example | Notes |
|----------|---------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_…` or `sk_live_…` | Required for checkout |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Required for auto mark-paid |
| `STRIPE_PRICE_MEMBER` | `price_…` | Coach Class $25/mo |
| `STRIPE_PRICE_BUSINESS` | `price_…` | Business Class $50/mo |
| `STRIPE_PRICE_PRO` | `price_…` | 1st Class $850 one-time |
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

### B5. Venmo backup (real money — LIVE on prod)

> “If someone prefers Venmo — or cards are still in Stripe Test — they use the QR on checkout. Money goes to the same Train Station business bank as Stripe. You mark them paid in Members — same access as a card payment.”

1. Confirm checkout shows **Or pay with Venmo** + `@JeremyByrdCSCS` (prod QR already set).  
2. Member pays on Venmo (include full name in the note).  
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

Tiered partner commission is configured separately. See **`STRIPE_COMMISSION_SETUP.md`** and the full coach walkthrough **`PAYMENT_ADMIN_DEMO_SCRIPT.md`**.

Quick path:

1. Jeremy enables **Stripe Connect** on the business account
2. **Admin → Commission** → add partners (shares = 100%) → **Connect** per row
3. After MRR exists: **Preview payout** → **Run payout now** (monthly)

---

## Part E — Go live checklist (card money)

**Status as of Aug 3, 2026:** prod is **LIVE** (`pk_live_51SuLDr…`, three memberships `stripeReady`). Jeremy Live keys + prices on Vercel Production. **Venmo** still live (`@JeremyByrdCSCS` + Mark paid). Remaining: optional $25 smoke + webhook 200; then John’s Connect for commission.

Do **with Jeremy** on a shared call when his business Stripe is ready.

### E1. Stripe Dashboard (Live mode)

1. [ ] Open [dashboard.stripe.com](https://dashboard.stripe.com) as **Jeremy’s business account**
2. [ ] Toggle **Test mode OFF** (Live)
3. [ ] **Product catalog** — create Live products/prices (new IDs; test prices do not work in Live):
   - Coach Class — recurring monthly **$25** → `STRIPE_PRICE_MEMBER`
   - Business Class — recurring monthly **$50** → `STRIPE_PRICE_BUSINESS`
   - 1st Class — one-time **$850** → `STRIPE_PRICE_PRO`
4. [ ] **Developers → API keys** — copy **Live** secret `sk_live_…` and publishable `pk_live_…`
5. [ ] **Developers → Webhooks → Add endpoint**
   - URL: `https://www.thetrainstation.co/api/stripe/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy Live signing secret `whsec_…`

### E2. Vercel (Production)

| Variable | Live value |
|----------|------------|
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` (whichever the app uses) |
| `STRIPE_WEBHOOK_SECRET` | Live `whsec_…` |
| `STRIPE_PRICE_MEMBER` | Live `price_…` $25/mo |
| `STRIPE_PRICE_BUSINESS` | Live `price_…` $50/mo |
| `STRIPE_PRICE_PRO` | Live `price_…` $850 |
| `STRIPE_AUTO_APPROVE` | optional `true` |

1. [ ] Save vars for **Production** (and Preview if you want)
2. [ ] **Redeploy** Production from `main`
3. [ ] Check `/api/payments/public` → **`stripeTestMode: false`**, all three memberships `stripeReady: true`

### E3. Prove one real payment

1. [ ] Fresh member email → Coach Class → pay with **real card** (small $25)
2. [ ] Webhook **200** in Live Dashboard
3. [ ] Admin → Members shows **paid / Stripe**
4. [ ] Refund in Stripe if it was only a smoke charge
5. [ ] Confirm Venmo path still works as backup (Mark paid)

### E4. Safety

- Do **not** leave `sk_test_` on Production after cutover
- Commission / Connect is **separate** (`STRIPE_COMMISSION_SETUP.md`) — not required for first live member charge
- Master merchant stays **Jeremy’s business Stripe**

Jeremy does **not** need website admin for Stripe keys — Vercel is John’s. He needs Dashboard for products/payouts (or invite John as team member).

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