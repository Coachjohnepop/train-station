# Stripe product catalog — The Train Station

Create these in **Stripe Dashboard → Product catalog** (test mode first). Copy each **Price ID** (`price_…`) into Vercel.

**Master account:** create products on **Jeremy’s business Stripe** (merchant of record). Charges settle there first; partner division is Connect/commission later — see `STRIPE_COMMISSION_SETUP.md`, `CONTEXT.md` (Stripe money flow), `JEREMY_ADMIN_MANUAL.md`.

## Fee types (only two)

Every paid package is one of:

| Fee type | Stripe Checkout `mode` | Examples |
|----------|------------------------|----------|
| **Monthly subscription** | `subscription` | Coach Class, Business Class |
| **One-time fee** | `payment` | 1st Class $850, custom training offer, merch |

Dollar amounts can change (Admin → Pricing). The fee type does not.

## Membership

| Product | Stripe type | Price | Vercel env var |
|---------|-------------|-------|----------------|
| Coach Class | Recurring monthly | $25 | `STRIPE_PRICE_MEMBER` |
| Business Class | Recurring monthly | $50 | `STRIPE_PRICE_BUSINESS` |
| **1st Class** | **One-time** | **$850** | `STRIPE_PRICE_PRO` |

**1st Class includes:** 8 × 1-hour private sessions with Coach Byrd (use within 30 days) + full 1st Class site access.

Legacy alias: `STRIPE_PRICE_FIRST_CLASS_1ON1` still works if already set.

## Merchandise (per unit)

One Stripe product per SKU — set `stripePriceId` per item in **Admin → Platform → Offers**, or use `STRIPE_PRICE_MERCH_DEFAULT`.

## Custom pricing (no fixed Stripe product)

| Offer | How it works |
|-------|----------------|
| **Team Consultation** | Quote flow → lead in Admin; custom Invoice when priced |
| **Speaking Fee** | Same quote flow |
| **Custom Priced Training** | **Admin → Offers** → coach sets parameters + price → checkout link |

## Vercel env block

```bash
STRIPE_PRICE_MEMBER=price_…
STRIPE_PRICE_BUSINESS=price_…
STRIPE_PRICE_PRO=price_…              # 1st Class $850 one-time
STRIPE_PRICE_MERCH_DEFAULT=price_…    # optional
```

See also: `STRIPE_DEMO_SCRIPT.md`, `STRIPE_COMMISSION_SETUP.md`

---

## Coach tip (optional cross-sell at Checkout)

Tips are **one-time** optional add-ons on membership Checkout (Coach / Business / 1st Class).  
Money still lands on **Jeremy’s master Stripe**. Does **not** change membership ticket.

### Stripe Dashboard (Live)

1. **Product catalog → + Create product**
   - Name: **Tip your coach** (or “Support the Train Station”)
   - Description: Optional tip — thank you!
2. Add **one-time** prices (recommended presets):
   - **$5**, **$10**, **$25**, **$50** (one time each)
3. Optional **custom amount** style:
   - One-time price **$1.00** named “Custom tip ($1 units)”
   - In app, quantity is adjustable 1–200 → tip $1–$200
4. Copy each **Price ID** (`price_…`).
5. (Optional) On **Coach Class** / **Business Class** product pages → **Cross-sells** → add “Tip your coach”.  
   That helps Payment Links; **our embedded Checkout uses `optional_items` + env** below.

### Vercel env (Production)

```bash
# Fixed tip chips (any subset)
STRIPE_PRICE_TIP_5=price_…
STRIPE_PRICE_TIP_10=price_…
STRIPE_PRICE_TIP_25=price_…
STRIPE_PRICE_TIP_50=price_…

# Optional: $1 unit adjustable custom tip
STRIPE_PRICE_TIP_CUSTOM=price_…

# Or comma list:
# STRIPE_PRICE_TIPS=price_a,price_b,price_c
```

Redeploy after saving. Membership Checkout will offer tips as optional line items.

**Webhook:** membership still marks paid from the subscription/session; tip amounts are extra one-time charges on the same Checkout (no plan change).