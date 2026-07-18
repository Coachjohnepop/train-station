# Jeremy — Adult weeks 3–6 → Athletes (template method)

**Site:** https://www.thetrainstation.co  
**Time:** ~20–40 min for one full week; ~1.5–2 hrs for weeks 3–6 if both Gym + Home  
**Goal:** Overlay **Adult W3–W6** onto **Athletes W3–W6** without touching Adult or Athletes W1–W2.

**Why this way:** “Copy week” only works **inside** one program. Templates jump programs safely — always a **fresh clone**. Adult stays put.

---

## Setup (2 min)

1. Incognito + hard refresh (**Cmd/Ctrl + Shift + R**).
2. Log in as coach → **Admin → Programs**.
3. Optional name tag so we can find leftovers later: start template names with **`A2A`**  
   (Adult → Athletes), e.g. `A2A · W3 Mon Gym`.

### Protect these

| Keep as-is | Do not paste on |
|------------|-----------------|
| Adult — everything | (you only **save** templates from Adult) |
| Athletes **Week 1** | any W1 day |
| Athletes **Week 2** | any W2 day |

Only open **Athletes Week 3, 4, 5, 6** when pasting.

---

## The pattern (learn once, repeat)

### Step 1 — Save from Adult

1. **Admin → Programs → Adult Strength Conditioning** (`adult`).
2. Jump to the source week (start with **Week 3**).
3. Open the day (e.g. **Monday**).
4. Open **Gym** so that workout is the focused one.
5. Open **Templates & paste** (violet control on the builder).
6. Under **Save current workout as template**:
   - **Name:** `A2A · W3 Mon Gym`
   - **Category:** `adult` (or type anything — freeform)
   - **Version tag (optional):** `v_w3`
7. Tap **Promote to template library**.
8. You should see something like: *Saved template … paste anytime (always a fresh copy).*

If you use **Home** on that day:

9. Switch to **Home Workout** on the same day.
10. Save again as `A2A · W3 Mon Home`.

### Step 2 — Paste onto Athletes (same week/day)

1. **Admin → Programs → Athletes — Speed, Strength & Conditioning** (`strength-training`).
2. Jump to **Week 3** (not 1 or 2).
3. Open the **same weekday** (Monday).
4. Open **Templates & paste** again.
5. Under **Paste workout → this day**:
   - Source: **Template library**
   - Pick `A2A · W3 Mon Gym`
   - Check **Gym track** (uncheck Home if you’re only pasting Gym right now)
6. Tap **Paste as copy**.
7. Confirm the day now shows Adult’s exercises.
8. Repeat for **Home** with `A2A · W3 Mon Home` if needed (check **Home track** only).

### Step 3 — Sanity check (do this once per week)

1. Stay on Athletes — change **one** sets/reps value on the pasted day.
2. Open **Adult** same week/day → that value must **still be the old Adult number**.
3. Athletes W1 / W2 Monday → must still be **your existing Athletes** content, not Adult.

**Pass:** Athletes changed, Adult unchanged, W1–W2 untouched.

### Step 4 — Publish when ready

On Athletes, open the day → **Publish** when members should see it.  
(Paste leaves a draft copy; publish is still your call.)

---

## Week-by-week checklist

Do **Mon → Sun** for each week. Gym only is fine first; add Home on a second pass.

### Week 3

| Day | Save on Adult | Paste on Athletes W3 | Done |
|-----|---------------|----------------------|------|
| Mon Gym | `A2A · W3 Mon Gym` | Paste Gym | ☐ |
| Mon Home | `A2A · W3 Mon Home` | Paste Home | ☐ |
| Tue Gym | `A2A · W3 Tue Gym` | Paste | ☐ |
| Tue Home | `A2A · W3 Tue Home` | Paste | ☐ |
| Wed Gym | `A2A · W3 Wed Gym` | Paste | ☐ |
| Wed Home | `A2A · W3 Wed Home` | Paste | ☐ |
| Thu Gym | `A2A · W3 Thu Gym` | Paste | ☐ |
| Thu Home | `A2A · W3 Thu Home` | Paste | ☐ |
| Fri Gym | `A2A · W3 Fri Gym` | Paste | ☐ |
| Fri Home | `A2A · W3 Fri Home` | Paste | ☐ |
| Sat Gym | `A2A · W3 Sat Gym` | Paste | ☐ |
| Sat Home | `A2A · W3 Sat Home` | Paste | ☐ |
| Sun Gym | `A2A · W3 Sun Gym` | Paste | ☐ |
| Sun Home | `A2A · W3 Sun Home` | Paste | ☐ |

Then **Publish** the W3 days you want live.

### Week 4

Same table — rename tags to `A2A · W4 …` · paste only on **Athletes Week 4**.

### Week 5

Tags `A2A · W5 …` → **Athletes Week 5**.

### Week 6

Tags `A2A · W6 …` → **Athletes Week 6**.

---

## Faster tricks (optional)

### Reuse a template name pattern
You don’t need perfect names — but **W# + day + Gym/Home** makes it obvious in the dropdown.

### Gym only first
If Home is often “same as Gym,” do all **Gym** days for W3–W6 first, then on Athletes use **Copy Gym → Home** *per day* (same program — safe).  
Only do that when Home should match Gym.

### Don’t use these for this job

| Avoid | Why |
|-------|-----|
| **Copy from week N** on Athletes to “get Adult” | Only copies **Athletes → Athletes**, not Adult |
| **28-day pack** paste onto Athletes | Can replace a whole month (risk to W1–W2 if you confirm) |
| Pasting on Athletes W1 or W2 | Overwrites the weeks you already finished |

---

## After W3 is solid (optional speed-up)

If for some reason W4–W6 on Adult were **identical** to W3, you could **Copy week** *inside* Athletes (W3 → W4…).  
They’re **not** identical for your plan — you want Adult W4 content on Athletes W4, etc. — so **stay on the template path per week**.

---

## Pass / fail

| Check | Pass? |
|-------|-------|
| Can **Promote to template library** from Adult | ☐ |
| Template appears in the pick list | ☐ |
| Paste lands on Athletes W3+ day | ☐ |
| Adult day unchanged after paste | ☐ |
| Athletes W1–W2 unchanged | ☐ |
| Edit Athletes sets → Adult stays | ☐ |
| Publish Athletes day sticks after refresh | ☐ |

---

## If something looks wrong

Text John with:

1. Adult week/day you saved from  
2. Athletes week/day you pasted to  
3. Template name  
4. Screenshot if the paste button is grey / error toast  

---

## One-line model

**Adult = camera. Template = photo. Athletes day = wall you hang the photo on. Taking a photo never changes the room you photographed.**
