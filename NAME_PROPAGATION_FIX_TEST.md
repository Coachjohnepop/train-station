# Short Test Script: Exercise Name Propagation Fix (Deployed)

**Purpose**: Quick validation that admin exercise name edits (and deletes) now correctly appear in workouts and when drilling in from program schedules. This was the #1 issue from the June 13 customer review.

**Target**: Production (https://thetrainstation.co) after the 6da5f2a deploy.

**First, confirm you're on the new code** (important in incognito):
- Go to https://github.com/Coachjohnepop/train-station/commits/main and look for the Vercel deployment check on commit `6da5f2a`.
- Or in Vercel dashboard → Production → latest deploy should reference that commit.
- If the deploy status is still "Building" or "Queued", wait and retry the test in a fresh incognito window. Vercel edge caches can take a couple minutes to fully propagate.

**Assumptions**:
- You are using a **brand new incognito/private window** (no extensions, no cached state, no logged-in sessions from regular browser).
- Hard refresh (Cmd/Ctrl + Shift + R) after every major step. In incognito + prod, also open Network tab in DevTools → check "Disable cache" before refreshing.
- Using the demo / coach admin flows (no real login required in this mode).
- Focus only on this fix — ignore other admin quirks for now.

---

## 1. Edit an Exercise Name in the Library

1. In a **brand new incognito window**, go to: `https://thetrainstation.co/admin/exercises`
2. Find one of these real exercises used in the Adult program (Week 1):
   - "Dumbbell Flat Bench Chest Press"
   - "Seated Back Row Machine or" (messy one — great for rename test)
   - Or any "Dumbbell ... Press" / "Back Row"
3. Click the **Edit** button next to the name.
4. Append something obvious and unique for this test, e.g.:
   - `Dumbbell Flat Bench Chest Press [INCognito-TEST-0613]`
5. Click **Save**.
6. Open DevTools (F12) → Network tab → enable "Disable cache".
7. Hard refresh the page (Cmd/Ctrl + Shift + R).
   - **Expected**: New name is visible and stays after refresh. (This is the library side, which worked before — the real test is step 2.)

## 2. Verify the Name Appears in the Workout (via Program Schedule)

This is the critical path that was broken before.

1. Go to: `https://thetrainstation.co/admin/programs`
2. Click **Adult** (the main hybrid program the customer was using).
3. Expand **Week 1**.
4. Click the **Gym** (or **Home**) option for **Day 1**.
5. You land in the workout editor for that day's workout (e.g. "Day 1 Upper Body Workout (Gym)").
6. Scroll to the exercise list.
   - **Expected**: The exercise you just renamed now shows the **new name** (with `[FIX VERIFIED]`).
7. Hard refresh this page.
   - **Expected**: Name is still correct (no revert to old value).

## 3. Cross-Check Navigation & Consistency

1. Go back to the Programs > Adult page (or hard refresh it).
2. Try Day 2 or another day that uses the same exercise.
3. Return to `/admin/exercises` and hard refresh.
   - **Expected**: The edited name is still there. No "disappearing" behavior.

## 4. (Optional) Member-Side Check

1. Go to `https://thetrainstation.co/member`
2. Enter the Adult program and open a workout day that contains the edited exercise.
3. **Expected**: The updated name appears in the member workout console (no more stale names for the client experience).

## 5. Delete Test (Bonus)

1. In `/admin/exercises`, delete a non-critical exercise (or the one you just tested).
2. Hard refresh the library.
3. Go back to a workout that previously listed it.
   - **Expected**: It is removed from the library. In the workout list it either disappears or shows as "Unknown" (we can clean dangling references in a follow-up).

---

## After Testing

- The test names you added live only for the current session on prod (demo mode is file-backed at build time).
- To make a real change permanent for the next deploy:
  1. Do the edit locally.
  2. Run `npm run db:export-seed` (or just commit the updated `prisma/seed-data.json` + `prisma/exercises.dev.json`).
  3. Push.

- Revert test data locally if desired:
  ```bash
  git checkout -- prisma/seed-data.json prisma/exercises.dev.json
  ```

**This script directly demonstrates the June 13 customer feedback fix.** If this flow now works end-to-end on prod (library → program drill-down → workout list shows update immediately), the core admin content ownership problem is resolved.

Run this with the customer and note any remaining friction.