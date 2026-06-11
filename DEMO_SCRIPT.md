# Train Station App - Comprehensive Demo Script & Test Guide

**Purpose**: This is a complete walkthrough of **all major features** of the Train Station app. It is designed to be followed step-by-step in a browser while the dev server is running (`npm run dev` at http://localhost:3000).

It also doubles as a **full end-to-end test script**:
- Every step has an **"Expected / Verify"** section.
- Follow the numbered steps in order.
- Use the demo user (pre-configured in the system).
- Test both happy paths and edge cases (partial logging, substitution, independent programs, hybrid gym/home options, equipment inventory, etc.).
- If something doesn't match "Expected", note it as a bug.

**Assumptions**:
- Dev server is running cleanly (no errors in terminal).
- You are using a modern browser (Chrome/Firefox recommended).
- Start fresh (hard refresh pages with Cmd/Ctrl+Shift+R when needed).
- All data is in demo/seed mode (no real DB required; uses committed prisma/seed-data.json + *.dev.json).
- **Fresh review mode** (current default after reset): empty user data (0 enrollments, 0 logs, 0 equipment, empty settings) for testing the complete new-user path (join → questions assessment + rec → pricing with highlight → enroll → onboard wizard → dashboard). Core programs, exercises, and seed content are fully intact.
- (For full populated demo: you can restore from .bak files or manually enroll + log via the UI.)
- Adult is now a **hybrid program** with per-day Gym vs Home workout options (mix environments freely within one enrollment). Equipment inventory can be set in the widget.

**Quick Start**:
1. Open terminal in `projects/train-station`.
2. `npm run dev`
3. Open http://localhost:3000 in browser.
4. Bookmark the tabs you will use: Landing, Member, Admin, specific program pages.

---

## Section 0: Landing Page & Branding (Public)

1. Go to http://localhost:3000 (or click logo from anywhere).
2. **Hero section**:
   - 4 rotating background images (black guy doing DB bench, curly girl, diverse man, hot Asian woman doing curls).
   - Large headline rotates: "Train with Purpose." → "Train with Passion." → "Train with Goals." → "Train with Commitment." (should change **every half photo** — text flips midway through each image crossfade).
   - Subheadline, "Start Training" (white bg, black text, hover scale), "For Coaches" button.
   - Bottom tags: "4-WEEK PROGRAMS • LIVE SESSIONS • COMMUNITY".
   - Logo top-left (clickable to /member).
3. Scroll or use indicators at bottom to manually change images.
4. **Expected / Verify**:
   - Text changes at exactly 1/2 the image rate (not synced to image changes).
   - No layout shift, professional dark gradients, good contrast.
   - Responsive: on mobile it stacks nicely.
   - Clicking "Start Training" goes to /member (demo user view).

**Test note**: This tests the updated LandingHero rotation logic.

---

## Section 0.5: New User Onboarding Flow (Join → Questions Assessment + Recommendation → Pricing with highlight)

(This is the new middle landing + rec feature from recent iteration. Primary path for fresh review / client testing.)

1. From landing, click the prominent **"Join the site"** button (or go directly to /join).
2. On /join (pricing overview):
   - See the callout "NOT SURE WHICH PLAN?" with "Take the 1-minute assessment →" button.
   - Click it (or use header "Skip to pricing" to test the other way).
3. **Questions page** (/join/questions):
   - Fill the 4 questions: exercise frequency (select), structured program (radios), eating/nutrition (select), main goal (select).
   - Click "See my recommendation".
   - Verify a recommendation card appears (Explorer / Member / Pro) with reason based on simple logic (freq + structure + eating + serious goal).
4. From the rec screen:
   - Click "See all membership options" — this should go to /join?rec=XXX and highlight the matching tier card with a "RECOMMENDED" badge + ring/border.
   - Or click "Start with the recommended (demo)" → goes to /member (fresh 0-state).
5. Back on /join, confirm the recommended tier is visually emphasized.

**Expected / Verify**:
- Questions are quick and relevant to current habits (eating + exercise).
- Rec logic produces sensible suggestion.
- ?rec param drives highlight on pricing (new integration).
- "We'll refine the packages later" note is present.
- Flow feels like a guided middle step before full pricing.

**Test note**: This directly addresses the transcript request for a middle assessment before pricing.

---

## Section 1: Member Dashboard (Core Member Experience) — Fresh Review + Updated Reorg

**Note for this test run (fresh review state)**: With current .dev.json reset (0 enrollments, 0 logs, 0 equipment), "Currently enrolled" and "Continue" blocks are hidden. Metrics show 0s. Use this to test the new-user experience after the join/questions flow. Strength explanation is now in a collapsible <details>. A new "Workouts logged + ranking" snippet appears "down here" (after strength details, before Programs). Programs section is collapsed. Quick actions at bottom are also collapsible.

1. Go to http://localhost:3000/member (or from landing / after going through join flow).
2. You should be logged in as the demo member (fresh state).
3. **Top metrics row** (streak | workouts logged total | strength score):
   - Streak emphasized.
   - "Workouts logged" card.
   - Strength Score with conditional rank text ("Log lifts to rank vs other demo athletes" when 0).
4. **New "Workouts logged + ranking" snippet** (after the collapsible strength details, before Programs):
   - Shows total + note about history + personal bests populating from logs.
   - In 0-state: encouraging text + direct links "Browse programs & enroll →" and "Open workout logger →".
5. **Strength Score calculation** — now inside <details> (collapsible to reduce scroll).
6. **MemberReminderSettings** (SMS + contact + quick coach message sims) — internally collapsible.
7. **Programs section** (collapsed <details open> by default):
   - Grouped by category (Workouts, Yoga Channels, Journeys; Eating coming soon).
   - Cards with images, Enroll buttons (updated to "Enroll & setup" style).
   - "View all" link.
8. **Quick actions** (now in its own collapsible <details> at bottom): Today's workout + Live sessions cards + upgrade note.
9. Home equipment widget (editable) and other elements still present for when user enrolls.

**Expected / Verify (fresh state)**:
- No "Currently enrolled" or "Continue" blocks (clean for brand new user).
- 0 workouts / 0 strength.
- New snippet + ranking text visible and useful.
- All major sections (programs, quick actions, strength details) use <details> for reorg / less doom-scroll.
- Enroll buttons lead to the updated onboard wizard.
- Responsive on mobile (Tailwind classes + prior landing/Splash polish).

**Test note**: This validates the 3rd priority reorg (collapses, snippet per transcript "Down here, you can have workouts logged" + ranking) + fresh review setup. Later in script, after enrolling/logging, re-visit to see numbers and snippet update.

---

## Section 2: Enroll in All Program Types

1. From dashboard, go to "View all" or directly use the catalog.
2. **Enroll in a Workout** (if not already): Click "Enroll (free)" on "Adult" or "Strength Training".
3. **Enroll in an Eating Approach**: Muscle Max, Weight Loss, Gracefully Age.
4. **Enroll in a Yoga Channel**: Yoga Channel.
5. **Enroll in a Journey**: John & Steph.
6. Return to /member dashboard after each (or refresh).

**Expected / Verify**:
- New programs appear in "Currently enrolled" and "Continue" sections.
- Categories are separate (you can be in one of each type).
- Progress starts at W1D1 for new enrollments.
- Buttons change to "Unenroll".

**Test note**: Full enroll flow + independent tracking.

---

## Section 3: Workout Programs + Console + Logging (Core Feature)

1. From dashboard, click a workout continue (e.g. Adult W3D3) or go to /member/programs/adult.
2. **Program detail page** (focus on Adult for hybrid test):
   - Header with name (now mentions hybrid), description (updated to explain Gym/Home choice), progress bar.
   - Week sections with day cards.
   - For each day in Adult: day label, then **two (or more) option cards**:
     - "Gym": full gym workout name (e.g. "Day X Upper Body Workout (Gym)").
     - "Home": home-optimized version using limited equipment (e.g. "Day X Upper Body Workout (Home)").
   - Other programs (Strength, Boot Camp, etc.) may show single or hybrid depending on schedule.
   - **Substitution links** (demo only on Adult): still present on days (can sub journey into either option).
3. **Test hybrid choice** (new core feature):
   - For a few days in Week 1 of Adult, deliberately choose the **Home** option for one day and **Gym** for the next.
   - Click into a Home option: console loads the home-specific workout (fewer/heavier reliance on bands + light dumbbells, stability ball or household alternatives, more bodyweight/HIIT elements).
   - Note any equipment hints or differences vs Gym version.
4. Click into a chosen option for a normal day (e.g. a leg day or upper body).
4. **Workout Console** (`/member/workout`):
   - Back link to program.
   - List of exercises with sets/reps scheme.
   - Per-exercise controls:
     - Weight input, reps input.
     - "Exercise finished" checkbox/toggle.
     - YouTube "Watch demo" button + direct link (or "No demo video linked yet — tell your instructor..." if missing).
   - Past performance silhouettes (from previous logs).
   - Overall progress bar.
   - Bottom: "Log workout complete" button (enabled after any progress).
5. **Test logging**:
   - Mark 2-3 exercises as finished, enter some weight/reps.
   - Click "Log workout complete".
   - Should show banner: "% complete — partial (instructor sees which...)" or "full workout".
   - Refresh or go back — progress saved, silhouettes updated.
6. **Test partial vs full**:
   - Do only 50% of exercises.
   - Log complete → verify % and note.
7. **Substitution test** (key journey feature — still works with hybrid):
   - Go back to Adult program schedule.
   - Click a "follow the full John & Steph recording & checklist (day X)" link (pick a leg day if possible).
   - On the workout page: prominent banner with the full 30-40 min embedded YouTube player. Updated text explains to watch the video and follow its checklist (may vary slightly); the exercise list below is for logging.
   - The normal exercise console is still below for logging the day.
   - Log complete as usual (this advances the *workout* day; the long video was your guide).
8. **Test mixing environments**:
   - Go back to Adult schedule.
   - For remaining days in the week, mix: do one as Home (limited gear), the next as Gym.
   - Log each. Verify that progress for Adult advances regardless of which option was chosen, and the dashboard "Continue" for Adult updates correctly.
9. Go back to dashboard — verify strength score may have increased if you logged key lifts (squat, bench, etc.). Home logs still contribute if they include the key lifts.

**Expected / Verify**:
- All exercise data, videos, past logs work.
- Logging creates WorkoutLog + ExercisePerformance rows (visible in admin later).
- Partial logging works and is noted.
- Substitution banner + player appears correctly and uses real YT from seed.
- **Hybrid options**: Adult days clearly show separate Gym and Home choices. Choosing Home loads a workout using limited equipment (bands, light DBs, bodyweight, household alternatives). Mixing options within Adult still advances the single enrollment day correctly.
- Strength score updates live from logged key lifts (Epley + ratios) — Home versions contribute when they include the tracked lifts.
- No data loss on refresh.

**Test note**: This is the heaviest test — console, logging, % , partials, videos, substitution, strength calc, **plus the new per-day hybrid Gym/Home choice and equipment-aware programming**.

---

## Section 4: Eating Approaches (Prompts Flow)

1. From dashboard, click an Eating continue (e.g. Muscle Max) or /member/programs/muscle-max.
2. **Program detail**:
   - Similar schedule view, but "Start prompts" instead of workout.
   - Days use notes as cascading steps.
3. Click a day → goes to `/member/prompts?program=...&cat=eating&day=...`
4. **Prompts page**:
   - Split notes into numbered steps (cascading).
   - Per-step checkboxes + optional notes/text inputs.
   - "Log day complete" button.
5. Fill out a few steps, log complete.
6. Verify it advances the eating enrollment day (check dashboard continue label).

**Expected / Verify**:
- Different UI from workouts (no sets/reps, just prompts).
- Progress saves and advances only the eating enrollment.
- Independent from workouts.

---

## Section 5: Yoga Channels

1. Similar to Eating.
2. Go to Yoga Channel program.
3. Days are "Channel • flows & sessions".
4. Prompts page shows yoga-specific content.
5. Log a session.
6. Verify independence.

**Expected / Verify**:
- Treated as separate category.
- Same prompts mechanism as eating.

---

## Section 6: Journeys (Recorded Live Sessions + Substitution)

1. From dashboard, click John & Steph continue or /member/programs/john-steph.
2. **Program detail**:
   - "Recorded sessions • sub into workouts".
   - Days show "▶ Watch recording" (with "(substitutable)" note if video present).
3. Click a day (e.g. the leg day) → `/member/journey?program=john-steph&day=2`
4. **Journey viewer** (for the longer 30-40 min recordings):
   - Large embedded YouTube player for the full session.
   - Direct "Open on YouTube" link.
   - Session-specific "Follow-along checklist" (bullet list derived from the day's notes — this can vary based on what the particular video covers).
   - "Mark watched & advance day →" button.
5. Watch the full video and follow the checklist shown below the player. Click Mark watched when done.
6. Verify day advances in dashboard and program schedule (independent of workouts).
7. Go back to a workout program (Adult) and use a substitution link for a matching day (e.g. a leg day).
8. In the workout view: a prominent banner appears with the full long John & Steph YouTube embed at the top. Text explains to watch the video and follow its checklist (may vary slightly from the standard list below). The normal exercise console is still below for logging the workout day's progress.

**Expected / Verify**:
- Journeys are video-first: long 30-40 min recordings with a customized checklist below the player (not the standard short per-exercise demos).
- You link to and embed real YouTube videos in both cases (short exercise demos via exercise library; full long sessions via journey day videoUrl).
- Pure journey days: just watch + follow the on-screen checklist + mark watched.
- Substitution into workout: the long video acts as the guide/checklist for that day; you still log via the workout's exercise list below (for program progress).
- Marking watched advances only the journey enrollment.
- Videos are real embeds + direct links (admin sets the YouTube URL on journey days in the schedule builder; it flows to member views and subs).

---

## Section 7: Strength / Power Score Deep Dive & Logging Impact

1. On dashboard, read the full Strength Score paragraph.
2. Go do several workouts and specifically log key lifts:
   - Back Squat
   - Bench Press
   - Dumbbell Bench Press
   - Military / Shoulder Press
   - Pulldown / Row variations
   - Tricep work
3. Use good weight + reps.
4. Return to dashboard.
5. **Expected / Verify**:
   - Score increases (unbounded — no max).
   - Based on best per-lift Epley 1RM × ratio → bench 6RM equiv → average.
   - More data = higher/more stable score.
6. Check admin/users later to see the counts feeding this.

---

## Section 8: SMS, Reminders & Broadcast (Communications)

1. **Member side**:
   - On dashboard, note any "Daily SMS reminder at HH:MM" text.
   - Texts would include direct link to that day's workout.
2. **Admin side** (switch to /admin or /admin/bookings):
   - Go to Bookings & Onboarding.
   - Set coach contact email/phone.
   - Set availability (days/hours).
   - Look at existing bookings (or create via /member/book).
   - For a booking/user: set "Remind time" (e.g. 07:30) and phone.
   - Click "Simulate Send Daily SMS Reminders".
   - Check "Recent SMS" log — should show personalized messages with workout links.
3. **Broadcast test** (new SMS capability):
   - In the same admin page, find the **SMS Broadcast** section.
   - See list of recipients who have phones (demo users + seeded).
   - Select a few (or all).
   - Compose a message (supports {name} personalization).
   - Send.
   - Verify in Recent SMS log (tagged as BROADCAST).
   - Optionally check /api/reminders/logs.

**Expected / Verify**:
- Daily reminders are personalized per enrollment.
- Broadcast works for selected users, creates proper SmsLog entries.
- Both reminder and broadcast logs visible in one place.
- Member sees reminder time on dashboard.

---

## Section 9: Live Sessions & Booking Flow (Two-Tier Access)

1. **Member side**:
   - From dashboard or /member/live or /member/book.
   - View available live sessions or book a 15-min onboarding call.
   - Enter email/phone, pick day + 15-min slot.
   - Submit → creates Booking (status pending).
2. **Admin side** (/admin/bookings):
   - See the new booking.
   - Update status (pending → confirmed), add Zoom URL, notes.
   - During "interview": set the member's daily reminder time + phone.
   - Simulate sending reminders (as in Section 8).
3. **Access tiers**:
   - Coach tier: on-demand workouts only.
   - First Class: live sessions + everything.
   - Check /admin/users — you can change a user's tier and see enforcement.

**Expected / Verify**:
- Booking flow works end-to-end.
- Admin can manage availability, contacts, status, Zoom, reminders.
- SMS reminder time is set during the simulated call.
- Tier gating works (preview vs enforced).

---

## Section 10: Full Admin Experience (User Management, Content, etc.)

1. Go to /admin.
2. **Users** (/admin/users):
   - Full table: search, filter by role.
   - Roles: ADMIN, INSTRUCTOR, MEMBER, PROSPECTIVE_INSTRUCTOR.
   - Status: active/pending/suspended.
   - Edit: name, role, status, notes, phone, dailyReminderTime.
   - Create new users.
   - Delete (with confirm).
   - See counts: enrollments, performances, workoutLogs (from logging).
   - For MEMBER users: "Coach Workout" button to open the console in instructor mode (check off exercises for the member).
3. **Programs** (/admin/programs):
   - List all (including journey).
   - Click one (especially **Adult**) → Schedule Builder.
   - **Enhanced builder for hybrid**: Each day slot now supports multiple labeled options (e.g. add "Gym" option + "Home" option). Assign different workouts to each label. Labels are free-form (Gym, Home - Minimal, Home - Dumbbells + Bands, etc.).
   - For journeys: use the YouTube URL field to set the full 30-40 min video link on days. Use the notes field to describe the session-specific checklist (this is what appears below the player for pure journey days and in the banner for substitutions).
   - Bulk copy week, clear week.
   - Changes immediately affect member program views (days will show the new choice cards).
4. **Exercise Library** (implied in admin):
   - Add/edit exercises (name, description, videoUrl for demos).
   - These feed the workout builder and console.
5. **Other admin pages** (if present): workouts builder, etc.

**Expected / Verify**:
- Full CRUD on users with all fields.
- Program schedule builder works for both workout assignment and journey video links.
- **Hybrid builder**: You can assign multiple options per day with custom labels. Adult (and other workout programs) can now have explicit Gym/Home (or other environment) choices per day slot.
- Changes reflect immediately in member views (after refresh) — days show the option cards.
- Logging data (from Section 3) appears in user counts and admin visibility.

---

## Section 11: Cross-Cutting & Edge Cases (Testing Focus)

1. **Independent programs**:
   - Advance a workout day, an eating day, a journey day.
   - Dashboard continues should update separately.
2. **Partial logging visibility**:
   - In workout console, log only some exercises as finished.
   - Log complete.
   - As "instructor" (admin/users), for a MEMBER row click "Coach Workout" — this opens the workout console in instructor mode (banner at top). You can check off sets/exercises on their behalf (progress logs to their record, using the member's target id). The "Exercise finished" button becomes "Mark done for member". Then view their updated logs/performances in the user list or detail.
3. **Unenroll**:
   - Unenroll from one program type.
   - Verify it disappears from continues but others remain.
4. **Responsive / Real-estate**:
   - Resize browser: dashboard condenses (stats + continues on one band on lg+).
   - Mobile: stacks.
   - Workout console: vertical on mobile, capped on wide screens.
5. **Videos everywhere**:
   - Exercise demos in console.
   - Journey full recordings.
   - Substitution videos.
6. **Strength updates from real data**:
   - Log heavy key lifts across multiple days.
   - Score should grow (no cap).
7. **Hybrid mixing + Equipment inventory** (new):
   - In Adult, deliberately do some days via the Home option (limited gear) and some via Gym.
   - On dashboard, note the "Your Home Equipment" blurb (demo user has dumbbells, bands, bodyweight seeded).
   - (Future/when wired) Home options should only surface workouts whose required equipment matches the user's declared home inventory.
   - As admin, view/edit a user's home equipment list (in /admin/users or client detail).
8. **SMS end-to-end**:
   - Set reminder time on a user.
   - Simulate daily send.
   - Broadcast a custom message.
   - All appear in unified logs.
9. **Preview vs Full**:
   - Some features gated by tier (live sessions especially).

---

## Section 12: Cleanup & Final Checks

1. Unenroll from everything except Adult + John & Steph (for continued testing).
2. Do one more full workout log + journey sub + mark watched.
3. Check dashboard one last time:
   - Strength score updated.
   - All continues correct.
   - No broken links.
4. Visit /admin one last time:
   - User counts reflect your logging.
   - Recent SMS has your broadcasts + reminders.
5. Hard refresh /landing and /member to confirm no console errors.

**Final Expected State**:
- All 4 program categories fully functional and independent.
- **Hybrid Adult**: per-day Gym + Home workout options; you can freely mix environments within one enrollment. Home versions use limited equipment (bands, light dumbbells, bodyweight, household alternatives).
- Workouts: rich logging + videos + substitution (still works when choosing Home/Gym options).
- Equipment inventory: demo user has seeded home gear; visible on member dashboard; instructor can view/manage per client.
- Journeys: video chronicles + usable as workout subs.
- Eating/Yoga: prompt-based.
- Admin: complete control over users, content (including multi-option schedule builder), bookings, SMS.
- SMS: daily + broadcast.
- Live/booking: full flow.
- Strength score: live and explainable (contributions from both Gym and Home logs).
- No data loss, good UX on browser + mobile.

---

**Congratulations — you've demoed and tested the entire app!**

If any step fails, note the exact URL + what you saw vs expected. This document can be re-run after fixes.

**Optional advanced tests** (if you have time):
- Create a new journey program in admin + add days with videos.
- Enroll a new user via admin and do everything as them.
- Check that partial logs are visible to instructors in user detail.
- Test the booking flow from member side end-to-end with SMS.
- In admin Schedule Builder for Adult, add a third option to a day (e.g. "Home - Minimal") and verify it appears in the member view.
- View/edit the demo user's home equipment list (inventory) and observe impact on available Home options (when filtering is wired).

This script covers 100% of the requested features plus the earlier ones (workouts, eating, yoga, SMS broadcast, live, tiers, substitution, strength score, **hybrid Gym/Home per-day options with equipment inventory**, etc.).

Let me know if you want this as a printable checklist, or if I should add screenshots placeholders, or expand any section!