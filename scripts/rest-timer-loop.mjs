#!/usr/bin/env node
/**
 * Loop the live-session rest timer: start → skip → poll → auto-save without
 * restActive. Rest must stay off unless a new restActive is sent.
 *
 *   node scripts/rest-timer-loop.mjs
 *   ROUNDS=8 BASE_URL=https://www.thetrainstation.co node scripts/rest-timer-loop.mjs
 *
 * Marker: REST-TIMER-LOOP
 */
import { createCoachClient } from "./lib/coach-auth.mjs";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || "5"));
const POLLS = Math.max(3, Number(process.env.POLLS || "8"));
const MARK = "REST-TIMER-LOOP";
const RUN = Date.now().toString(36);
const OUT = resolve(
  process.cwd(),
  process.env.OUT || "scripts/.rest-timer-loop-latest.json",
);

const MEMBER_EMAIL = process.env.MEMBER_EMAIL || "demo@thetrainstation.co";
const MEMBER_PASSWORD = process.env.MEMBER_PASSWORD || "ConfettiGoose2026!";

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
}
function assert(cond, name, detail = "") {
  if (cond) pass(name, detail);
  else {
    fail(name, detail);
    throw new Error(`${name}: ${detail}`);
  }
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loginMember() {
  const client = createCoachClient(BASE, {
    coachEmail: MEMBER_EMAIL,
    password: MEMBER_PASSWORD,
  });
  const ok = await client.loginCoach();
  if (!ok) throw new Error(`Login failed for ${MEMBER_EMAIL}`);
  return client;
}

function restActiveOf(body) {
  return body?.session?.restActive ?? body?.restActive ?? null;
}

async function getLive(client, workoutId, userId, date) {
  return client.req(
    `/api/workouts/${encodeURIComponent(workoutId)}/live-session?userId=${encodeURIComponent(userId)}&date=${date}`,
  );
}

async function putLive(client, workoutId, json) {
  return client.req(`/api/workouts/${encodeURIComponent(workoutId)}/live-session`, {
    method: "PUT",
    json,
  });
}

async function main() {
  console.log(`\n⏱  ${MARK}`);
  console.log(`BASE: ${BASE}`);
  console.log(`ROUNDS: ${ROUNDS}  POLLS/skip: ${POLLS}  RUN: ${RUN}\n`);

  const member = await loginMember();
  pass("member login", MEMBER_EMAIL);

  const sess = await member.req("/api/auth/session");
  const lb = await member.req("/api/member/leaderboard?scope=site");
  const memberId =
    sess.body?.user?.id ||
    lb.body?.viewer?.userId ||
    lb.body?.viewer?.id ||
    null;
  assert(memberId, "member id", `session ${sess.res.status} leaderboard ${lb.res.status}`);

  const date = todayIso();
  const created = [];

  try {
    for (let round = 1; round <= ROUNDS; round++) {
      console.log(`\n========== Round ${round}/${ROUNDS} ==========`);

      // Live session is keyed by userId:workoutId:date — no catalog row required.
      const workoutId = `rest-loop-${RUN}-r${round}`;
      const blockId = `block-${RUN}-r${round}`;
      created.push({ workoutId });

      const base = {
        userId: memberId,
        sessionDate: date,
        finishedExercises: [],
        weights: {},
        updatedBy: "member",
      };

      const ends1 = Date.now() + 45_000;
      const start = await putLive(member, workoutId, {
        ...base,
        completedSets: { [blockId]: [1] },
        restTimerEnabled: true,
        restTimerSeconds: 45,
        restActive: {
          blockId,
          completedSetNum: 1,
          endsAt: ends1,
          totalSeconds: 45,
          startedBy: "member",
          phase: "rest",
        },
      });
      assert(start.res.ok, `r${round} start rest`, String(start.res.status));
      assert(restActiveOf(start.body)?.endsAt === ends1, `r${round} rest stored`, JSON.stringify(restActiveOf(start.body)));

      const skip = await putLive(member, workoutId, {
        ...base,
        completedSets: { [blockId]: [1] },
        restActive: null,
      });
      assert(skip.res.ok, `r${round} skip rest`, String(skip.res.status));
      assert(restActiveOf(skip.body) == null, `r${round} skip cleared`, JSON.stringify(restActiveOf(skip.body)));

      for (let p = 1; p <= POLLS; p++) {
        const g = await getLive(member, workoutId, memberId, date);
        assert(g.res.ok, `r${round} poll ${p}`, String(g.res.status));
        assert(
          restActiveOf(g.body) == null,
          `r${round} poll ${p} rest stays off`,
          JSON.stringify(restActiveOf(g.body)),
        );
        await sleep(80);
      }

      const autoSave = await putLive(member, workoutId, {
        ...base,
        completedSets: { [blockId]: [1] },
        weights: { [blockId]: "35" },
      });
      assert(autoSave.res.ok, `r${round} auto-save omits restActive`, String(autoSave.res.status));
      assert(
        restActiveOf(autoSave.body) == null,
        `r${round} auto-save did not resurrect rest`,
        JSON.stringify(restActiveOf(autoSave.body)),
      );

      const extraSet = await putLive(member, workoutId, {
        ...base,
        completedSets: { [blockId]: [1, 2] },
      });
      assert(extraSet.res.ok, `r${round} extra set without restActive`, String(extraSet.res.status));
      assert(
        restActiveOf(extraSet.body) == null,
        `r${round} extra set did not auto-start rest`,
        JSON.stringify(restActiveOf(extraSet.body)),
      );

      const again = await getLive(member, workoutId, memberId, date);
      assert(again.res.ok, `r${round} GET after extra set`, String(again.res.status));
      assert(
        restActiveOf(again.body) == null,
        `r${round} GET rest still off`,
        JSON.stringify(restActiveOf(again.body)),
      );

      const ends2 = Date.now() + 30_000;
      const restart = await putLive(member, workoutId, {
        ...base,
        completedSets: { [blockId]: [1, 2] },
        restActive: {
          blockId,
          completedSetNum: 2,
          endsAt: ends2,
          totalSeconds: 30,
          startedBy: "member",
          phase: "rest",
        },
      });
      assert(restart.res.ok, `r${round} intentional rest starts`, String(restart.res.status));
      assert(restActiveOf(restart.body)?.completedSetNum === 2, `r${round} rest set 2`, JSON.stringify(restActiveOf(restart.body)));

      const skip2 = await putLive(member, workoutId, {
        ...base,
        completedSets: { [blockId]: [1, 2] },
        restActive: null,
      });
      assert(skip2.res.ok && restActiveOf(skip2.body) == null, `r${round} second skip sticks`);

      await putLive(member, workoutId, {
        ...base,
        completedSets: { [blockId]: [1, 2] },
        restActive: null,
        clear: true,
        updatedBy: "member",
      });
    }
  } finally {
    for (const row of created) {
      try {
        await putLive(member, row.workoutId, {
          userId: memberId,
          sessionDate: date,
          completedSets: {},
          finishedExercises: [],
          clear: true,
          updatedBy: "member",
        });
      } catch {
        /* ignore */
      }
    }
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    mark: MARK,
    run: RUN,
    base: BASE,
    rounds: ROUNDS,
    polls: POLLS,
    passed: results.filter((r) => r.ok).length,
    failed: failed.length,
    results,
    at: new Date().toISOString(),
  };
  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`\n${failed.length ? "FAILED" : "PASS"} ${summary.passed} ok / ${failed.length} fail  → ${OUT}\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
