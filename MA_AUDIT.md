# The Train Station — M&A / diligence readiness audit

**Audience:** John (seller/builder), counsel, security, acquirer diligence teams  
**Living file:** update after each hardening sprint.  
**Date opened:** 2026-07-23  
**Scope:** Product software + ops model (not full legal entity due diligence).

Domain packs already written:

| Pack | File |
|------|------|
| Gamification integrity | `GAMIFICATION_MNA_AUDIT.md` |
| Persistence / demo vs DB | `PERSISTENCE.md` |
| Money model | `CONTEXT.md`, `STRIPE_COMMISSION_SETUP.md` |
| SMS / TCPA ledger | `CONTEXT.md` (SMS M&A section), `DEPLOY.md` |

---

## 1. Executive snapshot

| Dimension | Grade (honest) | One-liner |
|-----------|----------------|-----------|
| **Money of record** | Strong story / partial proof | Jeremy master Stripe + Venmo rails documented; card Live cutover still open; commission + platform admin fee paths coded |
| **Data of record** | Strong direction / mixed | Postgres principle is non-negotiable; many dual stores still exist as migration debt |
| **AuthZ** | Good | Staff / platform / member helpers; money admin uses `requirePlatformStaff` |
| **Auditability** | Good / Phase A | Money + staff mutations on `AuditEvent`; Admin → Audit log; SMS + gamification audits remain |
| **PII / privacy** | Good / Phase A | Soft-hide users; wipe scripts; DSAR export `scripts/export-member-dsar.ts` |
| **IP / clean room** | Good hygiene | No live secrets grepped in tracked source; seed/soak scripts separate |
| **Ops readiness** | Mid-high | Tips + FEEDBACK50 + security flags on Test prod; **Connect Express (John)** still human browser |
| **Demo / prod isolation** | Needs vigilance | Dev switcher fails closed when disabled; demo JSON must never be prod SoR |

**Buyer headline:** Modern coaching SaaS on Postgres + Stripe with clear merchant-of-record story, soft-delete culture, and emerging append-only audit. Diligence will focus on **blob residual stores**, **incomplete global audit**, **PII export/delete**, and **proving Live payment controls**.

---

## 2. Corporate / product facts diligence will ask

| Question | Answer (product) |
|----------|------------------|
| Who is merchant of record? | **Jeremy’s Train Station business Stripe** (master). John is Connect partner for fee pool + $275 platform admin — not a second merchant. |
| What is sold? | Memberships (sub + one-time), optional tips, Venmo backup + Mark paid, custom offers/merch later |
| Who owns member data? | Platform (Train Station) in Postgres; coaches are staff operators of one brand (not multi-tenant isolation v1) |
| Multi-tenant? | **Single brand / multi-role**, not SaaS multi-coach orgs with hard isolation |
| Open source / third-party? | Next.js, Prisma, Stripe, Zoom OAuth, Resend, Twilio (parked), Vercel Blob for media |

---

## 3. Strengths (show these first)

1. **Explicit money model** in `CONTEXT.md` / commission docs (charge → master balance → later Connect).  
2. **Postgres-first rule** documented and largely followed for new features (gamification, SMS audit, live sessions, program days).  
3. **Role model:** `MEMBER` / `INSTRUCTOR` / `ADMIN` / `PLATFORM_ADMIN` with separate coach vs platform nav.  
4. **Payment admin desk** (refunds, discounts, subscriptions) gated by `requirePlatformStaff`.  
5. **Webhook idempotency** via `StripeWebhookEvent` claim pattern.  
6. **Soft-hide users** instead of hard-delete (preserves Stripe FK integrity).  
7. **Gamification M&A pack** with append-only audit + sampling list.  
8. **SMS M&A pack** (consent timestamps, delivery events, STOP/START, `AuditEvent` on send path).  
9. **No live secret keys** found in tracked source (only mode checks / docs).  
10. **Clone-not-share** content model (templates/paste) reduces product integrity for coach IP.

---

## 4. Findings (prioritized)

### P0 — treat as diligence blockers if sale is near

| ID | Finding | Risk | Mitigation |
|----|---------|------|------------|
| **P0-1** | **Stripe still Test mode** on prod | Real GMV / refund / tip / commission paths unproven on Live | Live cutover checklist (F1); one real $ + webhook 200 |
| **P0-2** | **Dual storage facades** (~28 `*-store.ts`) | Buyer fears “which system of truth?” and data loss on cutover | Finish blob→Postgres phases; publish `GET /api/admin/demo-persistence` snapshot in data room |
| **P0-3** | ~~**Global `AuditEvent` underused**~~ | **Mitigated Phase A** — money/staff wired + `/admin/audit` | Keep extending as new money paths ship |
| **P0-4** | ~~**No formal DSAR / member data export package**~~ | **Mitigated Phase A** — `export-member-dsar.ts` + sample under `exports/` | Wire self-serve DSAR later if buyer asks |

### P1 — high (fix before LOI if possible)

| ID | Finding | Risk | Mitigation |
|----|---------|------|------------|
| **P1-1** | **John Connect not linked** | Platform fee / commission cannot transfer | Express onboarding; sample transfer in test |
| **P1-2** | ~~**Tips / FEEDBACK50 env incomplete**~~ | **Done on Test prod** — tip prices + FEEDBACK50 + `tips.enabled` | Live cutover still Phase B |
| **P1-3** | **Gamification free pool / access helpers** | Free-week + free-pool UI existed; API/log gate + payment-async now ship | Keep sampling freePool curation on Adult |
| **P1-4** | **Impersonation / demo switcher** | If misconfigured on prod, session confusion | Confirm `ALLOW_DEV_SWITCHER=false` + `SECURITY_ENFORCED` on prod; sample denied `GET /api/dev/switch-user` |
| **P1-5** | **Venmo Mark paid is manual** | Access fraud / disputed access without paper trail | Require note + audit event on Mark paid; optional dual-approval later |
| **P1-6** | **Staff vs platform boundary** | Coach staff may reach too much or too little | Matrix: who can refund, who can wipe, who can change prices |

### P2 — medium (12–18 month clean-up)

| ID | Finding | Risk | Mitigation |
|----|---------|------|------------|
| **P2-1** | **Single-brand tenancy** | Harder to sell as multi-gym SaaS without refactor | Be honest in CIM; roadmap multi-org if needed |
| **P2-2** | **Twilio parked** | Carrier SMS diligence incomplete if product claims “SMS” | Docs: Messages hub default; carrier optional |
| **P2-3** | **Zoom Marketplace / multi-coach** | Second coach external Zoom may fail until publish | Ops checklist in Jeremy manual |
| **P2-4** | **Landing / content still placeholders** | Demo vs production content | Content checklist ownership (Jeremy) |
| **P2-5** | **Soak / junk scripts not productized** | Repo noise | Keep scripts; document as non-runtime |
| **P2-6** | **Cron secrets split** | Missed jobs fail closed | Document all cron routes + secrets in one table |

### P3 — low / narrative

- Free-ticket 10s gag is intentional product (document in data room so nobody “fixes” it).  
- Funny soak markers (MARSHMALLOW-BADGER) are coach-only trails — fine if greppable and not on member schedule.  
- Commission env still named `STRIPE_COMMISSION_*` while product says “dev & partnership fees”.

---

## 5. What diligence should sample (cross-cutting)

### Money

1. `/api/payments/public` — test vs live, venmo, tips enabled.  
2. Stripe Dashboard: products, webhook endpoint last delivery 200, Connect status for John.  
3. One Mark-paid Venmo path: Admin Members → paid + method Venmo; no Stripe PI.  
4. Refund: Admin Billing → partial refund → Stripe charge state matches.  
5. Discount: create coupon with `applies_to` subscription products; redeem at checkout; invoice line shows discount.  
6. Platform admin fee: dry-run then test transfer when Connect Ready.  
7. `FactSubscriptionPayment` / commission facts exist after invoice.paid.

### Access control

1. Unauth `POST /api/stripe/checkout` → 401.  
2. Member cannot hit `/api/admin/billing/*` → 401/403.  
3. Instructor cannot hit platform-only routes if matrix says so.  
4. `GET /api/dev/switch-user` → 404 when switcher off.  
5. Live-session: coach can write only scoped `targetUserId` / staff rules.

### Data integrity

1. `GET /api/admin/demo-persistence` — `databaseConfigured: true` on prod.  
2. Random `WorkoutLog` + `ExercisePerformance` match a real session.  
3. Chat message survives redeploy (Postgres).  
4. Soft-hide user: cannot login; appears with `includeHidden`.  
5. Gamification sampling from `GAMIFICATION_MNA_AUDIT.md`.  
6. SMS sampling: `SmsLog` + `SmsDeliveryEvent` + STOP blocks (if Twilio ever on).

### Privacy / security

1. No secrets in git history of last 90 days (rotate if any).  
2. Session cookie flags (httpOnly, secure, sameSite) on prod.  
3. Vercel env: only Production has live keys when Live.  
4. PII in logs: sample Vercel function logs for phone/email over-logging.  
5. Export one member package end-to-end (once built).

---

## 6. Hardening roadmap (suggested)

### Phase A — Data room ready (2–4 weeks)

- [x] Publish this file + domain packs (`MA_AUDIT.md` on main)  
- [x] Prod snapshot helper: `npx tsx scripts/snapshot-demo-persistence-prod.mjs --url https://www.thetrainstation.co`  
- [x] Confirm security env flags on Vercel (`SECURITY_ENFORCED=true`, `ALLOW_DEV_SWITCHER=false`, `STRIPE_REQUIRED=true`; blank-password still true for coach login)
- [x] Wire `recordAuditEvent` for: mark-paid, refund, discount create/toggle, role/status change, tip paid, platform admin fee, user hide  
- [x] Admin **Audit log** page: `/admin/audit` + `GET /api/admin/audit` (platform staff)  
- [x] Member export script v1: `npx tsx scripts/export-member-dsar.ts --email user@x.com`  
- [x] Free-ticket gag documented in product + MA notes; tips/discounts ops in CONTEXT  

**Audit action names:** `member.mark_paid` · `payment.tip` · `billing.refund` · `billing.discount.create` · `billing.discount.toggle` · `billing.platform_admin_fee` · `user.staff_update` · `user.hide` (+ existing SMS actions)

### Phase B — Money proof (blocked on Live when you choose)

- [ ] Live keys + tip prices + FEEDBACK50 on Live  
- [ ] One real card + refund  
- [ ] Connect Ready + $1 test transfer or platform admin dry-run with real account  
- [ ] Webhook 200 gallery screenshots  

### Phase C — Store unification (ongoing)

- [ ] Finish remaining blob stores per `PERSISTENCE.md`  
- [ ] Kill write paths to Blob for any store with DB SoR  
- [ ] Seed files only as export artifacts  

### Phase D — Scale / multi-org (only if CIM claims SaaS multi-tenant)

- [ ] Org model, data isolation, per-coach merchant optional  
- Out of scope for single-brand sale  

---

## 7. Code map (where auditors start)

| Concern | Paths |
|---------|--------|
| Auth helpers | `src/lib/api-auth.ts`, `src/lib/staff-access.ts`, `src/lib/auth*.ts` |
| Global audit | `src/lib/audit-event.ts`, model `AuditEvent` |
| Payments | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/mark-member-paid.ts` |
| Billing admin | `src/lib/stripe-billing-admin.ts`, `src/app/admin/billing/*` |
| Commission / fees | `src/lib/stripe-commission*.ts`, `src/lib/platform-admin-fee.ts` |
| Gamification | `src/lib/member-gamification*`, `GAMIFICATION_MNA_AUDIT.md` |
| SMS ledger | `src/lib/sms-delivery.ts`, `src/app/api/sms/*` |
| Persistence matrix | `PERSISTENCE.md`, `src/lib/*-store.ts` |
| Soft-hide users | `src/app/api/users/*`, `PERSISTENCE.md` |

---

## 8. Session notes

### 2026-07-23 — audit opened

- Inventory: **~70 Prisma models**, dual stores still present, gamification + SMS M&A packs exist.  
- Naive “no auth” route scan over-flagged; many use `requireSession` / `requireCoachStaff` (not just `requireStaff`). Money admin correctly uses **platform** staff.  
- **John Connect** partner row exists, `has_connect: false`.  
- **Gamification** recompute run on prod; open promos present.  
- **Stripe secrets** not pullable via agent CLI (sensitive redaction) — operational friction, not a product bug.  

### 2026-07-23 — Phase A shipped (code)

- `src/lib/audit-request.ts` + mark-paid / refund / discount / tip / platform-admin / user staff mutations.  
- `/admin/audit` UI + API.  
- `scripts/export-member-dsar.ts`, `scripts/snapshot-demo-persistence-prod.mjs`.  
- Ops remaining: confirm Vercel security flags; run tip/FEEDBACK50 setup with `sk_test_`.

### 2026-07-23 — Phase A ops + free-access hardening

- **Ops done:** `SECURITY_ENFORCED` / `ALLOW_DEV_SWITCHER=false` / `STRIPE_REQUIRED=true`; tip prices on Vercel; FEEDBACK50 on Test Stripe; `tips.enabled: true` via `/api/admin/ops/stripe-bootstrap`.  
- **Still human:** Connect Express for John (`has_connect: false`); Stripe Live; Jeremy intro YouTube.  
- **Free-access (F3 partial):** `memberNeedsPaymentAsync` / `memberHasFullAccessAsync` honor claimed free-week; workout log API enforces `assertMemberCanLogWorkout` (free-pool + content tier) so explorers cannot bypass Today UI lock.

---

## Related

- `CONTEXT.md` — living handoff  
- `GAMIFICATION_MNA_AUDIT.md`  
- `PERSISTENCE.md`  
- `STRIPE_COMMISSION_SETUP.md`  
- `DEPLOY.md`  
- `VENDOR_COSTS.md`  
