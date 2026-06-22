# Text Jeremy — Catalog cleanup (S3)

Copy/paste:

---

Hey Jeremy — **step 3 is live** on the real site:

**https://www.thetrainstation.co**

**Member → Program store** should now show only your list:

**Live**
- Adult Strength Conditioning (Gym + Home)
- Athletes — Speed, Strength & Conditioning
- Mom & Dads with Little Time
- Military Preparation

**Coming soon**
- Adolescent Training

**Gone from your view**
- Muscle Max, Weight Loss, Gracefully Age
- Combat Training, Yoga Channel, John & Steph journey
- QA / smoke test workouts in Admin → Workouts

**Pass:** Names match above everywhere (member store, admin programs list, landing coming-soon cards).

**Fail:** Old junk names still visible → text me.

Step 4 next: bulk text upload + seed export for faster content loading.

---

## John — automated check

```bash
BASE_URL=https://www.thetrainstation.co npm run test:s3
```

After deploy, blob may still have old `gracefully-age` slug briefly — the app maps it to Mom & Dads automatically until the next seed sync.