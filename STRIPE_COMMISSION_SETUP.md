# Stripe revenue split — John + Jeremy + Company

**Model (flat mode, default):** All member subscriptions bill on **Jeremy’s Train Station Stripe account**. Each month:

| Feed | Share of gross MRR | How it moves |
|------|-------------------|--------------|
| **John** | **5%** | Stripe Connect transfer |
| **Jeremy** | **20%** | Stripe Connect transfer (personal Express) |
| **Company** | **75%** | Stays on the platform Stripe account |

Example on **$1,000 MRR**: John $50, Jeremy $200, Company $750 (retained).

Until a separate company bank exists, the **company feed** and Jeremy’s business balance both live on the same Stripe account — Connect transfers still separate John’s 5% and Jeremy’s personal 20% for clean accounting.

---

## Who sets up what

| Person | Task |
|--------|------|
| **Jeremy or any admin** | Stripe Dashboard: products, prices, webhook, **Connect**, coupons/promo codes |
| **John** | Vercel env vars, deploy, Admin → Commission partners + Connect onboarding |
| **John + Jeremy** | Each completes **Connect Express** for their payout row |

---

## Step 1 — Stripe Dashboard (test mode first)

1. [dashboard.stripe.com](https://dashboard.stripe.com) → toggle **Test mode**
2. **Product catalog** → Coach Class **$25/mo**, Business Class **$50/mo**, 1st Class **$850 one-time** → copy `price_…` IDs
3. **Developers → API keys** → `sk_test_…`
4. **Developers → Webhooks** → `https://www.thetrainstation.co/api/stripe/webhook`  
   Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`  
   → copy `whsec_…`
5. **Connect → Get started** (platform/marketplace)
6. **Products → Coupons** (optional) → create referral discount → **Promotion codes** → copy `promo_…`

---

## Step 2 — Vercel env (Production + Preview)

```bash
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_MEMBER=price_…
STRIPE_PRICE_PRO=price_…
STRIPE_AUTO_APPROVE=true

STRIPE_COMMISSION_ENABLED=true
STRIPE_COMMISSION_MODE=flat
STRIPE_COMPANY_FEED_LABEL=The Train Station LLC

# Optional — auto-seed partners on first Commission load:
STRIPE_COMMISSION_SEED_JSON=[{"name":"John Popham","email":"john@thetrainstation.co","sharePercent":5},{"name":"Jeremy Byrd","email":"jeremy@thetrainstation.co","sharePercent":20}]

# Referral discounts
STRIPE_REFERRAL_DISCOUNTS_ENABLED=true
```

Redeploy after saving.

---

## Step 3 — Admin → Commission

1. **Add partners** (if not seeded): John **5%**, Jeremy **20%** — shares must total **≤ 100%**
2. Each partner → **Connect** → Stripe Express onboarding (bank + identity)
3. **Revenue feeds** card shows all three: John, Jeremy, Company (75% retained)
4. After test signups: **Preview payout** → **Run payout now**

---

## Step 4 — Referral discounts

1. Create coupon + promotion code in Stripe Dashboard (test mode)
2. Admin → Commission → **Referral discounts** → add code (e.g. `FRIEND10`) with `promo_…` id
3. Share signup link: `https://www.thetrainstation.co/signup?plan=member&ref=FRIEND10`
4. Or member enters code on `/member/checkout` before **Pay with Stripe**

Checkout also enables `allow_promotion_codes` so members can type any active Stripe promo on the Stripe page.

---

## Step 5 — Test walkthrough

1. Coach Class signup → Stripe test card `4242 4242 4242 4242`
2. Admin → Members → **paid** / **Stripe**
3. Admin → Commission → MRR shows subscription; feeds show 5% / 20% / 75%
4. John + Jeremy Connect **Ready** → Preview payout → Run payout (test transfers)
5. Stripe → Webhooks → last delivery **200**

Full member script: **`STRIPE_DEMO_SCRIPT.md`**

---

## Monthly payout automation (optional)

```bash
curl -X POST "https://www.thetrainstation.co/api/stripe/commission/payout" \
  -H "Authorization: Bearer $STRIPE_COMMISSION_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"period":"2026-06"}'
```

---

## Legacy tiered mode

Set `STRIPE_COMMISSION_MODE=tiered` for the old model (5% on first $5k MRR + 30% above, partners split that pool at 100%).

---

## Go live checklist

- [ ] Stripe **Live** mode: new products, prices, keys, webhook secret
- [ ] Live Connect onboarding for John + Jeremy
- [ ] One real $25 signup (refund after verify if desired)
- [ ] Referral promo codes recreated in Live mode
- [ ] Agree on payout calendar (e.g. 3rd of each month)