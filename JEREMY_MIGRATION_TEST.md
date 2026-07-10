# Jeremy — Migration QA Checklist

**Prod:** https://www.thetrainstation.co  
**Last updated:** 2026-07-09 (after PR-9 — Tier 3 commerce stores)

Mark each item when tested. Report anything broken or odd in Slack.

---

## Must test now (blob → Postgres migration)

| # | Area | Steps | Pass? | Notes |
|---|------|-------|-------|-------|
| 1 | **Login** | Go to `/login`, sign in as `jeremy@thetrainstation.co` → land on admin dashboard | ☐ | |
| 2 | **Coach chat (admin)** | `/admin/chat` → pick a member → send a message → refresh → message still there | ☐ | Now stored in Postgres |
| 3 | **Member chat** | Sign in as a member → reply to coach → check unread badges on admin side | ☐ | |
| 4 | **New signup** | Register a **new** test email → confirm member appears in **Admin → Members** | ☐ | New signups write to Postgres |
| 5 | **Lesson plan / SMS** | `/admin/day` → interpret notes → build draft → edit workout → save | ☐ | SMS workouts in Postgres |
| 6 | **Go to Today** | From day view, **Go to Today** → `/admin/today` loads, live floor works | ☐ | |
| 7 | **Admin → Members** | Roster shows registered members; profiles load (name, flags) | ☐ | Dual-write auth + profiles |
| 8 | **Stripe checkout** | If you have a test flow, complete checkout → member profile updates (paid flags) | ☐ | Optional if no test card |

---

## After auth Phase C flip (not yet — we'll ping you)

| # | Area | Steps | Pass? | Notes |
|---|------|-------|-------|-------|
| 9 | **Existing member login** | Log in as a member imported from blob (not new signup) | ☐ | |
| 10 | **Password reset** | Request reset → email link → set new password → login | ☐ | |
| 11 | **OAuth** | Google (or other) sign-in for existing + new user | ☐ | |

---

## PR-9 (Tier 3 commerce — when deployed)

| # | Area | Steps | Pass? | Notes |
|---|------|-------|-------|-------|
| 15 | **Admin → Commission** | View partners + payout history → run or review a payout | ☐ | Postgres ledger |
| 16 | **Referral codes** | Admin referral list loads; checkout with a code still works | ☐ | |
| 17 | **Waitlist / Leads** | Admin → Leads shows waitlist + signups | ☐ | |
| 18 | **Custom training offer** | Create/send a custom offer (if you use this flow) | ☐ | |

---

## PR-8 (live sessions & coach settings)

| # | Area | Steps | Pass? | Notes |
|---|------|-------|-------|-------|
| 12 | **Live session (Today)** | Start/advance a member session on `/admin/today` → refresh → state persists | ☐ | |
| 13 | **Coach settings** | Change a coach setting (e.g. display pref) → refresh → still applied | ☐ | |
| 14 | **Member coach prefs** | Member-side pref (if exposed) → save → reload | ☐ | |

---

## Watch for

- **Parity warnings** in Vercel logs: `[migration-parity-mismatch]` on dual-write stores (auth, profiles)
- **Orphan profiles** (known): `member-8eeff995-292`, `member-19ed60cf-b04` — no matching user row; safe to ignore for now

---

## Already verified (agent smoke — 2026-07-09)

- Migration smoke 5/5, P0 verify 18/18, today-sessions 7/7, lesson-plan 10/10
- Prod APIs: login, chat (8 threads), admin members (7)
- Postgres counts: Users 13, Profiles 5, Chat 8 threads / 8 msgs, SMS 50, Enrollments 3