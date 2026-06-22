# Text Jeremy — Bulk entry + export (S4)

Copy/paste:

---

Hey Jeremy — **step 4 is live**:

**https://www.thetrainstation.co**

**Load a week in ~10 minutes**

1. **Admin → Workouts** — build or text-upload any workouts you need (names must match exactly)
2. **Admin → Programs → Adult Strength** — open **Text Upload**, paste:
   ```
   Day 1 Gym: Day 1 Upper Body Workout (Gym)
   Day 1 Home: Day 1 Upper Body Workout (Home)
   Day 2 Gym: Day 2 Lower Body Workout (Gym)
   ...
   ```
3. Pick **Week 1** → **Build & save** — Mon–Sun Gym/Home slots fill in one shot
4. **Week 2** → use **Copy to this week** (from step 2) to clone, then tweak
5. When happy → **Export seed snapshot** (top right on Programs) → send John the JSON to commit

**Pass:** Paste fills the week; export downloads a JSON file with your programs/workouts.

**Fail:** Workout names don’t match library, or export errors → text me.

---

## John — one command (S3 + S4)

```bash
BASE_URL=https://www.thetrainstation.co npm run test:s3-s4
```