import fs from "fs";
import path from "path";

const DEV_FILE = path.join(process.cwd(), "prisma", "enrollments.dev.json");

type PerUserEnrollments = Record<string, { currentWeek: number; currentDay: number }>;

type EnrollmentsStore = Record<string, PerUserEnrollments>;

function loadEnrollmentsStore(): EnrollmentsStore {
  if (fs.existsSync(DEV_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DEV_FILE, "utf8"));
      if (parsed && typeof parsed === "object") {
        // support legacy flat shape (pre multi-user): treat as the "demo-user" bucket
        if (!parsed["demo-user"] && Object.keys(parsed).some((k) => !k.startsWith("_") && typeof parsed[k] === "object" && "currentWeek" in parsed[k])) {
          return { "demo-user": parsed as PerUserEnrollments };
        }
        return parsed as EnrollmentsStore;
      }
    } catch {}
  }
  const initial: EnrollmentsStore = {
    "demo-user-john-steph": {
      adult: { currentWeek: 2, currentDay: 5 },
    },
    "demo-user": {
      adult: { currentWeek: 2, currentDay: 5 },
      "john-steph": { currentWeek: 1, currentDay: 2 },
    },
  };
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(initial, null, 2));
  } catch {}
  return initial;
}

function saveEnrollmentsStore(store: EnrollmentsStore) {
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(store, null, 2));
  } catch {}
}

function getUserEnrollments(userId: string): PerUserEnrollments {
  const store = loadEnrollmentsStore();
  const key = userId || "demo-user";
  if (!store[key]) store[key] = {};
  return store[key];
}

function setUserEnrollments(userId: string, data: PerUserEnrollments) {
  const store = loadEnrollmentsStore();
  const key = userId || "demo-user";
  store[key] = data;
  saveEnrollmentsStore(store);
}

/** Legacy single-user shape for callers that haven't been updated yet (returns demo-user bucket) */
function loadDemoEnrollments(): PerUserEnrollments {
  return getUserEnrollments("demo-user");
}

function saveDemoEnrollments(data: PerUserEnrollments) {
  setUserEnrollments("demo-user", data);
}

export function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

/** Returns enrollments for a specific user id (empty map for new users until enrolled). */
export function getDemoEnrollments(userId?: string) {
  const uid = userId || "demo-user";
  const store = loadEnrollmentsStore();
  return store[uid] || {};
}

export function enrollDemo(slug: string, userId?: string) {
  const uid = userId || "demo-user";
  const data = getUserEnrollments(uid);
  if (!data[slug]) {
    data[slug] = { currentWeek: 1, currentDay: 1 };
    setUserEnrollments(uid, data);
  }
}

export function unenrollDemo(slug: string, userId?: string) {
  const uid = userId || "demo-user";
  const data = getUserEnrollments(uid);
  if (data[slug]) {
    delete data[slug];
    setUserEnrollments(uid, data);
  }
}

const SEED_PATH = path.join(process.cwd(), "prisma", "seed-data.json");

function loadSeedRaw(): any {
  try {
    return JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  } catch {
    return { programs: [], programWeeks: [], programDays: [] };
  }
}

/**
 * Advance the demo enrollment's currentWeek/currentDay after logging a workout.
 * Mirrors the logic in the log route for real DB: finds the ProgramDay for the workoutId
 * within the program's weeks, then increments day (wrapping week), capping at program end.
 */
export function advanceDemoEnrollmentForWorkout(slug: string, workoutId: string, userId?: string) {
  const uid = userId || "demo-user";
  const enrolls = getUserEnrollments(uid);
  if (!enrolls[slug]) {
    enrolls[slug] = { currentWeek: 1, currentDay: 1 };
  }
  const cur = enrolls[slug];

  const seed = loadSeedRaw();
  const prog = (seed.programs || []).find((p: any) => p.slug === slug);
  if (!prog) {
    // fallback simple increment
    let w = cur.currentWeek || 1;
    let d = (cur.currentDay || 1) + 1;
    if (d > 7) { d = 1; w += 1; }
    const maxW = prog?.durationWeeks || 4;
    if (w > maxW) { w = maxW; d = 7; }
    enrolls[slug] = { currentWeek: w, currentDay: d };
    setUserEnrollments(uid, enrolls);
    return;
  }

  const weeks = (seed.programWeeks || []).filter((w: any) => w.programId === prog.id);
  const dayOptions = seed.programDayOptions || [];
  const days = (seed.programDays || []).filter((d: any) => {
    const wk = weeks.find((w: any) => w.id === d.weekId);
    if (!wk) return false;
    const opts = dayOptions.filter((o: any) => o.programDayId === d.id);
    return (
      d.workoutId === workoutId ||
      opts.some((o: any) => o.workoutId === workoutId)
    );
  });

  const matching = days[0]; // assume unique
  let nextWeek: number;
  let nextDay: number;

  if (matching) {
    const matchWeek = weeks.find((w: any) => w.id === matching.weekId);
    nextWeek = matchWeek ? matchWeek.weekNumber : (cur.currentWeek || 1);
    nextDay = (matching.dayNumber || 1) + 1;
  } else {
    // fallback: increment from current
    nextWeek = cur.currentWeek || 1;
    nextDay = (cur.currentDay || 1) + 1;
  }

  if (nextDay > 7) {
    nextDay = 1;
    nextWeek += 1;
  }
  const maxWeeks = prog.durationWeeks || 4;
  if (nextWeek > maxWeeks) {
    nextWeek = maxWeeks;
    nextDay = 7;
  }

  enrolls[slug] = { currentWeek: nextWeek, currentDay: nextDay };
  setUserEnrollments(uid, enrolls);
}

/**
 * Simple advance for any program (workout, eating, yoga, etc.).
 * Increments the current day/week for the slug's enrollment.
 * Used by prompts logging for eating/yoga so they advance independently.
 */
export function advanceDemoEnrollment(slug: string, userId?: string) {
  const uid = userId || "demo-user";
  const enrolls = getUserEnrollments(uid);
  if (!enrolls[slug]) {
    enrolls[slug] = { currentWeek: 1, currentDay: 1 };
  }
  let w = enrolls[slug].currentWeek || 1;
  let d = (enrolls[slug].currentDay || 1) + 1;
  if (d > 7) {
    d = 1;
    w += 1;
  }
  try {
    const seed = loadSeedRaw();
    const prog = (seed.programs || []).find((p: any) => p.slug === slug);
    const maxW = prog?.durationWeeks || 4;
    if (w > maxW) {
      w = maxW;
      d = 7;
    }
  } catch {}
  enrolls[slug] = { currentWeek: w, currentDay: d };
  setUserEnrollments(uid, enrolls);
}
