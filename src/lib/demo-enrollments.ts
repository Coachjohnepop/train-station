import fs from "fs";
import path from "path";
import { isDatabaseConfigured } from "@/lib/database-config";
import {
  getDemoEnrollmentsStoreSync,
  hydrateDemoEnrollmentsStore,
  persistDemoEnrollmentsStore,
  type DemoEnrollmentsStore,
  type PerUserEnrollments,
} from "@/lib/demo-member-progress-store";

const DEV_FILE = path.join(process.cwd(), "prisma", "enrollments.dev.json");

type EnrollmentsStore = DemoEnrollmentsStore;

function loadEnrollmentsStore(): EnrollmentsStore {
  return getDemoEnrollmentsStoreSync();
}

async function saveEnrollmentsStore(store: EnrollmentsStore) {
  await persistDemoEnrollmentsStore(store);
}

export { hydrateDemoEnrollmentsStore };

function getUserEnrollments(userId: string): PerUserEnrollments {
  const store = loadEnrollmentsStore();
  const key = userId || "demo-user";
  if (!store[key]) store[key] = {};
  return store[key];
}

async function setUserEnrollments(userId: string, data: PerUserEnrollments) {
  await hydrateDemoEnrollmentsStore({ preferFresh: true });
  const store = loadEnrollmentsStore();
  const key = userId || "demo-user";
  store[key] = data;
  await saveEnrollmentsStore(store);
}

/** Legacy single-user shape for callers that haven't been updated yet (returns demo-user bucket) */
function loadDemoEnrollments(): PerUserEnrollments {
  return getUserEnrollments("demo-user");
}

async function saveDemoEnrollments(data: PerUserEnrollments) {
  await setUserEnrollments("demo-user", data);
}

/** True when member/enrollment state uses blob + JSON (no real Postgres). */
export function isDemoMode(): boolean {
  return !isDatabaseConfigured();
}

/** Returns enrollments for a specific user id (empty map for new users until enrolled). */
export function getDemoEnrollments(userId?: string) {
  const uid = userId || "demo-user";
  const store = loadEnrollmentsStore();
  return store[uid] || {};
}

export async function enrollDemo(slug: string, userId?: string) {
  await hydrateDemoEnrollmentsStore({ preferFresh: true });
  const uid = userId || "demo-user";
  const data = getUserEnrollments(uid);
  if (!data[slug]) {
    data[slug] = { currentWeek: 1, currentDay: 1 };
    await setUserEnrollments(uid, data);
  }
}

export async function unenrollDemo(slug: string, userId?: string) {
  const uid = userId || "demo-user";
  const data = getUserEnrollments(uid);
  if (data[slug]) {
    delete data[slug];
    await setUserEnrollments(uid, data);
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
export async function advanceDemoEnrollmentForWorkout(slug: string, workoutId: string, userId?: string) {
  await hydrateDemoEnrollmentsStore({ preferFresh: true });
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
    await setUserEnrollments(uid, enrolls);
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
  await setUserEnrollments(uid, enrolls);
}

/**
 * Simple advance for any program (workout, eating, yoga, etc.).
 * Increments the current day/week for the slug's enrollment.
 * Used by prompts logging for eating/yoga so they advance independently.
 */
export async function setDemoEnrollmentPosition(
  slug: string,
  currentWeek: number,
  currentDay: number,
  userId?: string,
  durationWeeks = 4,
) {
  await hydrateDemoEnrollmentsStore({ preferFresh: true });
  const uid = userId || "demo-user";
  const enrolls = getUserEnrollments(uid);
  const week = Math.min(Math.max(1, Math.floor(currentWeek)), Math.max(1, durationWeeks));
  const day = Math.min(Math.max(1, Math.floor(currentDay)), 7);
  enrolls[slug] = { currentWeek: week, currentDay: day };
  await setUserEnrollments(uid, enrolls);
  return { currentWeek: week, currentDay: day };
}

export async function advanceDemoEnrollment(slug: string, userId?: string) {
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
  await setUserEnrollments(uid, enrolls);
}
