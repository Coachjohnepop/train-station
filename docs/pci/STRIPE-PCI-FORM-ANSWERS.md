# Stripe PCI wizard + SAQ A — fill sheet (13 Sep 2026)

**Not signed. Not an attestation.** Print this, copy into [Dashboard → Settings → Compliance documents](https://dashboard.stripe.com/settings/compliance/documents), then sign there if Stripe asks.

Merchant of record: **Jeremy’s Train Station Stripe LIVE** (not John’s personal Stripe).

---

## A. Integration (we already know — copy as-is)

| Stripe / SAQ question (paraphrase) | Answer | Why |
|---|---|---|
| How do customers pay online? | **Stripe Checkout** — hosted page / redirect to `checkout.stripe.com` | `/api/stripe/checkout` creates a Checkout Session; browser leaves our site |
| Stripe.js / Elements / Payment Element on our page? | **No** | No `CardElement` / `PaymentElement` in the repo |
| Raw card numbers posted to our API? | **No** | Never |
| Do we store PAN, expiry, or CVC? | **No** | Postgres has `stripeCustomerId`, `stripeSubscriptionId`, `stripeCheckoutSessionId` only |
| Card-present / Stripe Terminal? | **No** | |
| Invoices that collect cards on Stripe? | **No** as a routine product (memberships + tips use Checkout) | |
| Connect marketplace collecting cards as a platform? | **Not yet** (Connect is later for John’s fee pool) | If Connect Checkout stays hosted, still SAQ A — revisit then |
| Which SAQ should Stripe pick? | **SAQ A** | Checkout / hosted tools |
| If wizard says SAQ A-EP or D | **Stop** — integration is misclassified | Fix code/account; don’t sign the wrong form |

## B. Other money (say this if asked)

| Question | Answer |
|---|---|
| Other ways people pay? | **Venmo** to `@JeremyByrdCSCS` then coach **Mark paid**. Not card data. |
| BYOW / notes app? | **Free.** No Stripe. Out of card scope. |
| Tips? | Stripe Checkout (same hosted page). |
| Refunds? | Stripe Dashboard / our admin refund API (Stripe IDs only). |

## C. Eligibility checklist (SAQ A — all should be Yes)

1. Card-not-present only (e-commerce). **Yes.**
2. All account data handling outsourced to Stripe (PCI Level 1). **Yes.**
3. We do not store/process/transmit account data electronically. **Yes.**
4. Stripe is PCI validated (download their AoC from the same Dashboard page). **Yes, once the file is saved.**
5. Any paper CHD? **No** (unless Jeremy writes numbers on paper — he must not).
6. Website only redirects / links to Stripe Checkout (not a card form on our origin). **Yes.**

## D. Merchant block — FILL / CONFIRM (print)

Leave blank here if unknown; John answers in chat.

| Field | Draft | Confirm? |
|---|---|---|
| Legal company name | **Jeremy Byrd / The Train Station** (confirmed 13 Sep 2026) | done |
| DBA | The Train Station | done |
| Website | https://www.thetrainstation.co | done |
| Stripe account | LIVE Train Station (Jeremy merchant) | done |
| Business type | Fitness coaching / online memberships | done |
| Card-not-present? | Yes | done |
| Staff types cards into Dashboard? | **Never** (confirmed) | done |
| Executive who signs | **Jeremy Byrd** (merchant of record). John does not sign. | done |
| Approx. card transactions / year | Well under 20,000 (Level 4-ish) — confirm if asked | print if Stripe wants a number |
| Company address | | print |
| Phone | | print |
| EIN / tax ID | | print |
| Date | | print |

## E. After you paste this into Stripe

1. Download **Stripe’s AoC** + **Shared Responsibility Matrix** from that page.
2. Save next to `PCI-SAQ-A-Draft-2026-09-13.pdf` on the Desktop.
3. Do **not** complete ASV scans unless Stripe/bank requires them (later).

## F. Do not answer Yes to

- We collect cards on our website
- We use Stripe.js v2
- Staff types cards into Dashboard as the normal way to take payment
- We store full card numbers
- We have in-person terminals
