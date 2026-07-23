/** Five persona sim — mirrors live gamification levers/rules */

const POINTS = {
  onboarding_complete: 25,
  warmup_before_live: 50,
  intake_scheduled: 100,
  intake_complete: 75,
  workout_logged: 25,
} as const;

const DAILY_CAP = 150;
const FREE_PCT = 10;
const CYCLE = 28;
const FREE_DAYS = Math.max(1, Math.ceil((CYCLE * FREE_PCT) / 100));
const MIN_ACTIVE = 2;
const MIN_SEASON_PTS = 50;

function freeAllowed(enrollmentDay: number) {
  const dayInCycle = ((Math.max(1, enrollmentDay) - 1) % CYCLE) + 1;
  return dayInCycle <= FREE_DAYS;
}

function awardDay(events: { type: keyof typeof POINTS; day: number }[]) {
  const byDay = new Map<number, number>();
  let total = 0;
  const log: string[] = [];
  for (const e of events) {
    const pts = POINTS[e.type];
    const used = byDay.get(e.day) || 0;
    if (used >= DAILY_CAP) {
      log.push(`  day ${e.day}: ${e.type} BLOCKED by daily cap`);
      continue;
    }
    const give = Math.min(pts, DAILY_CAP - used);
    byDay.set(e.day, used + give);
    total += give;
    log.push(`  day ${e.day}: +${give} ${e.type}`);
  }
  return { total, activeDays: byDay.size, log };
}

type Persona = {
  name: string;
  tagline: string;
  plan: "explorer" | "member" | "business" | "pro";
  daysLogged: number[];
  doOnboarding: boolean;
  bookIntro: boolean;
  finishIntake: boolean;
  warmupDays: number[];
};

const personas: Persona[] = [
  {
    name: "Ghost Protocol Gary",
    tagline: "Signed up, never opened the app again",
    plan: "explorer",
    daysLogged: [],
    doOnboarding: false,
    bookIntro: false,
    finishIntake: false,
    warmupDays: [],
  },
  {
    name: "Tuesday-Only Tessa",
    tagline: "Shows up when the moon is right",
    plan: "explorer",
    // Tries 1, 8, 15 — only free pool days count for Free ticket
    daysLogged: [1, 8, 15],
    doOnboarding: true,
    bookIntro: true,
    finishIntake: false,
    warmupDays: [1],
  },
  {
    name: "Steady-Eddie Edge",
    tagline: "Not flashy. Never misses Mon/Wed/Fri.",
    plan: "member",
    daysLogged: [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26],
    doOnboarding: true,
    bookIntro: true,
    finishIntake: true,
    warmupDays: [1, 3, 5, 8, 10],
  },
  {
    name: "Grindset Gloria",
    tagline: "Logs hard, peeks upstairs, smells Business Class",
    plan: "member",
    daysLogged: Array.from({ length: 20 }, (_, i) => i + 1),
    doOnboarding: true,
    bookIntro: true,
    finishIntake: true,
    warmupDays: Array.from({ length: 14 }, (_, i) => i + 1),
  },
  {
    name: "Centurion Cass",
    tagline: "The cabinet was built for this psychopath",
    plan: "pro",
    daysLogged: Array.from({ length: 28 }, (_, i) => i + 1),
    doOnboarding: true,
    bookIntro: true,
    finishIntake: true,
    warmupDays: Array.from({ length: 28 }, (_, i) => i + 1),
  },
];

type Result = {
  name: string;
  tagline: string;
  plan: string;
  points: number;
  activeDays: number;
  workoutsKept: number;
  workoutsBlocked: number;
  eligible: boolean;
  freeWeekOffer: string | null;
  contentAccess: string;
  endState: string;
};

const results: Result[] = [];

for (const p of personas) {
  const events: { type: keyof typeof POINTS; day: number }[] = [];
  let workoutsKept = 0;
  let workoutsBlocked = 0;

  if (p.doOnboarding) events.push({ type: "onboarding_complete", day: 0 });
  if (p.bookIntro) events.push({ type: "intake_scheduled", day: 0 });
  if (p.finishIntake) events.push({ type: "intake_complete", day: 2 });

  for (const d of p.warmupDays) {
    // Free users only get full Today player on free-pool days
    if (p.plan === "explorer" && !freeAllowed(d)) continue;
    events.push({ type: "warmup_before_live", day: d });
  }

  for (const d of p.daysLogged) {
    if (p.plan === "explorer" && !freeAllowed(d)) {
      workoutsBlocked += 1;
      continue;
    }
    workoutsKept += 1;
    events.push({ type: "workout_logged", day: d });
  }

  const { total, activeDays } = awardDay(events);
  const eligible = activeDays >= MIN_ACTIVE && total >= MIN_SEASON_PTS;

  let freeWeekOffer: string | null = null;
  if (eligible) {
    if (p.plan === "explorer") freeWeekOffer = "Coach Class (7 days)";
    else if (p.plan === "member") freeWeekOffer = "Business Class (7 days)";
    else if (p.plan === "business") freeWeekOffer = "1st Class (7 days)";
  }

  const contentAccess =
    p.plan === "explorer"
      ? `Free ~${FREE_PCT}% (days 1–${FREE_DAYS}/28). ${workoutsBlocked} days hit velvet rope.`
      : p.plan === "member"
        ? "Coach Class — most on-demand open"
        : p.plan === "business"
          ? "Business — full + status"
          : "1st Class — full + elite lane";

  let endState = "";
  if (p.name.startsWith("Ghost")) {
    endState =
      "Still Free Explorer. 0 pts. Invisible on every board. The machine never even got a quarter.";
  } else if (p.name.startsWith("Tuesday")) {
    endState = eligible
      ? "Free division — earned free-week eligibility. One solid free day + intro. Locked out of mid-cycle grind."
      : "Free Explorer who saw the lock. Partial onboarding. Not enough activity for free-week hook.";
  } else if (p.name.startsWith("Steady")) {
    endState =
      "Solid Coach division mid-pack. Eligible for Business free-week if top band of Coach. Reliable, not legendary.";
  } else if (p.name.startsWith("Grindset")) {
    endState =
      "Coach high-band. Upstairs peek vs Business/1st. Free week of Business on the table. Breathing on elite.";
  } else {
    endState =
      "1st Class apex predator. Season maxer. No free week above them — prize/elite band if enabled. Cabinet's favorite child.";
  }

  results.push({
    name: p.name,
    tagline: p.tagline,
    plan: p.plan,
    points: total,
    activeDays,
    workoutsKept,
    workoutsBlocked,
    eligible,
    freeWeekOffer: eligible ? freeWeekOffer : null,
    contentAccess,
    endState,
  });
}

console.log("=== TRAIN STATION · 28-DAY ARCADE SIM ===\n");
console.log(
  `Rules in force: free days 1–${FREE_DAYS}/28 · daily cap ${DAILY_CAP} · eligibility ≥${MIN_ACTIVE} active days + ≥${MIN_SEASON_PTS} pts · top 25% free-week\n`,
);

for (const r of results) {
  console.log("────────────────────────────────────");
  console.log(`★ ${r.name}`);
  console.log(`  "${r.tagline}"`);
  console.log(`  Ticket: ${r.plan}`);
  console.log(
    `  Points: ${r.points} · Active days: ${r.activeDays} · Workouts kept: ${r.workoutsKept} (blocked: ${r.workoutsBlocked})`,
  );
  console.log(`  Content: ${r.contentAccess}`);
  console.log(
    `  Free-week eligible: ${r.eligible ? "YES" : "no"}` +
      (r.freeWeekOffer ? ` → ${r.freeWeekOffer}` : ""),
  );
  console.log(`  ENDS UP: ${r.endState}`);
}

console.log("\n=== DIVISION SNAPSHOTS ===\n");
for (const plan of ["explorer", "member", "business", "pro"] as const) {
  const list = results.filter((r) => r.plan === plan).sort((a, b) => b.points - a.points);
  if (!list.length) continue;
  console.log(`${plan.toUpperCase()}:`);
  list.forEach((r, i) => {
    console.log(
      `  #${i + 1} ${r.name} — ${r.points} pts (${r.eligible ? "eligible" : "ineligible"})`,
    );
  });
}

console.log("\n=== ARCADE POWER RANKING ===\n");
[...results]
  .sort((a, b) => b.points - a.points)
  .forEach((r, i) => {
    console.log(
      `${i + 1}. ${r.name.padEnd(22)} ${String(r.points).padStart(4)} pts  [${r.plan}]`,
    );
  });
