# Stripe product catalog — The Train Station

Create these in **Stripe Dashboard → Product catalog** (test mode first). Copy each **Price ID** (`price_…`) into Vercel.

## Membership subscriptions (recurring monthly)

| Product | Price | Vercel env var |
|---------|-------|----------------|
| Coach Class | $25/mo | `STRIPE_PRICE_MEMBER` |
| Business Class | $50/mo | `STRIPE_PRICE_BUSINESS` |
| 1st Class | $50/mo | `STRIPE_PRICE_PRO` |

## One-time packages

| Product | Price | Vercel env var |
|---------|-------|----------------|
| 1st Class 1-on-1 Intensive | $850.00 (8 × 1hr sessions / 30 days + full site access) | `STRIPE_PRICE_FIRST_CLASS_1ON1` |

## Merchandise (per unit)

Create one Stripe product per SKU (e.g. T-shirt, hat). Either:

- Set `stripePriceId` per item in **Admin → Platform → Offers**, or
- Use a default price: `STRIPE_PRICE_MERCH_DEFAULT`

Checkout supports quantity 1–99.

## Custom pricing (no fixed Stripe product)

| Offer | How it works |
|-------|----------------|
| **Team Consultation** | Quote flow → lead in Admin; send custom Stripe Invoice or Payment Link when priced |
| **Speaking Fee** | Same quote flow |
| **Custom Priced Training** | Coach builds offer in **Admin → Offers** → member pays via dynamic Checkout `price_data` |

## Quick Stripe steps per product

1. **Add product** → name + description
2. **Pricing** → Recurring (memberships) or One-time (intensive, merch)
3. Copy **price_…** → matching Vercel env var
4. Redeploy

## Full Vercel env block

```bash
STRIPE_PRICE_MEMBER=price_…
STRIPE_PRICE_PRO=price_…
STRIPE_PRICE_BUSINESS=price_…
STRIPE_PRICE_FIRST_CLASS_1ON1=price_…
STRIPE_PRICE_MERCH_DEFAULT=price_…   # optional default merch price
```

See also: `STRIPE_DEMO_SCRIPT.md`, `STRIPE_COMMISSION_SETUP.md`