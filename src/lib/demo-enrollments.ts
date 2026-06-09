import fs from "fs";
import path from "path";

const DEV_FILE = path.join(process.cwd(), "prisma", "enrollments.dev.json");

function loadDemoEnrollments(): Record<string, { currentWeek: number; currentDay: number }> {
  if (fs.existsSync(DEV_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DEV_FILE, "utf8"));
    } catch {}
  }
  // default initial for demo
  const initial = { 
    adult: { currentWeek: 2, currentDay: 5 },
    "john-steph": { currentWeek: 1, currentDay: 2 }  // pre-enroll demo in journey for testing substitution
  };
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(initial, null, 2));
  } catch {}
  return initial;
}

function saveDemoEnrollments(data: Record<string, { currentWeek: number; currentDay: number }>) {
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

export function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

export function getDemoEnrollments() {
  return loadDemoEnrollments();
}

export function enrollDemo(slug: string) {
  const data = loadDemoEnrollments();
  if (!data[slug]) {
    data[slug] = { currentWeek: 1, currentDay: 1 };
    saveDemoEnrollments(data);
  }
}

export function unenrollDemo(slug: string) {
  const data = loadDemoEnrollments();
  if (data[slug]) {
    delete data[slug];
    saveDemoEnrollments(data);
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
export function advanceDemoEnrollmentForWorkout(slug: string, workoutId: string) {
  const enrolls = loadDemoEnrollments();
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
    saveDemoEnrollments(enrolls);
    return;
  }

  const weeks = (seed.programWeeks || []).filter((w: any) => w.programId === prog.id);
  const days = (seed.programDays || []).filter((d: any) => {
    const wk = weeks.find((w: any) => w.id === d.weekId);
    if (!wk) return false;
    // Support hybrid options: primary workoutId or in options
    return d.workoutId === workoutId || (d.options || []).some((o: any) => o.workoutId === workoutId);
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
  saveDemoEnrollments(enrolls);
}

/**
 * Simple advance for any program (workout, eating, yoga, etc.).
 * Increments the current day/week for the slug's enrollment.
 * Used by prompts logging for eating/yoga so they advance independently.
 */
export function advanceDemoEnrollment(slug: string) {
  const enrolls = loadDemoEnrollments();
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
  saveDemoEnrollments(enrolls);
}
