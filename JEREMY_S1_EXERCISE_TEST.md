# Text Jeremy — Exercise delete fix (S1)

Copy/paste the block below (or trim to one message).

---

Hey Jeremy — quick test on the **live site** when you have 2 minutes:

**https://www.thetrainstation.co**

1. Sign in → **Admin** → **Exercises**
2. Search for something you don’t need (QA junk, old test name, whatever — **not** something you’re using in a program)
3. Tap **Delete** → confirm
4. **Pull down to refresh** the page (or close the tab and open Exercises again)
5. ✅ **Pass:** it’s still gone  
   ❌ **Fail:** it came back — text me

**Bonus (rename):** Edit any exercise name → save → open a workout that uses it → name should match.

You’ll see a yellow/gray note at the top of Exercises explaining how saves work. That’s normal.

This is step 1 of the program-builder fixes. Once deletes stick, we’ll tackle Monday/copy-week next.

---

## If he asks “what should I delete?”

Anything safe to lose:
- Names with **QA** or **smoke** in them
- Exercises he already said aren’t real (generic “Bench Press” if he’s replacing with his real names later)
- **Don’t** delete something he’s actively programming until copy-week is fixed (S2)

## Automated check (John)

```bash
BASE_URL=https://www.thetrainstation.co npm run test:s1
```