# Jeremy — S5 Payments test (5 min)

**What shipped:** Stripe checkout (subscription + one-time), Venmo QR on checkout, and **Mark paid** in Admin → Members for Venmo/cash.

**Money destination:** Venmo payments and Stripe payouts both go to the **Train Station business** (same bank account story as your Stripe merchant account). Venmo is a **backup rail**, not a second company.

---

## 1. Paste your Venmo QR (one time)

1. Preferred site asset (already on the server):  
   `https://www.thetrainstation.co/images/venmo-jeremy-qr.png`  
   Or screenshot your Venmo QR and host any **https** image URL.
2. Admin → **Landing** (or `/admin/landing`).
3. Paste the image URL in **Venmo QR image**.
4. Handle: e.g. `@JeremyByrdCSCS` (whatever members should search).
5. Instructions: e.g. “Include your full name. Same business account as Stripe.”
6. **Save landing media**.
7. Open **Preview checkout** or `/member/checkout?plan=business` — **Or pay with Venmo** + QR.

John can also run: `npx tsx scripts/set-venmo-landing-prod.mjs` (uses Blob landing store).

---

## 2. Stripe test (when John turns on keys)

1. Home → tap **Coach Class** or **1st Class** ticket → sign up with a test email.
2. You should land on checkout with **Pay with Stripe**.
3. Complete Stripe test card (`4242…`) if test mode is on.
4. After payment → onboarding should unlock.

John sets these in Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MEMBER`, `STRIPE_PRICE_PRO`.

---

## 3. Venmo path (no Stripe needed)

1. Sign up for Coach Class with a second test email.
2. On checkout, scan your own QR (or skip) — member stays “pending payment”.
3. Admin → **Members** → find that member → **Mark paid**.
4. Choose **Venmo**, add a note if you want → **Confirm paid**.
5. Member should get access (onboarding / dashboard) on next page load.

---

## 4. Adult program

Adult Strength is **included** with Coach Class or 1st Class — no separate program charge. After membership is paid (Stripe or Mark paid), member can **Start** Adult from Program store.

---

## Quick pass/fail

| Check | Pass? |
|-------|-------|
| Venmo QR visible on checkout (`hasQr` on `/api/payments/public`) | ☑ live Jul 19 |
| Mark paid unlocks a Venmo signup | ☐ smoke with Jeremy |
| Same-bank story understood (Venmo ≈ Stripe business bank) | ☑ docs |
| Stripe checkout opens when keys are live | ☐ after Live cutover |
| Members list shows payment method (Venmo/Stripe) | ☐ smoke |