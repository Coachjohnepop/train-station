# Jeremy — what’s left on The Train Station

**Site:** https://www.thetrainstation.co  
**Coach login:** `jeremy@thetrainstation.co` (blank password)

Your written feedback and the July 5 screen recording are **built and on prod**. What’s left is mostly **your content** and a few **tap-to-verify** checks on your phone.

---

## 1. Paste your YouTube links (Admin → Landing)

| Field | Where members see it |
|-------|----------------------|
| **Welcome video** | Landing page intro (“Watch intro”) |
| **Free ticket chastise video** | After the ~20s Rick roll on the Free ticket |
| **Weekly coach video** | Top of **Member → Today** (hover to play) |
| **What’s for dinner** | Second card on **Member → Today** |

Save each section after pasting. Use full YouTube URLs (`https://www.youtube.com/watch?v=…`).

---

## 2. Load real Adult Strength content

The calendar has **Week 1 & 2 templates** so copy-week works. Replace placeholders with your real program:

1. **Admin → Programs → Adult Strength**
2. **Week 1** — Mon–Sun: Gym/Home workouts (paste via **Upload translation** or pick from library)
3. **Week 2** — use **Copy to this week**, then tweak sets/reps (Week 1 stays unchanged)
4. **Save**, then **Publish** days you want members to see

**Quick path:** paste a week block with Upload translation → assign to each day.

---

## 3. Five-minute verification (phone + desktop)

- [ ] **Free ticket** — tap Free → Rick ~20 seconds → your chastise video fades in
- [ ] **Welcome video** — landing “Watch intro” plays your link
- [ ] **Member Today** — weekly + dinner videos play on hover
- [ ] **SMS** — Admin → SMS Hub → send yourself a test; confirm it arrives
- [ ] **Program builder** — delete an exercise, refresh → still gone; move exercise order with ▲▼

---

## 4. Optional cleanup (when you have time)

- Rename or delete generic exercise names (e.g. “Bench Press”) in **Admin → Exercises**
- Hide/remove workouts you don’t use in the library
- Nutrition tier copy on **Member → Nutrition** — edit sample days in Admin → Landing if you want your wording

---

## Already done (no action needed)

- Drag/reorder exercises in program builder (▲▼ + upload translation)
- **Save** and **Publish** on program days
- Delete exercises — persists after refresh
- Upload translation (paste workout text → exercises)
- Message flow, nutrition calorie tiers (1600 / 2000 / 2500)
- Week 2 copies separate workouts from Week 1 (edit Week 2 without breaking Week 1)
- Landing logo + “The Train Station” on phone/desktop
- Coach Class + 1st Class checkout; free ticket copy (no nagging follow-up)

---

## If something looks wrong

Tell John what you clicked and what you expected. For a quick engineering check:

```bash
BASE_URL=https://www.thetrainstation.co npm run test:jeremy-loop
```

Questions? Reply on your usual channel or book a quick screen share.