#!/usr/bin/env node
/**
 * Copy Adult program Week 1 → Week 2 (cloned workouts per day).
 * Usage: BASE_URL=https://www.thetrainstation.co node scripts/copy-adult-week1-to-week2.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";
const FROM_WEEK = Number(process.env.FROM_WEEK || "1");
const TO_WEEK = Number(process.env.TO_WEEK || "2");
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

let cookies = "";

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function login() {
  for (const password of ["", "CoachTest123!"]) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: COACH_EMAIL, password, redirect: "/admin" }),
      redirect: "manual",
    });
    const setCookie = parseSetCookie(res.headers);
    if (res.ok && setCookie.includes("ts_session")) {
      cookies = setCookie;
      console.log(`✅ Logged in as ${COACH_EMAIL}`);
      return true;
    }
  }
  console.error("❌ Login failed");
  return false;
}

async function req(path, opts = {}) {
  const headers = { "Cache-Control": "no-cache", ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, cache: "no-store" });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

function dayOptions(day) {
  if (day.options?.length) return day.options;
  if (day.workoutId) return [{ workoutId: day.workoutId, label: "Gym" }];
  return [];
}

async function main() {
  if (!(await login())) process.exit(1);

  const sync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  if (!sync.res.ok) {
    console.error("❌ sync failed", sync.res.status);
    process.exit(1);
  }
  const program = sync.body;
  const fromWeek = program.weeks?.find((w) => w.weekNumber === FROM_WEEK);
  const toWeek = program.weeks?.find((w) => w.weekNumber === TO_WEEK);
  if (!fromWeek || !toWeek) {
    console.error("❌ weeks not found");
    process.exit(1);
  }

  let copiedDays = 0;
  for (const toDay of [...toWeek.days].sort((a, b) => a.dayNumber - b.dayNumber)) {
    const fromDay = fromWeek.days.find((d) => d.dayNumber === toDay.dayNumber);
    if (!fromDay) continue;

    const fromOpts = dayOptions(fromDay).filter((o) => o.workoutId);
    if (fromOpts.length === 0) {
      await req(`/api/programs/days/${toDay.id}`, { method: "PATCH", json: { options: [] } });
      continue;
    }

    const clonedOpts = [];
    for (const opt of fromOpts) {
      const dayLabel = DAY_NAMES[toDay.dayNumber - 1] ?? `Day${toDay.dayNumber}`;
      const cloneRes = await req(`/api/workouts/${opt.workoutId}/clone`, {
        method: "POST",
        json: { name: `Adult W${TO_WEEK} ${dayLabel} ${opt.label}` },
      });
      if (!cloneRes.res.ok) {
        console.error(`❌ clone failed day ${toDay.dayNumber}`, cloneRes.text);
        process.exit(1);
      }
      clonedOpts.push({ workoutId: cloneRes.body.id, label: opt.label });
    }

    const patch = await req(`/api/programs/days/${toDay.id}`, {
      method: "PATCH",
      json: {
        options: clonedOpts,
        defaultSets: fromDay.defaultSets ?? undefined,
        defaultReps: fromDay.defaultReps ?? undefined,
        defaultRestSec: fromDay.defaultRestSec ?? undefined,
        publishedAt: fromDay.publishedAt ?? undefined,
        calendarDate: toDay.calendarDate ?? undefined,
      },
    });
    if (!patch.res.ok) {
      console.error(`❌ patch day ${toDay.dayNumber}`, patch.text);
      process.exit(1);
    }
    copiedDays++;
    console.log(`✅ Week ${TO_WEEK} ${DAY_NAMES[toDay.dayNumber - 1] ?? toDay.dayNumber} (${clonedOpts.length} workout(s))`);
  }

  console.log(`\nDone — copied ${copiedDays} day(s) from week ${FROM_WEEK} → week ${TO_WEEK}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});