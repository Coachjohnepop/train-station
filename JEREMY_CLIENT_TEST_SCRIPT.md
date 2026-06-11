# Jeremy / Client Test Script — The Train Station (Fresh Review + New Features)

**Purpose**: Quick, focused end-to-end test of the **new user journey** and recent updates (questions assessment before pricing, recommendation driving pricing highlight, fresh dashboard with "workouts logged" snippet + ranking, onboard wizard, collapses, admin visibility). 

Designed for the current **fresh review state** (0 enrollments, 0 logs, empty equipment/settings in the demo data). This is exactly what a brand-new member sees after the reset.

**Starting point (known-good baseline build)**:
Use ONLY this preview as the base for all testing and comparisons going forward:
- train-station-1vlm8grmi-johnepop-s-projects.vercel.app (deployed to production for safety as of this session)

**How to run from this baseline**:
1. Always start fresh tests from the baseline URL above (hard refresh with Cmd/Ctrl+Shift+R). Production is now on this baseline.
2. After each new push on the branch, Vercel will create a new preview. Test the new preview side-by-side with the baseline (and production).
3. Use incognito/private window for every test session.
4. Follow the numbered steps in order.
5. Note anything that feels off or broken, especially regressions vs the baseline.

**New project build plan rule**:
- We will only keep the baseline + the very latest good build.
- Delete any intermediate broken previews immediately after testing (as discussed).
- All changes must be small and incremental so we can bisect easily against the baseline.

**Key new stuff being validated**:
- Middle assessment (join/questions) with 4 habit questions + auto recommendation (Explorer/Member/Pro).
- Pricing page now receives the rec and highlights the right tier with "RECOMMENDED" badge.
- Fresh-user dashboard: clean (no pre-enrolled junk), new snippet "down here" with ranking, collapsible sections.
- Enroll → Onboard wizard (4 steps + equipment + Calendly + measurements) → simulated coach email.
- Logging a workout updates the dashboard snippet, strength, and admin views.
- Admin reports shows the demo member snapshot (0s in fresh state).
- Mobile/responsive basics + overall polish from iteration.

---

## 1. Landing → Start the Join Flow (New Middle Assessment)

1. Go to the site root / landing page.
2. Click the prominent **"Join the site"** button (or "Get started as a member" to compare paths).
3. You should land on the pricing overview (/join).
   - Notice the callout banner right above the three plans: "NOT SURE WHICH PLAN?" + big "Take the 1-minute assessment →" button.
4. Click the assessment button.

**Verify**:
- Clean, on-brand dark UI.
- The three pricing cards (Explorer free, Member $29 popular, Pro annual) are visible but you are guided to the quiz first.

---

## 2. Questions Assessment + Recommendation

1. On /join/questions, answer the four questions honestly (or pick any for demo):
   - How many days per week do you currently exercise?
   - Do you currently follow a structured workout program? (yes/no radios)
   - How do you currently handle your eating / nutrition?
   - What's your main goal right now?
2. Click **"See my recommendation"**.
3. You should see a highlighted recommendation card (Explorer / Member / or Pro) with a short reason.
4. From here:
   - Click **"See all membership options"** — this carries your recommendation (e.g. /join?rec=Member).
   - Or click **"Start with the recommended (demo)"** to jump straight into the member experience.

**Verify**:
- Recommendation logic feels reasonable based on your answers.
- Note says "We'll refine the exact packages and pricing soon".
- "Skip to pricing" link in header works.

---

## 3. Pricing with Recommendation Highlight

(Only if you chose "See all membership options" in step 2.)

1. You land back on /join with `?rec=XXX` in the URL.
2. Look at the three cards:
   - The matching tier (Explorer / Member / Pro) should have a purple **"RECOMMENDED"** badge + stronger border/ring highlight.
3. Optionally click one of the tier CTAs (they all go to demo /member for now).

**Verify**:
- The rec from the questions actually influences the pricing view (new integration).
- Everything still looks professional and the "All access is currently open while we finish billing setup" note is clear.

---

## 4. Fresh Member Dashboard (0-State + New Snippet + Collapses)

1. Arrive at /member (either from the "Start with recommended" or a pricing CTA).
2. Observe the clean fresh-user state:
   - No "Currently enrolled" list on the left.
   - No "Continue..." block on the right.
   - Top metrics: Day streak (some number), **Workouts logged: 0**, Strength Score: 0 with "Log lifts to rank vs other demo athletes".
3. Scroll past MemberReminderSettings and the collapsible "Strength Score calculation details".
4. Find the new **"Workouts logged" snippet** (the card right before the Programs section):
   - Shows "0 total • history populates from console logs".
   - 0-state message + two action links: "Browse programs & enroll →" and "Open workout logger →".
5. Programs section is in a collapsed <details> (open by default) — grouped Workouts / Yoga / Journeys.
6. Quick actions at the very bottom is also in its own <details>.

**Verify**:
- Dashboard feels light and non-overwhelming for a brand new person (the reorg/collapses + new snippet).
- The two links in the snippet work and take you to useful places.
- Equipment widget and SMS reminder settings are still present (empty for fresh user).

---

## 5. Enroll + Onboard Wizard (the 4-step setup)

1. From the Programs collapsed section (or via the snippet link), pick a program (e.g. Adult) and click the **"Enroll & setup"** button (big accent style).
2. You should be taken to `/member/onboard?program=adult` (the new post-enroll wizard).
3. Work through the 4 steps:
   - Step 1: Review/edit home equipment (the same widget as dashboard).
   - Step 2: Basic measurements (weight + optional notes).
   - Step 3: Open Calendly link (uses the coach URL from admin contact or fallback).
   - Step 4: Finish setup.
4. After finish, you should see a success screen: "A notification has been sent to the coach." + link back to Dashboard.

**Verify**:
- Wizard is clear, uses the shared equipment component.
- "Open Calendly" button works (opens in new tab).
- On complete, it posts to the onboard API (simulated email is logged in the server console / Vercel logs to jeremy@thetrainstation.co).
- You are now "enrolled" — dashboard should update.

---

## 6. Post-Onboard Dashboard + First Log (See the Snippet & Ranking Come Alive)

1. Back on /member after onboard:
   - You should now see an "Currently enrolled" item with progress (W1D1 or similar).
   - A "Continue" link.
2. Click into the enrolled program or use "Today's workout" / the snippet link to go to the workout logger.
3. Log a partial or full workout:
   - Enter some weights/reps on a couple exercises.
   - Mark some as finished.
   - Hit the big log/complete button.
4. Return to /member dashboard.
5. Refresh if needed.
6. Check the **"Workouts logged" snippet** — the number should have increased from 0.
7. Strength score may still be 0 or small (it only rises from key lifts with data).
8. The "ranking" text should feel more relevant.

**Verify**:
- Logging works and immediately affects the dashboard numbers/snippet (the core value of the new "workouts logged" + ranking area).
- Green checks / past performance silhouettes appear on subsequent visits (core console feature).
- Enrolled program shows in the left column and continue area.

---

## 7. Admin / Coach View (Reports Snapshot + Users)

1. Go to /admin (or /admin/reports).
2. On **Reports**:
   - Look for the new **"Demo Member Snapshot (fresh review)"** card.
   - It should show the current 0 (or updated after your logging) workouts logged + strength score.
   - Other tables (visits by program, completions, recent activity) should reflect the fresh or newly logged state.
3. Go to **Users**:
   - You should see the "Demo Member (Alex)" row.
   - Activity column shows logs + programs count.
   - New **Strength** column shows the current strengthScore (0 or updated).
   - Other demo users for SMS testing are also listed.
4. Optionally check **Bookings** for the Calendly contact + SMS broadcast tools (they should load even in fresh state).

**Verify**:
- Coach has visibility into the exact fresh/demo member state that matches what the member sees.
- Strength and log counts are visible in the admin tools (4th priority starter).

---

## 8. Quick Polish & Edge Checks (Optional but Recommended)

- Mobile: Resize or test on phone — new snippet, join/questions form, dashboard collapses, pricing cards, and landing hero should all adapt nicely (prior mobile work on Splash/hero + Tailwind).
- Fresh reset feel: If you want to test as a completely new person again, you can ask John to reset the .dev files or just use another incognito.
- Enroll another program (yoga or journey) — they should appear independently in the enrolled list and continue area.
- Send a quick coach message from the SMS settings widget — it simulates.
- Hard refresh everywhere after logging/enrolling.

---

## Done?

If everything above flows without major breakage, the new user + coach experience is in good shape for review.

**Things we know are still "demo" / coming later** (per previous notes):
- Real billing / subscriptions (all buttons currently demo-free).
- Package price adjustments (the rec is just guidance for now).
- Full eating approaches.
- Real SMS (current is simulated + console).

Report any bugs, weird text, layout issues on mobile, or things that don't match the transcript intent. Screenshots of the questions → rec → highlighted pricing and the new dashboard snippet are especially helpful.

Thanks for testing! This gets the core iteration (questions middle page, better enroll + onboard, fresh review, dashboard reorg + snippet/ranking, admin snapshot) validated before we move to publish on the custom domain.