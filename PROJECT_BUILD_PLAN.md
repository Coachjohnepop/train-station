# Train Station Project Build Plan
## Post-Calendly Baseline (Known-Good Reference)

**Baseline Preview (use for all comparisons and testing):**
- train-station-1vlm8grmi-johnepop-s-projects.vercel.app (also deployed to production for safety)

**Core Principles (from transcripts):**
- Take it slow: small, incremental changes only. One focused item per commit/push.
- Every push creates a new Vercel preview on the `feat/iteration-2-onboarding-wizard` branch.
- Test every new preview side-by-side with the baseline. Note regressions (especially button colors, flows, Calendly, no server errors).
- Delete intermediate broken previews immediately after testing. Only keep the baseline + the very latest good build.
- Fresh review state for "new user" / Jeremy's review: empty user data (enrollments, logs, equipment, settings) but full core exercises, workouts, programs, seed intact.
- 10% more weight to Jeremy's wants (coach perspective, member experience for clients, fresh review, questions for package recommendation, onboard, dashboard for members, coach tools) vs. John's (technical/dev side, publish, data, AB tests).
- All changes must produce testable previews. Update this plan and the JEREMY_CLIENT_TEST_SCRIPT.md after each step if needed.
- Remember data files (seed-data.json + *.dev.json) are part of the deliverable per CLAUDE.md — commit them explicitly on publish.

**Derived from the two client feedback transcripts** (first launch feedback + part 2 of customer feedback from reviewing the app, with John, Jeremy, Stephanie):
- Emphasis on fresh/new user experience for review.
- Middle assessment (questions on exercise/eating habits → package recommendation: Explorer/Member/Pro).
- Onboard wizard post-enroll.
- Dashboard: streak at top, "workouts logged" + ranking snippet, collapses (programs, weeks), reorg to reduce doom-scroll.
- Better buttons (e.g. "Enroll & setup").
- Coach/admin side (reports, users, SMS, booking).
- Later: food, payments, etc. (parked until after publish).
- Jeremy's input weighted slightly higher: focus on what coaches/members experience in review and daily use.

## Prioritized Remaining Steps (Incremental, from Baseline)
We restart from the post-Calendly state in the baseline. Steps are broken into small, verifiable increments. Each step = 1 focused commit + push + new preview for comparison to baseline. User will direct "do the 1st step", then next, etc.

1. **Fresh Review Data & Direct "Enter as Member" Experience (Jeremy-weighted)**
   - Reset/confirm user data files to fresh state (enrollments {}, logs empty, equipment [], settings minimal) while preserving core seed/programs/exercises.
   - Ensure "Enter as Member" from hero/splash leads to a clean, reviewable member dashboard (default enrollments/progress for review, no junk).
   - Small polish: clarify hero labels if needed for demo vs new user paths.
   - Test: From baseline + new preview, click "Enter as Member" — verify clean 0-state or default view, no errors, purple button.

2. **Middle Assessment / Questions Page as New User Entry (Jeremy-weighted)**
   - Confirm /join/questions as the prominent path from "Join the site" button (4 questions on exercise freq, structured program, eating, goals).
   - Recommendation logic (Explorer/Member/Pro based on answers) + "See all" to /join with highlight, or direct to demo.
   - Callout banner on /join ("NOT SURE WHICH PLAN?") linking to assessment.
   - Small: ensure pricing cards + recommendation display cleanly; add any missing "we'll refine packages later" notes.
   - Test: From baseline + new preview, click "Join the site" → land on /join (see banner), go to questions, complete, see rec + highlight on pricing.

3. **Enroll & Onboard Wizard Flow**
   - "Enroll & setup" button (updated style) from programs → /member/onboard?program=...
   - 4-step wizard (equipment, measurements/notes, Calendly, finish) with simulated coach email.
   - Post-onboard: lands in member area with enrollment.
   - Small: any button or flow polish from transcripts (e.g. better labels).
   - Test: Enroll from programs on new preview → full wizard → dashboard. Compare to baseline.

4. **Dashboard Reorg, Snippet, Ranking, Collapses (3rd priority, Jeremy-weighted)**
   - "Workouts logged" + ranking snippet ("Top 15%..." or "Log to climb ranks").
   - Collapses: programs <details>, weeks in schedule, quick actions, strength explanation.
   - Streak at top, clean 0-state for fresh review, mobile polish.
   - Small: one piece at a time (e.g. first the snippet + ranking, then one collapse).
   - Test: /member on new preview vs baseline — verify no doom-scroll, snippet/ranking visible, collapses work, fresh state clean.

5. **Coach/Admin Side Polish (4th priority, Jeremy-weighted)**
   - Reports: demo member snapshot (workouts, strength from fresh data).
   - Users list: activity counts, strength scores.
   - SMS/booking/contact refinements, admin editor for Calendly.
   - Small: one item at a time (e.g. reports snapshot first).
   - Test: /admin on new preview vs baseline — verify coach visibility into member state.

6. **Full End-to-End Validation (DEMO_SCRIPT + Test Script)**
   - Run through JEREMY_CLIENT_TEST_SCRIPT.md and DEMO_SCRIPT.md section-by-section from the baseline.
   - Fix issues one small thing at a time (e.g. one section's verification).
   - Include hybrid programs, logging, pasts, equipment, subs, admin views.
   - Test: New previews vs baseline for no regressions.

7. **Data Snapshot for Deliverable**
   - Explicit commit of current fresh .dev.json + seed-data.json (and export if edited).
   - Update CLAUDE.md/DEPLOY.md notes if needed.
   - Small: one commit for data.
   - Test: New preview uses the snapshot correctly.

8. **Publish Prep & Execution**
   - Small prep (e.g. any last polish, env checks).
   - Merge feat branch to main (or direct), push.
   - Trigger prod deploy to thetrainstation.co.
   - Verify full flow (landing → questions → pricing → member → onboard → dashboard, admin, Calendly) on live site vs baseline.
   - Delete bad previews; keep baseline + final prod.

**Later / Parked (after publish, unless pulled forward):**
- Food logging / eating approaches.
- Payments / billing.
- AB tests, more coach tools, etc.

**Process Rules:**
- Always start testing from the baseline URL (hard refresh, incognito).
- One small change per commit/push → new preview.
- Compare new preview to baseline for button color (purple!), flows, no errors, fresh state.
- Update this plan and JEREMY_CLIENT_TEST_SCRIPT.md after each step.
- When ready for a step: user says "do the 1st step" (or specific), AI breaks it down with details, minimal code change, clean git commands (no # comments), test instructions vs baseline.

This plan is derived directly from the two transcripts (first launch feedback + part 2 customer feedback), with ~10% extra emphasis on Jeremy's wants (fresh review for his testing, questions/recommendation for new clients, member dashboard experience, coach visibility/tools) over John's (data snapshots, publish mechanics, technical polish).

**June 13, 2026 customer review (newest input)**: See `JUN13_CUSTOMER_REVIEW_ACTION_PLAN.md` (created from the latest screen recording transcript). It is now the highest-priority overlay for coach/admin tooling work — focus on making exercise edits, deletes, and workout content inside program schedules actually reliable and visible in demo/live. Resume the older numbered steps only after the P0 items there (persistence + propagation) are solid.

When you're ready, say "do the 1st step" and we'll start slow from the baseline.