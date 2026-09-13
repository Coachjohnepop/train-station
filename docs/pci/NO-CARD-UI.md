# Standing rule: no card UI on our origin

**Do not collect PAN, expiry, or CVC on thetrainstation.co, /byow, chat, or admin.**

Checkout is **Stripe-hosted Checkout Sessions** (`checkout.sessions.create` → redirect). Webhooks receive event JSON and Stripe IDs only.

If we add Stripe Elements, Payment Element, a card `<input>`, Terminal, or post raw card numbers to our API:

1. Stop.
2. The SAQ A draft is void.
3. Questionnaire becomes **SAQ A-EP** or **SAQ D**.
4. Re-read `docs/pci-saq-a-draft-2026-09-13.pdf` before writing code.

Venmo stays QR + Mark paid. Never paste card numbers in Messages.

BYOW is free — no payment form.

Saved 13 Sep 2026. ASV scans / counsel = later.
