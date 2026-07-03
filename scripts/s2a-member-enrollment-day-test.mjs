#!/usr/bin/env node
/**
 * Slice 2a — enrollment-based Day N helpers (unit-level).
 *
 * Usage:
 *   npm run test:s2a
 */

const DAYS_PER_WEEK = 7;
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

function linearEnrollmentDay(weekNumber, dayNumber) {
  return (weekNumber - 1) * DAYS_PER_WEEK + dayNumber;
}

function enrollmentDayKey(weekNumber, dayNumber) {
  return `W${weekNumber}D${dayNumber}`;
}

function parseEnrollmentDayKey(value) {
  const match = value.trim().match(/^W(\d+)D(\d+)$/i);
  if (!match) return null;
  const weekNumber = Number(match[1]);
  const dayNumber = Number(match[2]);
  if (weekNumber < 1 || dayNumber < 1 || dayNumber > DAYS_PER_WEEK) return null;
  return { weekNumber, dayNumber };
}

function offsetEnrollmentDay(weekNumber, dayNumber, delta, durationWeeks) {
  const linear = (weekNumber - 1) * DAYS_PER_WEEK + (dayNumber - 1) + delta;
  const maxLinear = durationWeeks * DAYS_PER_WEEK - 1;
  if (linear < 0 || linear > maxLinear) return null;
  return {
    weekNumber: Math.floor(linear / DAYS_PER_WEEK) + 1,
    dayNumber: (linear % DAYS_PER_WEEK) + 1,
  };
}

function dayVisibilityTierByOffset(offset) {
  if (offset <= 0) return offset === 0 ? "full" : "names";
  if (offset <= 2) return "names";
  return "label";
}

function main() {
  console.log("\nS2a enrollment day test\n");

  if (linearEnrollmentDay(1, 1) !== 1) fail("W1D1 linear");
  else pass("W1D1 linear", "Day 1");

  if (linearEnrollmentDay(2, 1) !== 8) fail("W2D1 linear");
  else pass("W2D1 linear", "Day 8");

  const parsed = parseEnrollmentDayKey("W2D5");
  if (!parsed || parsed.weekNumber !== 2 || parsed.dayNumber !== 5) fail("parse W2D5");
  else pass("parse W2D5");

  if (parseEnrollmentDayKey("2026-06-16")) fail("reject calendar iso");
  else pass("reject calendar iso");

  const tueStart = offsetEnrollmentDay(1, 2, 0, 4);
  if (!tueStart || tueStart.weekNumber !== 1 || tueStart.dayNumber !== 2) {
    fail("enrollment anchor W1D2");
  } else {
    pass("enrollment anchor W1D2", "Tuesday = Day 2 in week grid");
  }

  const next = offsetEnrollmentDay(1, 7, 1, 4);
  if (!next || enrollmentDayKey(next.weekNumber, next.dayNumber) !== "W2D1") {
    fail("W1D7 +1 → W2D1");
  } else {
    pass("W1D7 +1 → W2D1");
  }

  const window = [];
  for (let offset = -2; offset <= 2; offset++) {
    const c = offsetEnrollmentDay(2, 3, offset, 4);
    if (c) window.push({ offset, key: enrollmentDayKey(c.weekNumber, c.dayNumber) });
  }
  if (window.length !== 5) fail("5-day window", String(window.length));
  else pass("5-day window", window.map((w) => w.key).join(", "));

  if (dayVisibilityTierByOffset(0) !== "full") fail("today = full");
  else pass("today = full visibility");

  if (dayVisibilityTierByOffset(2) !== "names") fail("+2 = names");
  else pass("+2 = names visibility");

  if (dayVisibilityTierByOffset(3) !== "label") fail("+3 = label");
  else pass("+3 = label visibility");

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
  console.log("\nS2a acceptance: PASS\n");
}

main();