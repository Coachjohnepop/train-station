# Jeremy — Logo Upload & Editor Script

**Date / Context**: June 2026 — Admin logo editor with real PNG transparency, zoom, crop, rotation, and publish.

**Goal**: Upload the Train Station logo (or a white-label client logo), adjust how it sits in the frame, publish it live, and confirm it looks right on the home page.

**Time**: ~5 minutes.

**Production URL**: https://www.thetrainstation.co

---

## Before you start

- Use a **desktop browser** (Chrome or Safari) — the sliders are easier on a wide screen.
- **Best file**: transparent **PNG** (circular emblem, no background). JPEG works but corners may need more crop.
- Max file size: **8 MB**.
- If you get bounced to login, use the coach account below.

| Field | Value |
|-------|-------|
| Login URL | https://www.thetrainstation.co/login?redirect=/admin/landing |
| Email | `jeremy@thetrainstation.co` |
| Password | `CoachTest123!` |

**PIN / Face ID**: If prompted after password, set up quick auth once at `/setup-quick-auth`, or skip if you already did on this device.

---

## Step 1 — Open the logo editor (~30 sec)

1. Sign in at the login URL above (redirect lands you on admin landing).
2. Or: **Admin** → **Landing** (path: `/admin/landing`).
3. Scroll to the **Logo editor** card.
4. You should see a **checkerboard** preview area — gray squares mean **transparent** (good).

**Quick check**: Text John `Logo editor open?` — yes / no.

---

## Step 2 — Upload a new source image (~1 min)

*Skip this step if the current logo preview already looks correct.*

1. Click **Upload new source**.
2. Choose your PNG file (e.g. the circular Train Station emblem).
3. Wait for **“Source uploaded…”** message.
4. Sliders reset to defaults — that’s expected after a new upload.

**Quick check**: Text John `Upload OK?` — yes / no.

---

## Step 3 — Adjust zoom, crop, and rotation (~2 min)

Use the sliders on the right. The preview updates automatically (live CSS first, then **server preview** with real transparency).

| Slider | What it does | Typical starting point |
|--------|----------------|------------------------|
| **Zoom** | Bigger / smaller in frame | 80–100% for a round emblem |
| **Rotation** | Tilt in degrees | 0° unless the art is crooked |
| **Pan left / right** | Move horizontally | 0% unless off-center |
| **Pan up / down** | Move vertically | 0% unless off-center |
| **Crop inset** | Trim edges (tighten frame) | 0–5% for PNG; more if JPEG has a box |

**Tips**

- Checkerboard behind the logo = transparency is working.
- If you see a dark square, try **Crop inset** + confirm the file is PNG with transparency.
- **Reset controls** puts all sliders back to default without re-uploading.

**Quick check**: Text John `Preview looks good?` — yes / no.

---

## Step 4 — Publish the logo (~30 sec)

1. Click **Publish logo** (purple button).
2. Wait for **“Logo published — transparent PNGs are live across the site.”**
3. Under **Published sizes**, confirm Header / Icon / Favicon thumbnails look right on the checkerboard.

This writes optimized PNGs for nav, hero, icon, and favicon and saves your slider settings.

**Quick check**: Text John `Publish OK?` — yes / no.

---

## Step 5 — Optional brand text (~30 sec)

Same page, below the editor:

1. **Brand name** — e.g. `The Train Station`
2. **Tagline** — short line under the name on marketing pages
3. Click **Save brand text** (separate from Publish logo)

---

## Step 6 — Verify on the live site (~1 min)

1. Click **Preview home page ↗** (opens `/` in a new tab).
2. Hard refresh if needed: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows).
3. Check:
   - Logo in header — round emblem, **no black square** around it
   - Logo on hero / landing — same
   - Favicon in browser tab (may take a minute to update)

**Quick check**: Text John `Home page logo OK?` — yes / no.

---

## Troubleshooting

| Problem | Try this |
|---------|----------|
| “Coach sign-in required” | Sign out, sign in again at `/login` with coach email/password |
| Upload fails | PNG under 8 MB; retry with a smaller export |
| Logo still has a square box | Re-upload a **transparent PNG**; avoid JPEG; increase **Crop inset** slightly |
| Changes not on home page | Click **Publish logo** again; hard refresh; wait ~1 min for CDN |
| Wrong old logo | Publish again after upload; confirm **Published sizes** thumbnails updated |

---

## One-line summary for John

When done, text:

> `Logo script done — upload [Y/N], publish [Y/N], home page [Y/N]`

Or call out anything weird (square box, too small, crooked, etc.).