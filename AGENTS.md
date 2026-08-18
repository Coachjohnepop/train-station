<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Network polls (non-negotiable)
**Never poll Postgres / `/api/*` faster than 5 seconds.**  
A 150ms `LiveWorkoutSession` loop blew Supabase Free usage. Live-class backup polls go through `startLiveClassBackupPoll` and run **only while `hostStarted`**. Idle = one GET + SSE + tab-focus. `npm run build` fails if a faster network interval is added. Local UI ticks (rest timer, confetti) are not network polls.

## Storage (non-negotiable)
**Always use PostgreSQL (Prisma) for durable app data.**  
**Any new module, feature, or data element** (measurements, photos metadata, admin desks, etc.) must land in **tables + migrations** — not JSON/Blob-only stores or localStorage as system of record. Blob is OK for binary media only; metadata stays in the DB. Seed/`*.dev.json` are snapshots, not prod runtime. Details: `CONTEXT.md` · `PERSISTENCE.md`.

## Coach content model (templates / paste / categories)
See **CLAUDE.md** section "Coach template / paste model". Summary for agents:
- Paste is **always clone** (never share-by-reference).
- Template **categories are freeform** — not only adult/athletes. Expect yoga, meditation, nutrition, martial arts, dog training, and future program types. Do not hard-code a closed category enum in UI or API.
- Pasting a **28-day pack** onto a month that already has content must **warn and require confirm** (`force`) before overwrite.
