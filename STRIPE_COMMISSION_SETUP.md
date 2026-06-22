# Stripe commission split — John + Jeremy

**Model:** All member subscriptions bill on **Jeremy’s Train Station Stripe account**. John receives a **monthly commission transfer** via **Stripe Connect Express**, tiered on total MRR.

| MRR band | Partner rate | Example on $8,000 MRR |
|----------|--------------|------------------------|
| First **$5,000** | **5%** | $250 |
| Above **$5,000** | **30%** | $900 on the top $3,000 |
| **Total** | | **$1,150 / month** |

Formula (monthly):

```
commission = min(MRR, $5000) × 5% + max(0, MRR − $5000) × 30%
```

---

## Who sets up what

| Person | Task |
|--------|------|
| **Jeremy** | Owns the main Stripe account (products, prices, live keys in Vercel). Enables **Connect** in Stripe Dashboard. |
| **John** | Completes **Connect Express onboarding** in Admin → Commission (bank + identity for payouts). |

Jeremy does **not** need John’s Stripe login. John does **not** need Jeremy’s secret keys after Connect is linked.

---

## Step 1 — Jeremy: enable Connect on the business account

1. [dashboard.stripe.com](https://dashboard.stripe.com) → **Connect** → **Get started**
2. Choose **Platform or marketplace** (Train Station hosts members; partner gets a share)
3. Complete platform profile (Train Station / The Train Station LLC)
4. Keep **Test mode** on until both of you have verified a test payout

Main API keys stay in Vercel as today:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MEMBER` / `STRIPE_PRICE_PRO`

---

## Step 2 — John: Connect your Stripe Express account

1. Sign in to **Admin → Commission** on thetrainstation.co
2. Click **Connect my Stripe account**
3. Complete Stripe’s Express flow (legal name, DOB, bank for payouts)
4. Return to Commission — status should show **Onboarding: Complete** and **Payouts: Enabled**

Optional env (set before first click if you want a fixed email):

```bash
STRIPE_COMMISSION_PARTNER_EMAIL=john@yourdomain.com
STRIPE_COMMISSION_PARTNER_NAME="John Popham"
```

After onboarding, the linked account id is stored in blob config (or override with `STRIPE_CONNECT_PARTNER_ACCOUNT_ID=acct_…`).

---

## Step 3 — Commission env vars (Vercel)

```bash
# Tiered rates (defaults shown)
STRIPE_COMMISSION_TIER1_CAP_DOLLARS=5000
STRIPE_COMMISSION_TIER1_RATE=0.05
STRIPE_COMMISSION_TIER2_RATE=0.30
STRIPE_COMMISSION_ENABLED=true

# Optional: automated monthly payout (Vercel Cron)
STRIPE_COMMISSION_CRON_SECRET=long-random-string
```

---

## Step 4 — Monthly payout

**Manual (v1):** Admin → Commission → **Run payout now** (after month-end, when balance has settled).

**Automated:** Call once per month (e.g. 3rd of the month):

```bash
curl -X POST "https://www.thetrainstation.co/api/stripe/commission/payout" \
  -H "Authorization: Bearer $STRIPE_COMMISSION_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"period":"2026-06"}'
```

Vercel Cron example (`vercel.json`):

```json
{
  "crons": [{
    "path": "/api/stripe/commission/payout?secret=YOUR_CRON_SECRET",
    "schedule": "0 14 3 * *"
  }]
}
```

Each period is **idempotent** — the same `YYYY-MM` cannot be paid twice.

**Note:** Payout uses the **active MRR snapshot at run time**. For strict accounting, run the job on the 1st–3rd after month close (or extend later to store end-of-month snapshots).

---

## Test mode walkthrough

1. Jeremy: Connect enabled, test products live, keys in Vercel preview
2. John: Admin → Commission → Connect (test Express account)
3. Create 2–3 test Coach Class signups → MRR ~$50–$75
4. Commission → **Preview payout** → verify math
5. **Run payout now** → check Stripe → **Transfers** (test)
6. John: **Open partner Stripe dashboard** from Commission page → see test balance

---

## Go live checklist

- [ ] Jeremy: Connect enabled in **Live** mode
- [ ] Live subscription products + Vercel live keys
- [ ] John: Live Connect onboarding complete (payouts enabled)
- [ ] One real subscription + small test transfer (or first real monthly payout)
- [ ] Agree on payout calendar (e.g. 3rd business day each month)

---

## FAQ

**Why not split on every checkout?**  
Stripe’s built-in `application_fee_percent` is flat per subscription. Your deal is **tiered on total MRR**, so we calculate monthly and transfer once.

**What if MRR drops below $5,000?**  
Next month’s commission recalculates on the lower MRR — more in tier 1, less in tier 2.

**Can rates change later?**  
Update env vars (`STRIPE_COMMISSION_TIER1_RATE`, etc.) and document the effective date. Past ledger rows keep historical amounts.

**Tax / 1099?**  
Stripe Connect Express issues tax forms for connected accounts when thresholds apply — confirm with your accountant.