# Jeremy — see Venmo on checkout (2–3 min)

**Site:** https://www.thetrainstation.co  
**Yes — you can see it now.** Venmo is **live** on prod. Money goes to **your business Venmo** (`@JeremyByrdCSCS`) — **same Train Station bank story as Stripe**.

---

## A. See the QR (member view)

1. Open an **incognito** window (or sign out).
2. Go to:  
   **https://www.thetrainstation.co/signup?plan=business**  
   (or home → **Business Class** ticket)
3. Sign up with a throwaway email (or log in as a **pending / unpaid** test member).
4. Land on **checkout**.
5. Look for **Or pay with Venmo**:
   - Handle **@JeremyByrdCSCS**
   - Your QR image
   - Note about same business bank as Stripe

**Pass:** QR + handle visible without using Stripe.

*(If you only see Stripe: hard-refresh, or open `/member/checkout?plan=business` while signed in as that unpaid member.)*

---

## B. See / edit the settings (coach view)

1. Log in as **`jeremy@thetrainstation.co`**.
2. **Admin → Landing** (`/admin/landing`).
3. Scroll to **Venmo** fields:
   - QR URL: `https://www.thetrainstation.co/images/venmo-jeremy-qr.png`
   - Handle: `@JeremyByrdCSCS`
4. Change only if your real Venmo handle/QR is different → **Save**.

---

## C. Unlock a member who paid Venmo (ops)

1. Member pays you on Venmo (they include **full name** in the note).
2. You: **Admin → Members** (or **Queue**).
3. Find them → **Mark paid** → method **Venmo** → Confirm.
4. They refresh → access unlocks (same as card pay).

**Remember:** Venmo does **not** auto-unlock. **Mark paid** is the unlock.

---

## Quick pass/fail

| Check | ☐ |
|-------|---|
| Checkout shows Venmo + QR | |
| Handle looks right (`@JeremyByrdCSCS` or yours) | |
| Landing admin shows same QR/handle | |
| Mark paid → member can enter | |

---

**More detail:** `JEREMY_S5_PAYMENTS_TEST.md` · `JEREMY_ADMIN_MANUAL.md` (Stripe / Venmo) · money map in `CONTEXT.md`
