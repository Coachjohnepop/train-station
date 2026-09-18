# Bring Your Own Workout — platform preview (do not build yet)

**Status:** Signup door **not** public. Landing **B** asks BYOW interest only, then a real-app walk. $2.99 SKU still preview.  
**Date captured:** 2026-09-12  
**Who:** John (builder) + Jeremy (coach), after showing the app to people who already have their own workouts.

Reusable agent prompt: `docs/prompts/byow-platform-preview.prompt.md`

---

## Why this exists

John showed the girls the app. They said they don’t want Jeremy’s workout — they know what they want to do. He said: then don’t use his workout; **use the app to track it** (checkoffs, confetti, rest timers, HIIT timers). That’s the product they actually wanted.

Today:

- The **console** (sets, rest, HIT, confetti) is the habit. Analytics already say so.
- **Text / SMS paste** is built and used by the coach. Member paste is **not** live (staff-only API on purpose).
- **Free Explorer** is a lead to **know Jeremy**. Jase poked rooms, logged zero sets, never booked.
- Coach Class **$25** is still “keep Jeremy.” Landing A/B is still meet-the-coach.

BYOW is a **second story**: the app as a workout platform, with Jeremy’s programming as something you can **buy a week of** and fall back from — not the only reason to open Today.

---

## Product (phase one, when we build)

Replace “Free” as the public identity with **Bring Your Own Workout**.

1. **Month or two free** of BYOW: paste (or type) today’s work, check it off on Today. Attract people who already train.
2. Then **keep using the app** ≈ **$2.99/mo** (web Stripe first; App Store later if the platform is real).
3. **In-app:** buy **a week of what Jeremy would have you do** (~$10, one invoice). When the week ends, fall back to their own paste. Not $10/week forever.
4. **Banners / social proof:** “someone used Jeremy’s workout and this happened.”
5. **Fit:** “you’re ~80% of what Jeremy would do — want the 1–2 things he’d add?” Soft recommend, not a paywall lecture.
6. **15-min intro** still exists for people who want the coach. Don’t drop the handshake for Coach Class. BYOW people are not forced onto his board.

**Not in this phase:** landing A/B copy, App Store listing, $1/day, 10¢/minute, $850 on the BYOW door.

**App Store:** biggest barrier (kids, distribution, 15–30% IAP cut). Web Stripe first. Store only if BYOW is actually a habit.

---

## Offers (draft, web)

| Offer | Price | Role |
|-------|-------|------|
| BYOW trial | $0 for 1–2 months | Platform habit — their workout, our console |
| BYOW keep | ~$2.99/mo | Keep the logbook after the trial |
| Jeremy week | ~$10 one week | Taste his board, then fall back to BYOW |
| Coach Class | $25/mo | Keep Jeremy (Zoom, messages, 4-week board). Dollar-a-day is **copy**. |
| Business Class | $50/mo | Household / company bill |

Hide 1st Class ($850) until someone asks. Don’t stack BYOW + $10 week + $25 + $50 on the homepage.

Stripe: $2.99 ≈ $0.39 fee (keep ~$2.60). $10 week ≈ $0.59. Apple IAP on $2.99 is much worse — another reason web first.

---

## Company growth / partner share (John not left behind)

**Existing live model** (`STRIPE_COMMISSION_SETUP.md`): cliff — 5% of **all** MRR until $5K, then **30% of all** MRR. Partner pool is John (100% of that pool) via Connect later. Jeremy remains merchant of record.

**New idea (preview — not coded, not legal):** tax **brackets**, not a cliff. First dollars always cheap to the partner; blow-up dollars split fairly so John doesn’t stay at 30% forever and get bitter.

John’s share of **gross platform revenue** (BYOW sub + Jeremy week + later app fees — exact base TBD):

| Bracket (marginal) | On that slice | Jeremy / company keeps |
|--------------------|---------------|------------------------|
| First **$5,000** | **5%** (5/95) | 95% |
| Next chunk to **$15,000** | **30%** (30/70) | 70% |
| Above that | **50 / 50** | 50% |

Like taxes: hitting $100k does **not** reprice the first $5k. The first $5k is always 5%. The middle chunk is always 30%. Only the top slice is 50-50.

**Example** ($100k period):

- $5,000 × 5% = **$250**
- $10,000 × 30% = **$3,000**
- $85,000 × 50% = **$42,500**
- John **$45,750** · company **$54,250**

Same $100k under **today’s cliff** (30% of all after unlock): John **$30,000**. The 50-50 top bracket is the “if we blow up I’m not left behind” line.

**Open (do not invent in code):**

- Period: monthly MRR vs trailing 12 months vs lifetime.
- Base: all Train Station revenue vs BYOW/platform only vs excluding Coach Class Zoom.
- Whether this **replaces** the 5%→30% cliff or only applies to BYOW.
- Legal: partnership drafts now include these brackets (`04` + `10-Partnership-Agreement-DRAFT.pdf`). Still not executed. Admin software still uses the old cliff until recoded.

---

## Sequence vs what is live now

| Now (shipped) | Later (this preview) |
|---------------|----------------------|
| Landing A/B: meet Jeremy vs current tour | Do not put BYOW on `/` until A/B has a winner |
| 15-min intro almost mandatory on coach seats | BYOW seat may skip his board; still optional “meet Jeremy” |
| Free Explorer = lead to know the coach | BYOW = lead to **train**, then maybe know the coach |
| Member paste off | Member paste on Today when no coach day |

---

## Do not

- Build member paste, $2.99, Jeremy week IAP, or App Store from this note.
- Change Admin → Dev & partnership math until John + Jeremy agree in writing.
- Email Natasha or chase Free Explorers.
- Mix this into the current Facebook/Instagram post (still `thetrainstation.co` only).
