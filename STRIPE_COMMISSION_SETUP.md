# Stripe revenue share — John + Jeremy + Company

**Also in:** `CONTEXT.md` (Stripe money flow) · `JEREMY_ADMIN_MANUAL.md` · `PAYMENT_ADMIN_DEMO_SCRIPT.md` · `STRIPE_DEMO_SCRIPT.md`

---

## Master Stripe account (read this first)

| Question | Answer |
|----------|--------|
| **Who is the master / merchant account?** | **Jeremy’s Train Station business Stripe account** — merchant of record for every member charge |
| **“Username”?** | Stripe has **no social username**. Login = **the email that owns that Stripe Dashboard** (confirm under Dashboard → Settings / Team). |
| **Where does real money land on charge?** | **100%** (minus Stripe card fees) → **Jeremy’s master Stripe balance** |
| **Does John get money at checkout?** | **No.** Division is **later** via **Stripe Connect** transfers from that master account |
| **Who puts API keys on the website?** | **John** (Vercel). Keys **must** be from Jeremy’s master account |
| **Test vs Live** | Test keys = fake money. Live keys = real bank settlement to the master account’s payout bank |
| **Venmo (same business)** | Real-money backup on checkout (`@JeremyByrdCSCS` + QR). **Same Train Station bank story** as Stripe — not a second merchant. Access via **Mark paid** (no Stripe webhook). See `CONTEXT.md` Money flow § B / `JEREMY_S5_PAYMENTS_TEST.md`. |

**Fee types members buy:** only **monthly subscription** or **one-time fee** (see `STRIPE_PRODUCT_CATALOG.md`). Commission math below is driven mainly by **subscription MRR**; one-time packages still land on the master account. Venmo Mark-paid memberships may need manual inclusion in commission ops until card Live is primary.

---

## Partner division model (milestone mode, default)

All member payments bill on **Jeremy’s Train Station Stripe account**. Partner payouts are **not** applied at the moment of sale. Each period:

| Phase | When | Partner pool | Company keeps |
|-------|------|--------------|---------------|
| **Early** | MRR below goal ($5,000 default) | **5%** of gross MRR | 95% on platform account |
| **Unlocked** | MRR at or above goal | **30%** of gross MRR | 70% on platform account |

The partner pool is **split by share %** among payout partners (Stripe Connect). For now that’s just **John at 100%** of the pool — when you sell company shares, add partners and adjust shares (must total **100%** of the pool).

**Examples**

| MRR | Active rate | Partner pool | John (100%) | Company |
|-----|-------------|--------------|-------------|---------|
| $2,500 | 5% | $125 | $125 | $2,375 |
| $5,000 | 30% (goal hit) | $1,500 | $1,500 | $3,500 |
| $8,000 | 30% | $2,400 | $2,400 | $5,600 |

Jeremy’s business balance stays on the platform Stripe account (company feed). Only partners with **Connect onboarding complete** receive transfers. **You cannot “do the division right away” at card swipe** until Connect is Ready and someone runs **Preview → Run payout** (or cron).

---

## Who sets up what

| Person | Task |
|--------|------|
| **Jeremy or any admin** | Stripe Dashboard: products, prices, webhook, **Connect**, coupons/promo codes |
| **John** | Vercel env vars, deploy, Admin → Commission partners + Connect onboarding |
| **John** | Complete **Connect Express** for his payout row |

---

## Step 1 — Stripe Dashboard

1. [dashboard.stripe.com](https://dashboard.stripe.com) → **Live mode** (or Test mode first)
2. **Product catalog** → Coach Class **$25/mo**, Business Class **$50/mo**, 1st Class **$850 one-time** → copy `price_…` IDs
3. **Developers → API keys** → `sk_live_…` / `pk_live_…`
4. **Developers → Webhooks** → `https://www.thetrainstation.co/api/stripe/webhook`  
   Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`  
   → copy `whsec_…`
5. **Connect → Get started** (platform/marketplace) — required for John’s payouts
6. **Products → Coupons** (optional) → referral discount → **Promotion codes** → copy `promo_…`

---

## Step 2 — Vercel env (Production + Preview)

```bash
STRIPE_SECRET_KEY=sk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…
STRIPE_PRICE_MEMBER=price_…
STRIPE_PRICE_BUSINESS=price_…
STRIPE_PRICE_PRO=price_…
STRIPE_AUTO_APPROVE=true

STRIPE_COMMISSION_ENABLED=true
STRIPE_COMMISSION_MODE=milestone
STRIPE_COMMISSION_TIER1_CAP_DOLLARS=5000
STRIPE_COMMISSION_TIER1_RATE=0.05
STRIPE_COMMISSION_TIER2_RATE=0.30
STRIPE_COMPANY_FEED_LABEL=The Train Station LLC

# Auto-seed John as sole pool recipient on first Commission load:
STRIPE_COMMISSION_SEED_JSON=[{"name":"John Popham","email":"john@thetrainstation.co","sharePercent":100}]

# Optional — automated monthly payout cron:
# STRIPE_COMMISSION_CRON_SECRET=…

# Referral discounts
STRIPE_REFERRAL_DISCOUNTS_ENABLED=true
```

Redeploy after saving.

---

## Step 3 — Admin → Commission

1. Open **https://www.thetrainstation.co/admin/commission**
2. Confirm **John** appears at **100%** share (or add manually)
3. John → **Connect** → Stripe Express onboarding (bank + identity)
4. **Revenue feeds** card shows: John’s est. payout + company retained %
5. After live signups: **Preview payout** → **Run payout now**

### Adding shareholders later

1. **Add partner** with name, email, share %
2. Adjust existing partners so enabled shares total **100%**
3. Each new partner completes their own **Connect** flow
4. Payouts split the partner pool automatically

---

## Step 4 — Test / go-live walkthrough

1. Coach Class signup → Stripe test/live card
2. Admin → Members → **paid** / **Stripe**
3. Admin → Commission → MRR updates; goal progress bar shows 5% vs 30% rate
4. John Connect **Ready** → Preview payout → Run payout
5. Stripe → Webhooks → last delivery **200**

Full scripts: **`STRIPE_DEMO_SCRIPT.md`**, **`PAYMENT_ADMIN_DEMO_SCRIPT.md`**

---

## Monthly payout automation (optional)

```bash
curl -X POST "https://www.thetrainstation.co/api/stripe/commission/payout" \
  -H "Authorization: Bearer $STRIPE_COMMISSION_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"period":"2026-06"}'
```

Commission admin also supports **Pay on demand** (default) vs weekly cron in payout schedule settings.

---

## Other commission modes

| Mode | Use when |
|------|----------|
| `milestone` (default) | 5% of MRR until goal, then 30% of all MRR |
| `flat` | Fixed % of gross MRR per partner (e.g. John 5%, Jeremy 20%, company 75%) |
| `tiered` | Legacy: 5% on first $5k MRR + 30% only on amount above $5k |

Set `STRIPE_COMMISSION_MODE=flat` or `tiered` to override.

---

## Go live checklist

- [ ] Stripe **Live** mode: products, prices, keys, webhook secret
- [ ] `STRIPE_COMMISSION_ENABLED=true`, `STRIPE_COMMISSION_MODE=milestone`
- [ ] John Connect **Ready** on live account
- [ ] One real $25 signup (refund after verify if desired)
- [ ] Agree on payout calendar (on-demand or monthly cron)