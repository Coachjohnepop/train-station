# Stripe AoC (Attestation of Compliance) — get it from the Dashboard

Stripe’s **own** PCI Level 1 AoC is **not** a public PDF we can wget. It lives on Jeremy’s Stripe account.

## Do this now (John, ~2 minutes)

1. Sign in as the Train Station LIVE merchant: [dashboard.stripe.com/settings/compliance/documents](https://dashboard.stripe.com/settings/compliance/documents)
2. Download **PCI Attestation of Compliance (AoC)** and the **Shared Responsibility Matrix**.
3. Save both next to our draft:
   - Desktop: `Stuff/Lemon Voice/The Train Station/`
   - Repo (optional, if not confidential): `docs/pci/` — **do not commit if Stripe marks it confidential; many AoCs are shareable with customers.**

Public proof Stripe is a Level 1 provider (not a substitute for the AoC file):

- Visa listing: search company **Stripe, Inc.** on Visa’s Global Registry of Service Providers
- Stripe docs: https://docs.stripe.com/security/guide

## When Stripe asks you to complete *your* PCI form (not now unless the dashboard already shows a banner)

Open the same compliance documents page. Stripe usually pre-fills **SAQ A** when the integration is Checkout.

Answer from how we actually charge:

| Question (paraphrase) | Answer |
|---|---|
| How do you collect cards? | **Stripe Checkout** (hosted page / redirect). Not Elements. Not raw API. |
| Do cards touch your server? | **No.** |
| Do you store PAN? | **No.** We store customer / subscription / Checkout session IDs. |
| Card-present / Terminal? | **No.** |
| MOTO / type cards into Dashboard as routine? | **No.** |

Do not invent a SAQ D path. If Stripe’s wizard picks A-EP, something in the account is classified as Elements — fix the integration, don’t sign the wrong form.

ASV quarterly scans: **later**, only if Stripe or the bank requires them.
