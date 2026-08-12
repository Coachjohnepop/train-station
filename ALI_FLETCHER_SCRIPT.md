# Ali Fletcher — recovery + on-demand path

**Account:** Ali Fletcher · `fletcherboys@att.net` · `210.478.7886`  
**Plan:** Coach Class (paid Stripe live, 2026-08-10)  
**Mode:** **On-demand only (async)** — no live Zoom sessions  
**Family note:** Coop Fletcher (`cooperfletcher892@gmail.com`) is a separate merch signup

---

## What went wrong

She paid successfully, but never landed on payment confirmation, so the browser kept a **“needs payment”** cookie. Every tap of **Today** bounced her back to checkout (“complete your ticket first”), and she wandered into public **join/programs** screens while already enrolled in Adult.

Product fix shipped: gate cookies re-sync from the DB; paid members leave checkout → onboard; logged-in members stay out of landing/join.

---

## Ops (John) — run once after deploy

```bash
cd ~/projects/train-station
node scripts/rescue-ali-fletcher-prod.mjs
# dry run first if you want:
# DRY_RUN=1 node scripts/rescue-ali-fletcher-prod.mjs
```

That script:

1. Confirms she is still **paid**
2. Sets **coaching mode = async** (on-demand only)
3. Adds coach notes so Jeremy sees “no live sessions”

Optional Admin check: **Admin → Members → Ali Fletcher** → coaching mode **Asynch**.

---

## Script for Ali (text her / call)

Hi Ali — your payment went through; the app just got stuck after checkout. Here’s the clean path:

1. Open **https://www.thetrainstation.co** on your phone  
2. **Sign in** with `fletcherboys@att.net` (same password you set)  
3. If you still see a pay screen for a second, wait or pull to refresh — you should **not** pay again  
4. Finish **setup / onboarding** (program is already Adult)  
5. After setup, use **Today** for your workouts  

**Important for your plan:** you’re set up as **on-demand only** — your own schedule and workouts in the app. You do **not** need live Zoom class times. If you ever see a “Join Live” banner, ignore it; message Jeremy if anything looks off.

Questions → Messages in the app, or Jeremy.

---

## Script for Jeremy (coach)

- Ali is **paid Coach Class**, referral `LETSGO26`, Adult enrolled W1/D1 gym  
- **On-demand / async only** — no live floor / Zoom expectation  
- She never finished onboarding; after deploy + rescue she should land in **setup**, then **Today**  
- Welcome her in **Messages** when you can (system only so far)  
- Optional: intro call only if *she* wants one — not required for on-demand path  

Admin: Members → Ali → mode **Asynch**.

---

## Verify (John, 2 min)

1. Deploy includes payment-gate + landing isolation commits  
2. `node scripts/rescue-ali-fletcher-prod.mjs` → `coachingMode = async`  
3. Incognito: log in as Ali (or she does) → **onboard**, not checkout pay wall  
4. After onboard → **Today** loads; no payment banner  
