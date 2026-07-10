#!/usr/bin/env node
/**
 * Prod smoke: exercise library DELETE removes exercise even when referenced in a workout.
 */
import assert from "node:assert/strict";
import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";

async function main() {
  const { req, loginCoach } = createCoachClient(BASE);
  if (!(await loginCoach())) {
    console.error("Login failed — set COACH_PASSWORD");
    process.exit(1);
  }

  const marker = `prodtest-lib-del-${Date.now()}`;

  const createEx = await req("/api/exercises", {
    method: "POST",
    json: { name: marker, description: "prodtest delete cascade" },
  });
  assert.equal(createEx.res.status, 201, createEx.text);
  const exerciseId = createEx.body.id;

  const createW = await req("/api/workouts", {
    method: "POST",
    json: { name: `${marker}-workout` },
  });
  assert.equal(createW.res.status, 201, createW.text);
  const workoutId = createW.body.id;

  const add = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "POST",
    json: {
      exerciseId,
      setScheme: "standard",
      reps: "10",
      sets: 3,
      weightTier: "medium",
      restSec: 45,
    },
  });
  assert.equal(add.res.status, 201, add.text);

  const delEx = await req(`/api/exercises/${exerciseId}`, { method: "DELETE" });
  assert.equal(delEx.res.status, 204, delEx.text);

  const lib = await req(`/api/exercises?_t=${Date.now()}`);
  assert.ok(!lib.body.some((e) => e.id === exerciseId), "exercise still in library");

  const w = await req(`/api/workouts/${workoutId}?_t=${Date.now()}`);
  assert.equal(w.body.exercises?.length ?? 0, 0, "workout should have no exercises after cascade delete");

  await req(`/api/workouts/${workoutId}`, { method: "DELETE" });

  console.log("✅ library-exercise-delete-prodtest passed");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});