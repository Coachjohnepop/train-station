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

## Discount / promo codes

**Admin:** Billing → **Discounts** (`/admin/billing` → Discounts tab).  
**Member:** Checkout field + `?promo=CODE` (or `?code=` / `?ref=`).

| Lever | Notes |
|-------|--------|
| **% off** or **$ off** | Percent is the primary path for early feedback guests |
| **Duration** | `once` · `repeating` (N months) · `forever` |
| **Months** | When repeating — e.g. **50% for 3 months**, then full price |
| **Applies to** | **Recurring only** (Coach + Business) · **One-time only** (1st Class) · **All** |
| **Max redemptions** | Optional cap for early-cohort codes |

**Recommended early offer:** preset **50% × 3 mo (recurring)** → code e.g. `FEEDBACK50`.

Stripe Checkout also allows typing a code when no pre-applied promo (`allow_promotion_codes`). Pre-applied codes use `discounts[]` (no double field).

**Code path:** `createBillingDiscount` · `resolveStripePromotionCode` · checkout `promoCode`.

---

## Coach tip (optional — one-time)

Tips are **one-time** support for Coach Jeremy / The Train Station.  
Money lands on **Jeremy’s master Stripe**. Does **not** change membership ticket or `paymentStatus`.

### Where it lives in the app (smart homes)

| Surface | Behavior |
|---------|----------|
| **Account → Tip Coach Jeremy** | **Primary evergreen home** — chips $5/$10/$25/$50 + custom; embedded Checkout |
| **Membership Checkout** | One optional tip line (prefer $10 chip; qty min 0 to skip) when wallet is open |
| **Messages (coach 1:1)** | Soft text link → Account tip card (gratitude moment, not a modal) |
| **Not on** | Live floor, mid-workout, nav chrome (no nagging) |

### Stripe Dashboard (Live or Test)

1. Run (idempotent):
   ```bash
   STRIPE_SECRET_KEY='sk_…' npx tsx scripts/create-stripe-tip-products.mjs
   ```
   Or create product **Tip your coach** with one-time prices **$5 / $10 / $25 / $50** and optional **$1** custom units.
2. Copy each **Price ID** (`price_…`) into Vercel.

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

Redeploy after saving.

**APIs:** `POST /api/stripe/tip` (standalone) · membership Checkout still gets `optional_items` via `src/lib/stripe-checkout-tips.ts`.

**Webhook / confirm:** sessions with `metadata.kind=coach_tip` **never** call `markMemberPaid` (plan stays put). Optional ledger row via `factSubscriptionPayment` with `planId=coach_tip`.