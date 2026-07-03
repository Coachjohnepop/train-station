# Train Station — Session Status

*Last updated: Thursday, July 2, 2026 — John in PST (California)*

## Where we are

Production: **https://www.thetrainstation.co**  
Repo: **train-station** (`main`, pushed through `b329952`)

### Coach flow (Jeremy-friendly)

| Screen | URL | Purpose |
|--------|-----|---------|
| **Dashboard** | `/admin/day` | Pick day, plan/publish workout, roster stoplights |
| **Go to Today** | `/admin/today` | Today only — count sets, embedded Zoom, no sidebar |

**Removed / consolidated:** separate Full planner page, Plan mobile tab, duplicate paste flow on Dashboard. Old `/admin/plan` links redirect to `/admin/day?plan=1`.

---

## What shipped this session

### Go to Today — set counting (`1a0e09e`)
- Restored **▶ expand** on member cards (inline, not full-screen modal)
- Expanded cards use `coachFloorMode` → **square set buttons**
- Checkoffs sync live to member phones

### Dashboard — single planning surface (`e09fd8c`, `c17e2d2`)
- **Plan workout** opens full lesson builder inline (Grok interpret → review → assign)
- **Square day band** restored: Today / Tomorrow / Next + ‹ ›
- **✓** on days that already have a workout assigned
- Dashboard accepts `?date=YYYY-MM-DD` and `?plan=1`
- Go to Today CTA only when viewing calendar today

### Video on Go to Today (`b329952`)
- **Start Video** should embed Zoom inline on desktop (same screen as set counting)
- Fixed hydration race that opened Zoom in a new tab on first click
- Renamed **Pin video on this page** → **Show video here** (re-embed after leaving)
- Embed is sticky while scrolling; clearer errors if SDK not configured

### Earlier context (still relevant)
- Faster saved-class publish (reuse `workoutId`, batch assign)
- Zoom OAuth: redirect `https://www.thetrainstation.co/api/admin/zoom/callback`, scopes `user:read` + `meeting:write:meeting`
- Dashboard vs Go to Today split; stoplight roster on Dashboard
- Start Video only on Go to Today floor (not Dashboard)

---

## Left off / verify after reboot

Run through this in order once Vercel has deployed `b329952`:

1. **Deploy** — confirm latest commit on Vercel; hard refresh
2. **Dashboard day band** — squares show ✓ on days with workouts; switch days while Plan workout is open
3. **Plan workout** — paste → interpret → assign → publish for today and a future day
4. **Go to Today** — ▶ expand → square set buttons; live sync to member phone
5. **Start Video** — embeds on desktop (not new tab); sticky while scrolling; **Show video here** after Leave
6. **Zoom Settings** — connected; if embed fails, error message + **Open in Zoom app** fallback

---

## To-do list

### P0 — Verify after reboot (no code unless broken)

- [ ] Confirm Vercel production deploy includes `b329952`
- [ ] Dashboard: day band, ✓ indicators, Plan workout end-to-end
- [ ] Go to Today: expand cards, square sets, live checkoff sync
- [ ] Go to Today: Start Video embed + sticky behavior on desktop
- [ ] Mobile: Go to Today usable (sets); video opens Zoom app (expected)

### P1 — Likely follow-ups if verify fails

- [ ] Video embed still opens tab → check Zoom Meeting SDK + ZAK in Vercel env; Settings connection
- [ ] Day band missing workout ✓ → confirm sessions exist for that date in blob/store
- [ ] Plan for non-today dates — roster/live-floor tiles may be today-centric on Go to Today (by design)

### P2 — UX / nav cleanup (discussed, not urgent)

- [ ] **Live Floor** (`/admin/live`) vs **Go to Today** — overlap; consider deprecating Live for coaches
- [ ] Mobile bottom nav still has Live + Msgs + Grok + More — could simplify further for Jeremy
- [ ] Coach help assistant copy — ensure Grok knows Dashboard-only planning

### P3 — Nice to have / backlog

- [ ] Publish speed: smoke-test republish saved class to open students
- [ ] Zoom: end-to-end test member join link SMS after coach starts video
- [ ] Seed script URL already points to `/admin/day?plan=1`
- [ ] Program/workout builder paths (`/admin/workouts`) — separate from daily class flow; keep out of Jeremy's path

---

## Key files

| File | Role |
|------|------|
| `src/components/CoachDashboard.tsx` | Dashboard, day band, Plan workout |
| `src/components/CoachClassDayBand.tsx` | Square date buttons + ✓ |
| `src/components/CoachDayHub.tsx` | Go to Today floor, expand + sets |
| `src/components/CoachLiveFloorZoomPanel.tsx` | Start Video / embed |
| `src/components/CoachLessonPlanBuilder.tsx` | Full plan wizard (embedded on Dashboard) |
| `src/components/CoachLiveFloor.tsx` | Reference pattern for expand + `coachFloorMode` |
| `src/app/admin/day/page.tsx` | Dashboard page (`?date`, `?plan=1`) |
| `src/app/admin/today/page.tsx` | Go to Today |
| `src/app/admin/plan/page.tsx` | Redirect → `/admin/day?plan=1` |

---

## Environment reminders

- **Zoom:** General OAuth app; connect via Admin → Settings
- **Vercel env:** `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`; optional `XAI_API_KEY` for Grok plan interpret
- **Redirect URL:** `https://www.thetrainstation.co/api/admin/zoom/callback`

---

## Recent commits (newest first)

```
b329952  Fix Go to Today video embed and clarify pin behavior
c17e2d2  Restore square day band on Dashboard with workout indicators
e09fd8c  Consolidate workout planning into Dashboard
1a0e09e  Restore inline expand with square set buttons on Go to Today
eaddf8f  Start Video on Go to Today floor only
8fc8447  Dashboard / Go to Today split
```

---

*When back: open this file, run the P0 checklist, tick boxes, note what failed.*