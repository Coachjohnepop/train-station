<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Storage (non-negotiable)
**Always use PostgreSQL (Prisma) for durable app data.** Do not add new JSON / Vercel Blob stores for coach or member state. Blob is OK for binary media only; metadata stays in the DB. Seed/`*.dev.json` are snapshots, not prod runtime. Details: `CONTEXT.md` · `PERSISTENCE.md`.

## Coach content model (templates / paste / categories)
See **CLAUDE.md** section "Coach template / paste model". Summary for agents:
- Paste is **always clone** (never share-by-reference).
- Template **categories are freeform** — not only adult/athletes. Expect yoga, meditation, nutrition, martial arts, dog training, and future program types. Do not hard-code a closed category enum in UI or API.
- Pasting a **28-day pack** onto a month that already has content must **warn and require confirm** (`force`) before overwrite.
