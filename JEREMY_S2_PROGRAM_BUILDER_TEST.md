# Text Jeremy — Program builder (S2)

Copy/paste:

---

Hey Jeremy — **step 2 is live** on the real site:

**https://www.thetrainstation.co**

**Admin → Programs → Adult Strength**

**Build Week 1**
1. Click **Mon** (or **+Gym** on any day)
2. Add exercises with the **+ pills** at the bottom — tweak sets/reps there
3. Or **Pick workout…** to attach a workout you already built
4. Do Tue–Sun; use **+Home** when you need a home version

**Copy the week**
- Week 2 → **Copy to this week** (each day gets its own copy — editing Week 2 won’t mess up Week 1)
- Week 1 → **Copy to all remaining** (fills the rest of the program)

**Pass:** Week 2 matches Week 1, but change reps on Week 2 Monday only → Week 1 Monday stays the same.

**Fail:** Gym/Home vanish on copy, or Week 2 edits change Week 1 → text me.

Step 3 next: clean up program names (drop junk, Military Prep, Mom & Dads, etc.).

---

## John — automated check

```bash
BASE_URL=https://www.thetrainstation.co npm run test:s2
```