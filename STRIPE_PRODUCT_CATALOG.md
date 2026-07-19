# Stripe product catalog — The Train Station

Create these in **Stripe Dashboard → Product catalog** (test mode first). Copy each **Price ID** (`price_…`) into Vercel.

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