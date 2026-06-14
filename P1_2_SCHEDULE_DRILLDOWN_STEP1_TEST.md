# P1.2 — Easier Drill-down from Program Schedule (Step 1: Direct Edit Links)

**From the Jun 13 transcript / action plan (P1.2)**

Jeremy's pain: After the hybrid changes, the schedule view became confusing.
- "I don't know what all this shit is."
- Hard to tell what actual workout content was behind each "Gym" or "Home" option.
- Previous (non-hybrid) flow was easier: you could click a day and immediately see/edit the workout.

**This small slice (step 1 of 3):** Add obvious, direct "edit →" links on every day option so you can jump straight to the workout builder for that exact content. No more hunting.

---

## Test Script (for the new preview after this push)

**Target**: New Vercel preview from commit that includes the edit links in ProgramScheduleBuilder (P1.2 step 1).

**Assumptions**:
- Fresh incognito window.
- Hard refresh (Cmd/Ctrl + Shift + R) after navigation.
- Adult program is the best test case (has multiple hybrid options per day).

### Steps

1. Go to the **new preview URL** (the one Vercel posts for this push — look for the deployment linked to the schedule-builder change).

2. Navigate to **/admin/programs/adult** (or the main Adult program in the list).

3. Expand **Week 1**.

4. Look at **Day 1** (or any day with options).

   - You should now see rows for the labeled options (e.g. "Gym" and "Home").
   - Next to the workout select/dropdown for each option, there is now a small **"edit →"** link.

5. Click the **"edit →"** link on the **Gym** option for Day 1.

   **Expected**:
   - You are taken directly to `/admin/workouts/[the-workout-id]` for that exact workout.
   - You land in the WorkoutBuilder for that content (exercises, schemes, notes, etc.).
   - You can edit and save as normal.

6. Use the back link or browser back to return to the program schedule.

7. Repeat for the **Home** option on the same day (or another day).

   **Expected**: Separate edit link takes you to the Home version's workout builder.

8. Try a day that has only one option or the legacy "Standard" label.

   **Expected**: The edit link still appears when a workout is assigned.

### What this fixes (for Jeremy)
- One-click access to the actual workout content from the schedule view.
- No more "I don't know what all this shit is" — you can immediately go look at/edit the exercises.
- Keeps the existing flow for assigning/re-labeling options intact.

### After testing this preview
- If the links work cleanly and feel obvious, say the word and we'll do **Step 2** (compact exercise name preview directly on the option rows so you don't even have to click to see what's inside).
- Then Step 3 (the "View as member would see this day" link).

**Next preview will include the follow-up steps once approved.**

---

**One small verifiable change per push**, per the plan. This was the first micro-slice of P1.2.

Let me know the results on the new preview (or any tweaks to the link text/placement). Ready for step 2 when you are!