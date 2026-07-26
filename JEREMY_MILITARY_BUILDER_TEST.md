# Jeremy — Military builder smoke test (paste / multi-part / logo)

**Site:** https://www.thetrainstation.co  
**Login:** `jeremy@thetrainstation.co`  
**Time:** ~10–15 min  
**Why this exists:** You reported Military kick-back to Programs, paste/templates not sticking, and the logo needing a white background. Those are **fixed on prod** — this walkthrough confirms them on your account.

**Program:** Admin → **Programs** → **Military Preparation**  
(slug: `boot-camp-preparation`)

---

## Before you start

1. Hard refresh: **Cmd/Ctrl + Shift + R** (or use a fresh tab / private window once).
2. Prefer a **quiet day** for the first pass (e.g. later week, not a day members already use).
3. Optional name tag so we can find leftovers: `MIL-TEST` (e.g. `MIL-TEST · Mon AM Gym`).

---

## A. Logo (30 seconds)

1. Open the **landing / home** page (logged out or logged in — either is fine).
2. Look at **The Train Station** mark (header or hero circle).

| Check | Pass? |
|-------|-------|
| Logo sits on a **solid white circle** (not floating dark-on-dark) | ☐ |
| Mark is readable | ☐ |

**If fail:** screenshot + “logo still dark / no white plate.”

---

## B. Open Military and stay on the program (2 min)

1. **Admin → Programs**.
2. Tap **Military Preparation**.
3. You should land on the **Military calendar builder** (weeks + day chips), **not** bounce straight back to the Programs list.
4. Open **Week 1** (or any week you’re building).
5. Tap a day (e.g. Monday).

| Check | Pass? |
|-------|-------|
| Stay on Military after open (URL like `/admin/programs/boot-camp-preparation`) | ☐ |
| Day editor opens (Gym / Home / Day parts visible) | ☐ |
| You can switch weeks without being dumped to Programs list | ☐ |

**If you get kicked to Programs:** note what you tapped last (Save / 2 parts / Paste / Publish / back link).

---

## C. Multi-part day (AM + PM) — the Military pattern (3–4 min)

On the open day, find **Day parts**:

| Button | Meaning |
|--------|---------|
| **1 part** | Single session day |
| **2 parts** | Double day — AM + PM |
| **3 parts** | Triple — AM + midday (often cardio) + PM |

### Steps

1. Tap **2 parts**.
2. You should see part chips, e.g. **Part 1 · AM Session** and **Part 2 · PM Session**.
3. **Part 1:**
   - Tap **Gym Workout**.
   - Add 2–3 easy exercises (or paste later).
   - Set a simple name if asked / edit title if you use titles.
   - Tap **Save**.
4. Switch to **Part 2**.
5. **Part 2:**
   - Tap **Gym Workout** (or Home).
   - Add a **different** short block (e.g. run / core) so you can tell parts apart.
   - **Save**.
6. Switch **Part 1 ↔ Part 2** a few times.

| Check | Pass? |
|-------|-------|
| **2 parts** sticks (still selected after Save) | ☐ |
| Part 1 and Part 2 show **different** work (not the same list on both) | ☐ |
| Switching parts does **not** wipe the other part | ☐ |
| Hard refresh (**Cmd/Ctrl + Shift + R**) still shows **2-part day** + both sessions | ☐ |
| Day card on the grid shows something like **“2-part day”** | ☐ |

**Optional:** Tap **Copy Gym → Home** on Part 1 only — Home should get a **copy** of Gym; editing Home should not change Gym.

---

## D. Template save + paste (the “not tasting / not saving” path) (4–5 min)

This is the path that used to look broken: paste wrote to the server, but the screen kept an old empty workout.

### D1. Save a template from a day that already has exercises

1. Stay on Military, open a part that has exercises (Part 1 Gym is fine).
2. Open **Templates & paste** (violet panel).
3. **Save to template library** (or “Save current workout as template”):
   - **Title required** — type something, e.g. `MIL-TEST · Upper AM`
   - Category: type `military` (freeform — any word is fine)
4. Tap **Save to template library**.

| Check | Pass? |
|-------|-------|
| Message like “Saved template …” | ☐ |
| Save button stays off until the title is long enough (2+ characters) | ☐ |

**If Save won’t enable:** type a title — it will not save with a blank name (by design).

### D2. Paste that template onto another day / part

1. Open a **different** day (or Part 2 of another day).
2. Open **Templates & paste** again.
3. **Paste onto the day open above**:
   - Source: **Template library**
   - Pick `MIL-TEST · Upper AM`
   - Tracks: **Gym** (and **Home** if you want both)
   - **Name for this copy (required):** must be **different** from the template title  
     e.g. template = `MIL-TEST · Upper AM` → copy name = `MIL-TEST · W1 Tue AM`
4. Tap paste / confirm if it asks to replace existing Gym/Home content.

| Check | Pass? |
|-------|-------|
| Paste succeeds (success message) | ☐ |
| Exercise list **appears immediately** on that day/part (not blank) | ☐ |
| You are **still on Military builder** — not dumped to Programs list | ☐ |
| Hard refresh — exercises **still there** | ☐ |
| Open **Programs** list, re-enter Military — content still there | ☐ |

**If it looks blank after paste:** try switching Gym ↔ Home once, or Part 1 ↔ Part 2, then refresh. If still blank, tell John: week, day, part number, and template name.

---

## E. Copy from Adult / Athletes (optional, 3 min)

Safe path: **always clone** — Adult is never changed by pasting into Military.

1. **Admin → Programs → Adult Strength** (or Athletes).
2. Open a day you like → **Templates & paste** → save as template (`ADULT-XFER · Mon Gym` style).
3. **Programs → Military Preparation** → target day → paste with a **new copy name**.

| Check | Pass? |
|-------|-------|
| Adult day still unchanged after you paste into Military | ☐ |
| Military day has a **fresh copy** (edits on Military don’t change Adult) | ☐ |

Full write-up: [`JEREMY_CROSS_PROGRAM_COPY_SCRIPT.md`](./JEREMY_CROSS_PROGRAM_COPY_SCRIPT.md)

---

## F. Publish (when you mean members to see it)

1. On a finished day: **Save**, then **Publish**.
2. Unpublished = draft for you; published = members can see that day.

| Check | Pass? |
|-------|-------|
| Publish doesn’t kick you to Programs list | ☐ |
| After refresh, day still shows as published / content intact | ☐ |

---

## Quick pass/fail (print / screenshot)

| # | Check | Pass? |
|---|--------|-------|
| 1 | Logo has white circle background | ☐ |
| 2 | Open Military and stay on the builder | ☐ |
| 3 | 2-part day: AM vs PM stay different after Save + refresh | ☐ |
| 4 | Save template only works with a title | ☐ |
| 5 | Paste template with a **new** copy name → exercises show and stick | ☐ |
| 6 | No random dump back to Programs list during Save/Paste/parts | ☐ |

---

## What we fixed (so you know what to expect)

1. **Paste “not saving”** — server was saving; the screen wasn’t reloading the new copy. After paste it should now open the **new** Gym/Home workouts on the correct part.
2. **Multi-part** — Part 2 no longer shares Part 1 by accident; each part has its own Gym/Home.
3. **Logo** — white plate behind the mark.

---

## If something still fails

Text John with:

1. **Week + day** (e.g. Military W1 Monday)  
2. **1 / 2 / 3 parts** and which **part**  
3. **Gym or Home**  
4. What you tapped last (**Save / Paste / 2 parts / Publish / Programs**)  
5. Screenshot if easy  

Optional engineering re-check (John’s machine):

```bash
BASE_URL=https://www.thetrainstation.co ROUNDS=4 \
  node scripts/military-paste-logo-soak.mjs
```

Related: multi-part walkthrough → [`JEREMY_TRIPLE_DAY_SCRIPT.md`](./JEREMY_TRIPLE_DAY_SCRIPT.md)

---

## Your content plan (reminder only — not this test)

| Program | Your note |
|---------|-----------|
| Adult | First weeks pretty good |
| Athletes | ~6 weeks good |
| **Military** | Next to load (use this script while building) |
| Mom & Dads | After Military |
| Exercise videos | Keep uploading the 3 demos |

Happy building — paste is always a **clone**, never a shared live link.
