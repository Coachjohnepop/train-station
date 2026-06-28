#!/usr/bin/env node
/**
 * Pin adult program week-2 days to real calendar dates and full gym workouts
 * (replaces sparse QA template clones that show "Unknown" exercises).
 *
 * Usage:
 *   node scripts/seed-member-upcoming-schedule.mjs
 *   node scripts/seed-member-upcoming-schedule.mjs --dry-run
 */
import { blobOptions } from "./remove-member-email.mjs";
import { head, put } from "@vercel/blob";

const SEED_PATH = "demo/seed-data.json";
const ADULT_PROGRAM_ID = "cmpyrkpc900003irzxwgebubc";
const WEEK2_ID = "cmpys1ggx000btfrzl2imth7d";
const WEEK1_ID = "cmpys1gen0003tfrzifnpsnxe";
const PROGRAM_START = "2026-06-22";

/** W2D1 today (Mon Jun 29) through W2D6 (Sat Jul 4) — tomorrow + next 4 days from today. */
const WEEK2_SCHEDULE = [
  {
    dayNumber: 1,
    dayId: "cmpys1gh4000ctfrz26wt3vlf",
    calendarDate: "2026-06-29",
    workoutId: "cmpzkkszr003c95rzbv9yo6db",
  },
  {
    dayNumber: 2,
    dayId: "cmpys1ghd000dtfrz98wtan6d",
    calendarDate: "2026-06-30",
    workoutId: "cmpzkkt6o003r95rzr7p1qgtc",
  },
  {
    dayNumber: 3,
    dayId: "cmpys1ghl000etfrzrn4l53o0",
    calendarDate: "2026-07-01",
    workoutId: "cmpzkktd6004a95rzoaly4h22",
  },
  {
    dayNumber: 4,
    dayId: "cmpys1ghz000ftfrzhk1owobe",
    calendarDate: "2026-07-02",
    workoutId: "cmpzkktf1004e95rze2djnufn",
  },
  {
    dayNumber: 5,
    dayId: "cmpys1gi6000gtfrzjfa3wkgf",
    calendarDate: "2026-07-03",
    workoutId: "cmpzkktk0004r95rzp5483mwq",
  },
  {
    dayNumber: 6,
    dayId: "cmpys1gid000htfrz171oqy3t",
    calendarDate: "2026-07-04",
    workoutId: "cmpzkktpl005a95rz8mnkzcwi",
  },
];

const WEEK1_TAIL_DATES = [
  { dayNumber: 3, calendarDate: "2026-06-24" },
  { dayNumber: 4, calendarDate: "2026-06-25" },
  { dayNumber: 5, calendarDate: "2026-06-26" },
  { dayNumber: 6, calendarDate: "2026-06-27" },
  { dayNumber: 7, calendarDate: "2026-06-28" },
];

async function readJson(path) {
  const opts = blobOptions();
  const meta = await head(path, opts);
  const res = await fetch(`${meta.url}?_ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`read ${path}: ${res.status}`);
  return res.json();
}

async function writeJson(path, data) {
  await put(path, JSON.stringify(data, null, 2), {
    ...blobOptions(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

function upsertGymOption(seed, dayId, workoutId) {
  const options = seed.programDayOptions || [];
  const gymIdx = options.findIndex((o) => o.dayId === dayId && /^gym$/i.test(o.label || ""));
  const next = {
    id: gymIdx >= 0 ? options[gymIdx].id : `pdo-${dayId}-gym-${Date.now()}`,
    dayId,
    workoutId,
    label: "Gym",
    sortOrder: 0,
  };
  if (gymIdx >= 0) options[gymIdx] = { ...options[gymIdx], workoutId };
  else options.push(next);
  seed.programDayOptions = options;
}

function patchSeed(seed) {
  const adult = (seed.programs || []).find((p) => p.id === ADULT_PROGRAM_ID || p.slug === "adult");
  if (!adult) throw new Error("Adult program not found in seed");
  adult.startDate = PROGRAM_START;

  const days = seed.programDays || [];
  const workouts = Object.fromEntries((seed.workouts || []).map((w) => [w.id, w]));
  const wex = seed.workoutExercises || [];

  for (const tail of WEEK1_TAIL_DATES) {
    const day = days.find((d) => d.weekId === WEEK1_ID && d.dayNumber === tail.dayNumber);
    if (day) day.calendarDate = tail.calendarDate;
  }

  const changes = [];
  for (const entry of WEEK2_SCHEDULE) {
    const day = days.find((d) => d.id === entry.dayId || (d.weekId === WEEK2_ID && d.dayNumber === entry.dayNumber));
    if (!day) {
      changes.push({ dayNumber: entry.dayNumber, status: "missing day row" });
      continue;
    }
    const exerciseCount = wex.filter((we) => we.workoutId === entry.workoutId).length;
    if (!workouts[entry.workoutId]) {
      changes.push({ dayNumber: entry.dayNumber, status: "workout missing", workoutId: entry.workoutId });
      continue;
    }
    day.calendarDate = entry.calendarDate;
    day.workoutId = entry.workoutId;
    upsertGymOption(seed, day.id, entry.workoutId);
    changes.push({
      dayNumber: entry.dayNumber,
      calendarDate: entry.calendarDate,
      workout: workouts[entry.workoutId].name,
      exercises: exerciseCount,
    });
  }

  return { changes, adult };
}

const dryRun = process.argv.includes("--dry-run");

try {
  const seed = await readJson(SEED_PATH);
  const { changes, adult } = patchSeed(seed);

  console.log(`Program startDate → ${adult.startDate}`);
  for (const c of changes) {
    if (c.status) console.log(`  W2D${c.dayNumber}: ${c.status}`);
    else console.log(`  W2D${c.dayNumber} ${c.calendarDate} → ${c.workout} (${c.exercises} exercises)`);
  }

  if (dryRun) {
    console.log("Dry run — no blob write.");
    process.exit(0);
  }

  await writeJson(SEED_PATH, seed);
  console.log(`✓ Updated ${SEED_PATH} on blob storage`);
} catch (e) {
  console.error(e);
  process.exit(1);
}