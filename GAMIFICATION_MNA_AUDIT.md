# Gamification — M&A / compliance notes

**Purpose:** Document controls so diligence (buyer, counsel, security) can verify integrity of the points, promo, and access-override system.

## Data ownership

| Store | System of record | Notes |
|-------|------------------|--------|
| Points ledger | Postgres `GamificationEvent` when `DATABASE_URL` is real | Blob/JSON is demo/fallback only |
| Season ranks | `GamificationSeasonScore` | Recomputed from events |
| Free-week promos | `GamificationPromo` | Access override only — **not** Stripe money until convert |
| Config levers | `GamificationConfig` | Single-row `id=default` |
| Audit trail | `GamificationAuditLog` | **Append-only** from app code |

Money remains Jeremy’s master Stripe / Venmo (see `CONTEXT.md`). Free weeks grant **product access**, not automatic card charges.

## AuthZ

| Surface | Gate |
|---------|------|
| Admin levers / promos / recompute / audit | `requireStaff` |
| Member claim promo | Session owner must match promo `userId` |
| Cron recompute | `CRON_SECRET` or `GAMIFICATION_CRON_SECRET` Bearer |

## Audit events (immutable)

| Action | When |
|--------|------|
| `config.patch` | Staff saves levers (before/after) |
| `promo.offer` | Manual grant |
| `promo.claim` | Member claims free week |
| `promo.revoke` | Staff revoke |
| `season.recompute` | Staff or cron rank + auto-offer |

Each row: `actorId`, `actorRole`, `ip`, `userAgent`, `targetId`, structured `detail` (no secrets).

**UI:** Admin → Gamification → **Audit log**  
**API:** `GET /api/admin/gamification/audit`

## Abuse controls

- Event **dedupe** by stable `eventId` (unique PK)
- **Daily point cap** (lever, default 150)
- Top-% promos require **min active days** + **min season points** + **min division size**
- **Cooldown per upgrade edge** (default 90 days)
- Claim window (default 72h); expired trials/offers marked `expired`
- Claim cannot steal another user’s promo

## What diligence should sample

1. Migration applied: tables exist on prod Postgres  
2. Random `GamificationEvent` rows match member workout/onboarding activity  
3. Promo claim → `status=claimed` + matching audit `promo.claim`  
4. Lever change → audit `config.patch` with before/after  
5. Free week does **not** create Stripe charge without checkout  
6. No `sk_live` / secrets in repo or audit `detail`  

## Known gaps (honest backlog)

- Free-pool: **percent-of-cycle** by default; **curated mode** when coach pins any `freePool` day (Admin → Gamification → Free pool). Today UI + **workout log API** both honor flags.  
- Effective plan override (free-week) now used for content lock, division board, **payment gate cookies**, `requireMemberAccess`, and login destination (`memberNeedsPaymentAsync`). Legacy `getMemberAccess` / `MEMBER_ACCESS_MODE` still preview-oriented for old tier labels only.  
- No automated PII export/delete pack for gamification tables alone (use `export-member-dsar.ts` + member wipe + `removeGamificationForUsers`)  
- Cron auth fails closed in production without secret  
- After Postgres cutover, run Admin → Gamification → **Recompute** (imports Blob + offers free weeks) or `npx tsx scripts/import-gamification-blob-prod.ts`

## Related

- Product design: `GAMIFICATION_DESIGN.md`  
- Money: `STRIPE_COMMISSION_SETUP.md`, `CONTEXT.md`  
- Persistence rule: Postgres for durable multi-user state (`PERSISTENCE.md`)
