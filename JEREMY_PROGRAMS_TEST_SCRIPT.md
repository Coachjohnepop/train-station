# Jeremy — Programs Builder Test Script (Tight Gym/Home + Exercise Picking Flow)

**Date / Context**: June 2026 — Test of the new "under Programs" workflow you described:
> "under programs it would have a simple adult (not so big) pick gym or at home then pick the exercises then save it go to each day and post then copy that week into a following week easy changes should be sets and the reps - sometimes exchange an exercise, delete or add"

**Goal**: Validate that the Programs screen is now the fast, compact place where you directly build real client content without leaving the page or wasting space. One focused editor strip. Live saves. Obvious copy-week.

**Important setup for this test (do every time)**:
- Use **incognito / private window** (no cached admin state).
- Hard refresh (Cmd/Ctrl + Shift + R) on every page.
- Start from the **latest Vercel preview** for this branch (John will give you the exact URL after the push that contains these Programs changes). Keep the previous baseline open in another tab for quick visual comparison if you want.
- You are the coach (go to /admin — you should land in the admin layout).
- We are in demo mode, so all changes you make are real for the session and written to the committed data files. If you want permanent content changes, tell John to run the export + commit.

---

## 1. Get to the Programs list (tight landing)

1. Go to `/admin/programs`.
2. You should see a short list of programs (Adult is the main one for this test).
3. Note the header is now very short: just "Programs" + one sentence explaining the intended use.

**Verify / Note**:
- Does it feel clean and "not so big"?
- Any text that feels like wasted space?

**Quick feedback**: Does this page make you want to click into Adult right away?

---

## 2. Enter the Adult program (the main hybrid program)

1. Click the **Adult** card.
2. You land on a very compact header: short title + slot count + weeks. No big descriptive wall of text.
3. The entire builder below is the new tight surface.

**Verify**:
- No giant "Assign workouts to program" heading (we removed the noise).
- The top instruction line is tiny and directly references "pick Gym or Home → pick exercises".

**Feedback prompt**: First impression of the density compared to what you saw in the June 13 recording?

---

## 3. Pick Gym or Home and start building (core new flow)

Do this on **Week 1** first (easy to see the effect).

For **Monday** (or any day):

1. Click **+Gym** on that day row.
2. A tiny Gym pill appears with a label input + "build…" text.
3. Immediately click **+ex** on that Gym pill (or click the "build…" text).

The single compact **editor strip** should appear / expand at the bottom (sticky so you don't lose it).

**In the editor strip**:
- It should say exactly what you're editing: "Week 1 · Monday — Gym"
- There is a search box + a row of quick "+ Bench Press", "+ Squat", etc. pills.
- Below that, the current exercise list area (starts empty or with whatever was seeded).

4. Type in the search box (try "bench", "row", "squat", "press", "core", or a body part).
5. Click 4–5 different **+ Exercise** pills to add them.

**Expected**:
- Each pill add instantly appends a dense row at the bottom of the strip.
- Default is sensible: 3 sets × 8-10 reps.
- The row shows: Exercise name | sets [editable number] | reps [editable text] | swap dropdown | ×

6. **Immediately test the "easy changes"**:
   - On two of the rows, directly type new numbers in the **sets** box (e.g. change 3 → 4) and new text in **reps** (e.g. "5-8" or "AMRAP").
   - Tab or click away — it should save live (no separate save button).
   - Watch for the little "Saving…" or success message if any.

7. **Test exchange an exercise**:
   - On one row, open the **swap…** dropdown.
   - Pick a completely different exercise (e.g. swap a press for a pull or a leg move).
   - It should replace the name but keep the sets/reps numbers you just edited.

8. **Test delete + add**:
   - Click × on one exercise.
   - Then add 1–2 more via the pills (or by typing a new search term).

9. Click the small **"full workout page"** link in the editor header.
   - This takes you to the classic WorkoutBuilder for that slot (the older full page).
   - Make one small change there (e.g. edit notes or add one more exercise the old way).
   - Come back to /admin/programs/adult and hard-refresh the Programs page.
   - Confirm your change is visible in the schedule rows / editor strip.

**Do the same quick flow on one day in Week 2** (add a couple Home options + exercises) so you have material to copy.

**Feedback prompts while doing this**:
- Does picking Gym/Home then immediately picking exercises feel like the flow you described?
- Is the editor strip "not so big" / non-wasteful? Or still too much vertical space?
- Editing sets and reps directly in the list — does that feel fast enough for daily use?
- Swap (exchange) while keeping your sets/reps — does that match "sometimes exchange an exercise"?
- Any friction adding the 4th or 5th exercise?

---

## 4. Copy that week into a following week (the bulk action)

Still in the Adult program:

1. Look at the **Week 1** header (right next to the week title).
2. Use the **"Copy to this week"** button on **Week 2** (it should copy Week 1 → Week 2).
3. After it finishes, hard refresh the page.
4. Open Week 2 and verify the Gym/Home options + the exact exercises (with your edited sets/reps) are now there.

5. Bonus: Clear one day in Week 3 to "rest" using the clear button, then copy a different week over it.

**Verify**:
- The copy is fast and only affects the target week.
- Exercise names, your custom sets/reps, and the Gym vs Home labels all come across.
- The schedule view immediately reflects the copied content (no need to go into each day).

**Feedback**:
- Is the copy-week action obvious and in the right place?
- After copying, do you trust that the following week is now "done" for that client?
- Would you want a "copy this week to all remaining weeks" button too, or is per-week copy enough?

---

## 5. See the result in the schedule + drill to full editor (sanity)

1. Back on the main Programs builder view (no editor strip open).
2. Look at the day rows for the weeks you touched.
   - You should see abbreviated workout names or "build…" and some sense of how many exercises are attached.
3. Click one of the option names or a "+ex" again — the editor strip should re-open with the current live data.

4. Optional but recommended: Go to the member side (or ask John for the member view of Adult) and navigate to one of the days you built.
   - Can you see the Gym vs Home choices?
   - Do the exercises you added appear with the sets/reps you set?

**Feedback**:
- Does the main schedule view feel scannable now (you can see at a glance what each day has)?
- Any names that came out weird from the auto-naming when we created the slot?

---

## 6. Regression / Polish checks (5 minutes)

- Go back to `/admin/workouts` (the old list). Create one new workout the classic way. Then come back to Programs and assign it via the legacy path on a day that still has a dropdown/select. Does everything still work?
- Hard refresh the Programs page after all your edits. Do your sets/reps/exercises survive?
- Try the old "edit →" link from a day option (if any legacy links remain) — it should still go to the full workout page.
- Resize the browser or glance at it on your phone — the day rows and the bottom editor strip should not blow up or become unusable.
- If you added a brand new movement via the pills that didn't exist before, go to `/admin/exercises` quickly and confirm it is (or isn't) polluting the library (it shouldn't — we only pick from existing).

---

## 7. Final feedback questions (please answer these explicitly)

1. **Overall feeling**: On a scale of "this is exactly what I described" to "still not there yet", where does the new Programs flow land?
2. **Density**: Is it "simple adult (not so big)" and respectful of screen real estate, or are there still places that feel padded or slow?
3. **The editor strip**: One shared bottom strip instead of opening big panels or new pages — love it, hate it, or "make it even smaller"?
4. **Sets & reps + exchange**: Do the direct number fields + swap dropdown give you the "easy changes" speed you want for real client programming?
5. **Copy week**: Is this now fast enough that you would actually use it to build 4 weeks without dreading it?
6. **Missing anything small?** One button, one label, one default value, one extra action that would make this your daily driver for content?
7. **Anything that broke** from the June 13 version (old way of assigning workouts, links, etc.)?

---

## After you're done

- Take 2–3 screenshots or a short Loom of the flow (especially adding exercises + editing sets/reps in the strip + copying a week).
- Tell John which preview URL you tested.
- If you made real content changes you want to keep for the live site / next client, say the word and we'll run the export + commit the data files.

This should be a 12–18 minute focused session if you move quickly. The whole point is that building a real week for a client should now feel boringly fast and contained inside Programs.

Thanks — your direct "does this match the words I said?" feedback is what makes the next iteration correct. Fire away.