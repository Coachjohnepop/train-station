# Jeremy — S5 Payments test (5 min)

**What shipped:** Stripe checkout for Coach Class ($25/mo) and 1st Class ($50/mo), Venmo QR on checkout, and **Mark paid** in Admin → Members for Venmo/cash.

---

## 1. Paste your Venmo QR (one time)

1. Screenshot your Venmo QR (or export from the Venmo app).
2. Upload the image somewhere public (Imgur, your site, Google Drive direct link).
3. Admin → **Landing** (or `/admin/landing`).
4. Paste the image URL in **Venmo QR image**.
5. Optional: add your `@handle` and a short note (“include your name”).
6. **Save landing media**.
7. Open **Preview checkout** link at the bottom — you should see your QR under “Or pay with Venmo”.

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
| Venmo QR visible on checkout after save | ☐ |
| Mark paid unlocks a Venmo signup | ☐ |
| Stripe checkout opens when keys are live | ☐ |
| Members list shows payment method (Venmo/Stripe) | ☐ |