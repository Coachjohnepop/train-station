<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Coach content model (templates / paste / categories)
See **CLAUDE.md** section "Coach template / paste model". Summary for agents:
- Paste is **always clone** (never share-by-reference).
- Template **categories are freeform** — not only adult/athletes. Expect yoga, meditation, nutrition, martial arts, dog training, and future program types. Do not hard-code a closed category enum in UI or API.
- Pasting a **28-day pack** onto a month that already has content must **warn and require confirm** (`force`) before overwrite.
