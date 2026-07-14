# Jeremy — Triple (multi-part) days · Military & boot prep

**Site:** https://www.thetrainstation.co  
**Where:** Admin → **Programs** → **Military Preparation** (or any program)  
**What this is:** One calendar day can have **1, 2, or 3 sequential sessions** (e.g. AM lift · midday fasted cardio · PM work).  
**Gym vs Home** still live *inside* each part — they are not separate parts.

---

## 5-minute walkthrough

### 1. Open a day
1. Log in as coach.  
2. **Admin → Programs → Military Preparation**.  
3. Click any day (try a quiet week day first so you don’t overwrite live content).

### 2. Make it a 3-part day
In the day editor, find **Day parts**:

| Button | Meaning |
|--------|---------|
| **1 part** | Normal single session |
| **2 parts** | Double day — AM + PM |
| **3 parts** | Triple day — AM + **midday (cardio default)** + PM |

Tap **3 parts**. You should see tabs like:

- **Part 1 · AM Session**  
- **Part 2 · Midday Session (cardio)**  
- **Part 3 · PM Session**

### 3. Fill each part
1. Tap **Part 1**.  
2. Choose **Gym Workout** / **Home Workout** (same as always).  
3. Add exercises, sets, reps, coach notes.  
4. Tap **Part 2** → put **Fasted cardio** or a light cardio block.  
5. Tap **Part 3** → evening session.  
6. **Save**. **Publish** when members should see the day.

### 4. Check the grid
Day cards show **“3-part day”** (or “2-part day”) so you can spot multi-session days at a glance.

### 5. Optional names
When you create workouts for a test, include **`TRIPLEDAYS`** in the name so we can find/clean them later, e.g.:

- `TRIPLEDAYS · AM strength`  
- `TRIPLEDAYS · midday fasted cardio`  
- `TRIPLEDAYS · PM strength`

---

## What *not* to confuse

| Concept | Meaning |
|---------|---------|
| **Part 1 / 2 / 3** | Time of day on *one* calendar day (sequence) |
| **Gym / Home** | Location *tracks* for one part |
| **Copy week** | Still clones whole days — multi-part copies improve over time; verify after copy |

---

## Quick pass/fail

| Check | Pass? |
|-------|-------|
| Day parts control shows 1 / 2 / 3 | ☐ |
| Switching to **3 parts** shows three part tabs | ☐ |
| Part 2 defaults to cardio-style label | ☐ |
| Can assign different workouts to Part 1 vs Part 3 | ☐ |
| Save + refresh still shows 3 parts | ☐ |
| Grid shows “3-part day” | ☐ |

---

## If something looks wrong

Tell John: program name, week/day, and whether you used 2 or 3 parts.  
Engineering soak (optional):

```bash
ROUNDS=2 BASE_URL=https://www.thetrainstation.co node scripts/tripledays-soak.mjs
```

Report: `scripts/.tripledays-soak-latest.json`
