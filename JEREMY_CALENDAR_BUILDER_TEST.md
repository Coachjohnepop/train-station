# Jeremy — Program calendar builder (~10 min)

**Site:** https://www.thetrainstation.co  
**Path:** Admin → Programs → **Adult Strength**

Use incognito + hard refresh (Cmd/Ctrl + Shift + R).

---

## 1. Build Week 1

1. Tap **Week 1** (should already be selected).
2. Tap **Mon** on the calendar grid.
3. Tap the **Gym** pill (or **+ Add setting** if needed).
4. Use the **+ exercise pills** or search to add 4–5 movements.
5. Set **Sets / Reps / Rest** at the top, then **Apply to all exercises** if you want one prescription for the day.
6. Tap **Finish & publish** when that day looks right.
7. Repeat for **Tue–Sun** (Home too if you use it).

**Pass:** Each day shows exercises; published days show a green “Published” dot on the grid.

**Fail:** Exercises vanish after refresh, or publish does nothing → text John.

---

## 2. Duplicate inside the same week (optional)

On any day with a full workout:

1. Open the day editor.
2. Tap **Duplicate to other days…**
3. Check **Tue–Sun** (or other days in the month grid).
4. Tap **Copy to N day(s)**.

**Pass:** Checked days get their **own** workout copies (editing one day does not change another).

---

## 3. Copy Week 1 → Week 2 (main workflow)

1. Finish Week 1 (all days you care about).
2. Tap **Week 2** in “Jump to week”.
3. Tap **Copy from week 1** (top right of the week card).

**Pass:** Week 2 Mon–Sun match Week 1 structure. Change sets/reps on **Week 2 Monday only** → **Week 1 Monday stays the same**.

**Fail:** Week 2 is empty, or editing Week 2 changes Week 1 → text John.

---

## 4. Fill the rest of the program (optional)

1. Go back to **Week 1**.
2. Tap **Copy to all remaining weeks**.

**Pass:** Weeks 3–4 (and any others) populate with independent copies.

---

## 5. Lock in content for good (John)

When you’re happy with Adult Week 1–4:

1. Admin → **Programs** (list page).
2. Tap **Export seed snapshot** → save the JSON.
3. Send John the file or confirm he committed it — that makes the content survive redeploys even beyond cloud blob.

---

## Quick feedback for John

- Does the **week calendar + Mon–Sun squares** match how you think about the month?
- Is **Copy from week 1** obvious enough on Week 2?
- Anything still slower than “last year’s” tool?