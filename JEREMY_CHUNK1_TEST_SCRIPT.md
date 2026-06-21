# Jeremy — Member Journey Test Script (Chunk 1: Signup → Onboard → Dashboard)

**Date / Context**: June 2026 — Test of the new member path:
> Ticket on the landing page → create account → 6-step onboard wizard (equipment, texts, book Jeremy) → training dashboard. Plus waitlist for “coming soon” programs.

**Goal**: Walk through exactly what a new client sees on their phone. Tell John what feels right, what’s confusing, and what’s missing before we wire up Stripe.

**Time**: ~12–15 minutes on your phone. Do the main path first (sections 1–4). Sections 5–6 are quick extras.

---

## Before you start

- Use your **phone** (this flow is built for mobile-first signup).
- **Private / incognito** tab — no old cookies.
- Hard refresh if anything looks cached.
- URL: **https://www.thetrainstation.co** (or the preview URL John sends you).
- Use a **fresh test email** you haven’t signed up with before, e.g. `jeremy+chunk1-jun20@thetrainstation.co` (Gmail `+` aliases work).
- **Stripe is not live yet** — tapping a paid ticket still goes to account creation, not checkout. That’s expected.

**Quick reply lines** (text John as you go — one word each is fine):

| Step | You text John |
|------|----------------|
| Landing tickets | `Tickets OK?` |
| Signup form | `Signup OK?` |
| Onboard wizard | `Onboard OK?` |
| Equipment save | `Equipment OK?` |
| Time picker | `Time picker OK?` |
| Book Jeremy step | `Calendly step OK?` |
| Dashboard | `Dashboard OK?` |
| Waitlist (optional) | `Waitlist OK?` |

---

## 1. Landing → pick a ticket (~2 min)

1. Open the site. Tap **Enter the site** (or scroll past the hero).
2. Scroll to **Pick your ticket** / **Three ways aboard**.
3. Glance at all three tickets side by side on your phone — Free, Coach Class, 1st Class.

**Main test — Coach Class (paid path)**:
4. Tap **Coach Class** ($29/mo) → **Select**.
5. You should land on signup with heading **Create your account** (not “Join the waitlist”).
6. Confirm the ticket line says **Coach Class** and the button says **Continue to setup →**.

**Quick sanity — Free path** (optional, 30 sec):
- Go back to landing, tap **Free** → **Tap if you dare →**, watch the free-ticket modal/video if it plays, then continue to explorer signup if you want to compare copy.

**Verify / Note**:
- Do the three tickets feel obvious on a narrow screen?
- Does Coach Class clearly feel like “I’m signing up for real access”?

**Text John**: `Tickets OK?`

---

## 2. Create account (~1 min)

On `/signup?plan=member` (or whichever ticket you picked):

1. Enter your test email, first name, last name.
2. Phone is optional but **enter a real mobile number** if you want to test SMS settings later.
3. Tap **Continue to setup →**.

**Expected**:
- No error flash.
- You land on **/member/onboard** — not the main dashboard yet.
- Progress shows **Step 1 of 6** and a **Coach Class** (or your ticket) badge.

**Verify**:
- If you try to go to `/member` manually before finishing setup, you should get bounced back to onboard.

**Text John**: `Signup OK?`

---

## 3. Onboard wizard — all 6 steps (~8 min)

Work through every step. Use **Back** once on any step to confirm navigation feels fine.

### Step 1 — Welcome aboard
- Welcome copy mentions texts, booking your coach, and opening the dashboard on your phone.
- **Welcome video** should play if John set one in Admin → Landing (iframe). If not, you’ll see a short “clip coming soon” note — that’s OK.
- Tap **Start setup**.

### Step 2 — Home equipment
- Heading: **Home equipment**.
- Expand the list if needed.
- **Critical test**: Turn on **Body weight only** (or one single item). Turn everything else **off**.
- Tap **Continue**.
- **Hard refresh the page** (or leave step 2 and come back via Back → Continue).
- Body weight only should **still be checked**. (This was a bug — we fixed it.)

**Text John**: `Equipment OK?`

### Step 3 — Quick measurements
- Enter a weight (optional) and a short note (e.g. “QA test — shoulder feels good”).
- Tap **Save & continue**.

### Step 4 — Where are you training from?
- Enter city + state (e.g. Austin, TX).
- Tap **Continue**.

### Step 5 — Daily workout texts
- Enter your mobile number.
- **Reminder time**: use the new **scroll-style picker** (Hour / Minute / AM·PM dropdowns) — not a plain text box.
- Set something specific, e.g. **7:30 AM**.
- Tap **Continue**.

**Verify**:
- Can you set the time easily with your thumb on the phone?
- Does the chosen time look correct before you leave the step?

**Text John**: `Time picker OK?`

### Step 6 — Book your first session
- Heading should say: **Book your first session with your trainer, Jeremy**.
- Tap **Open Calendly** — your real Calendly should open in a new tab.
- Come back and tap **Finish & go to dashboard**.

**Expected**:
- Lands on **/member** (main member dashboard).
- You should **not** get sent back to onboard if you tap around the member nav.

**Text John**: `Calendly step OK?` then `Dashboard OK?`

---

## 4. Dashboard sanity check (~2 min)

On the member dashboard:

1. Confirm you’re in — no redirect loop to onboard.
2. Look for **reminder / SMS settings** (or profile area) and confirm your phone + **7:30** (or whatever you set) stuck.
3. Glance at **home equipment** on the dashboard if it’s visible — does body weight only still match step 2?

**Feedback prompts**:
- Does the dashboard feel like “I’m done setting up” or still half-finished?
- Anything you expected to see immediately that’s missing?

---

## 5. Waitlist path — coming soon program (~2 min, optional)

Use a **different fresh email** (e.g. `jeremy+waitlist-jun20@thetrainstation.co`):

1. Landing → scroll to **Programs coming soon** / **On the manifest**.
2. Tap any program (e.g. **Stretching**) → **Notify me**.
3. Signup page should say **Join the waitlist** (not Create your account).
4. Submit → you should land on **coming soon** confirmation, not onboard.

**Text John**: `Waitlist OK?`

---

## 6. Coach-side check (~2 min, optional)

Sign in as coach (desktop is fine):

1. Go to **/login** → `jeremy@thetrainstation.co` → leave password **blank** → sign in.
2. **Admin → Landing** — confirm welcome / free-ticket videos still save (quick sanity from last round).
3. **Admin → Leads** — your test signup(s) should appear in the list (name, email, plan/source).

**Note**: New member accounts from Chunk 1 are separate from the old demo member. You’re testing the *real new-user* path, not `demo@`.

---

## Final feedback (please answer explicitly)

1. **Ticket → signup**: Would a real client understand which ticket to pick? Anything misleading about pricing before Stripe?
2. **Onboard length**: Is 6 steps the right amount, or does it feel long on a phone?
3. **Equipment step**: Does saving home gear feel trustworthy now (especially bodyweight-only)?
4. **Time picker**: Better than typing a time? Anything awkward on iPhone Safari?
5. **“Book your first session with your trainer, Jeremy”**: Right tone? Would you want different wording?
6. **Calendly step**: Is opening Calendly in a new tab OK, or do you want it embedded?
7. **After finish**: Does the dashboard match what you promised clients they’d get on day one?
8. **Anything broken** — spinner stuck, wrong redirect, copy typo, layout clip on your phone?

---

## After you're done

- 2–3 screenshots or a short screen recording of: ticket tap → onboard step 5 (time picker) → step 6 (Jeremy heading) → dashboard.
- Tell John which URL you tested.
- One-line verdict: **ship it** / **fix X first** / **wait for Stripe**.

---

## For John (automated backup)

John can run the API smoke test anytime:

```bash
node scripts/chunk1-member-flow-test.mjs
```

That script covers register, onboard gate, equipment persistence, reminders, waitlist, and duplicate-email rejection. Your phone walkthrough is the UX sign-off on top of that.

Thanks — this is the path every paying client will hit once Stripe is plugged in. Your gut check here saves us a support mess later.