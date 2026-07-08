#!/usr/bin/env node
/**
 * Verifies workout exercise GET order matches sortOrder (no warmup re-sort)
 * and DELETE compacts + persists.
 */
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";

let cookies = "";

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
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

async function login() {
  for (const password of ["", "CoachTest123!"]) {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: COACH_EMAIL, password, redirect: "/admin" }),
      redirect: "manual",
    });
    const setCookie = parseSetCookie(loginRes.headers);
    if (loginRes.ok && setCookie.includes("ts_session")) {
      cookies = setCookie;
      return true;
    }
  }
  return false;
}

async function main() {
  if (!(await login())) {
    console.error("Login failed");
    process.exit(1);
  }

  const marker = `PROG-ORDER-${Date.now()}`;
  const create = await req("/api/workouts", {
    method: "POST",
    json: { name: marker },
  });
  assert.equal(create.res.status, 201, create.text);
  const workoutId = create.body.id;

  const lib = await req("/api/exercises");
  const picks = (lib.body || []).filter((e) => e?.id).slice(0, 3);
  assert.ok(picks.length >= 2, "need exercises in library");

  for (let i = 0; i < picks.length; i++) {
    const add = await req(`/api/workouts/${workoutId}/exercises`, {
      method: "POST",
      json: {
        exerciseId: picks[i].id,
        setScheme: "standard",
        reps: "10",
        sets: 3,
        weightTier: "medium",
        restSec: 45,
      },
    });
    assert.equal(add.res.status, 201, add.text);
    await req(`/api/workouts/${workoutId}/exercises`, {
      method: "PATCH",
      json: { itemId: add.body.id, sortOrder: i },
    });
  }

  const before = await req(`/api/workouts/${workoutId}?_t=${Date.now()}`);
  const namesBefore = before.body.exercises.map((e) => e.exercise.name);
  assert.deepEqual(namesBefore, picks.map((p) => p.name), "order should match sortOrder");

  const removeId = before.body.exercises[1].id;
  const del = await req(
    `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(removeId)}`,
    { method: "DELETE" },
  );
  assert.equal(del.res.status, 204, del.text);

  const after = await req(`/api/workouts/${workoutId}?_t=${Date.now()}-2`);
  const namesAfter = after.body.exercises.map((e) => e.exercise.name);
  assert.deepEqual(
    namesAfter,
    [picks[0].name, picks[2].name],
    "middle exercise removed and order compacted",
  );

  await req(`/api/workouts/${workoutId}`, { method: "DELETE" });

  console.log("✅ program-exercise-order-test passed");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});