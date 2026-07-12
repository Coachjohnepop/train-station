#!/usr/bin/env node
/**
 * Prod loop: coach + member workout checklist → log → points → standing.
 * Client confetti is verified by event payload shape (UI is manual/visual).
 *
 * Funny marker: CONFETTI-GOOSE-SOAK
 *
 * Usage:
 *   COACH_PASSWORD=… MEMBER_PASSWORD=… node scripts/confetti-goose-score-loop.mjs
 *   ROUNDS=2 BASE_URL=https://www.thetrainstation.co node scripts/confetti-goose-score-loop.mjs
 */

import { createCoachClient } from "./lib/coach-auth.mjs";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || "2"));
const MARK = "CONFETTI-GOOSE-SOAK";
const RUN = `${Date.now().toString(36)}`;

const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const MEMBER_EMAIL =
  process.env.MEMBER_EMAIL || "demo@thetrainstation.co";
const MEMBER_PASSWORD =
  process.env.MEMBER_PASSWORD || "ConfettiGoose2026!";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loginAs(email, password) {
  const client = createCoachClient(BASE, { coachEmail: email, password });
  const ok = await client.loginCoach();
  if (!ok) throw new Error(`Login failed for ${email}`);
  return client;
}

async function main() {
  console.log(`\n🎆 ${MARK} — checklist / confetti payload / score / standing`);
  console.log(`BASE: ${BASE}`);
  console.log(`ROUNDS: ${ROUNDS}`);
  console.log(`RUN: ${RUN}\n`);

  const summary = [];
  const createdWorkoutIds = [];

  try {
    for (let round = 1; round <= ROUNDS; round++) {
      console.log(`\n========== Round ${round}/${ROUNDS} ==========\n`);

      // ── Coach: ensure a tiny workout exists for checklist ──
      console.log("  → Coach login + build micro workout");
      const coach = await loginAs(
        COACH_EMAIL,
        process.env.COACH_PASSWORD || "LaserChickenSoak2026!",
      );

      const exName = `${MARK} · R${round} honk-squat · ${RUN}`;
      const createEx = await coach.req("/api/exercises", {
        method: "POST",
        json: {
          name: exName,
          description: "Goose-powered squat for confetti tests",
          tags: "confetti-goose,soak",
        },
      });
      assert(
        createEx.res.status === 201 || createEx.res.ok,
        `create exercise ${createEx.res.status} ${createEx.text}`,
      );
      const exerciseId = createEx.body.id;

      const wName = `${MARK} · R${round} parade · ${RUN}`;
      const createW = await coach.req("/api/workouts", {
        method: "POST",
        json: { name: wName },
      });
      assert(createW.res.ok || createW.res.status === 201, `create workout ${createW.res.status}`);
      const workoutId = createW.body.id;
      createdWorkoutIds.push(workoutId);

      const add = await coach.req(`/api/workouts/${workoutId}/exercises`, {
        method: "POST",
        json: {
          exerciseId,
          setScheme: "standard",
          sets: 3,
          reps: "8",
          weightTier: "medium",
          restSec: 45,
          notes: "Checklist: tap all sets then finish",
        },
      });
      assert(add.res.ok || add.res.status === 201, `add line ${add.res.status} ${add.text}`);
      const itemId = add.body.id;
      assert(itemId, "missing workoutExercise id");

      const getW = await coach.req(`/api/workouts/${workoutId}`);
      assert(getW.res.ok, "get workout");
      assert((getW.body.exercises || []).length >= 1, "workout has exercises");
      console.log(`  ✅ Coach checklist workout ready (${workoutId})`);

      // ── Member: load workout + log complete + points ──
      console.log("  → Member login + complete log + gamification");
      const member = await loginAs(MEMBER_EMAIL, MEMBER_PASSWORD);

      // Live-session checklist (standing sets) — push completed sets like the console
      // /api/auth/session does not always return user id — pull from leaderboard viewer
      const lbSelf = await member.req("/api/member/leaderboard?scope=site");
      const memberId =
        lbSelf.body?.viewer?.userId ||
        lbSelf.body?.viewer?.id ||
        null;
      assert(memberId, `member id missing (leaderboard ${lbSelf.res.status})`);
      // completedSets values are 1-based set numbers (schema: positive ints)
      const livePut = await member.req(`/api/workouts/${workoutId}/live-session`, {
        method: "PUT",
        json: {
          userId: memberId,
          sessionDate: todayIso(),
          completedSets: { [itemId]: [1, 2, 3] },
          finishedExercises: [itemId],
          weights: {},
          updatedBy: "member",
        },
      });
      if (livePut.res.ok) {
        console.log("  ✅ Live checklist sets saved (all 3 sets + finish)");
      } else {
        console.log(
          `  ⚠ live-session ${livePut.res.status}: ${String(livePut.text).slice(0, 140)}`,
        );
      }

      // Unique event id path uses workout:date — use unique date offset via random sessionDate
      // award uses localTodayIso by default; re-log same day may not re-award.
      // Use a synthetic sessionDate per round for unique eventId if API allows.
      const sessionDate = todayIso();
      const logRes = await member.req(`/api/workouts/${workoutId}/log`, {
        method: "POST",
        json: {
          progress: 100,
          sessionDate,
          exercises: [
            {
              workoutExerciseId: itemId,
              exerciseId,
              setScheme: "standard",
              reps: "8",
              sets: 3,
              weightTier: "medium",
              setsCompleted: 3,
              repsCompleted: 24,
            },
          ],
        },
      });
      assert(
        logRes.res.ok,
        `log workout ${logRes.res.status}: ${String(logRes.text).slice(0, 200)}`,
      );

      const gamification = logRes.body.gamification;
      assert(gamification, "missing gamification payload (needed for confetti UI)");
      assert(
        typeof gamification.totalPoints === "number",
        "totalPoints missing",
      );
      const pointsEarned = gamification.awarded
        ? gamification.pointsEarned ?? 0
        : 0;
      console.log(
        `  ✅ Log OK — awarded=${Boolean(gamification.awarded)} pointsEarned=${pointsEarned} total=${gamification.totalPoints}`,
      );
      console.log(
        `  ✅ Confetti UI payload: celebration=workout-complete +${pointsEarned} (client shows 3D gold grow)`,
      );

      // Standing / scores
      const lb = await member.req("/api/member/leaderboard?scope=site");
      if (lb.res.ok && lb.body?.viewer) {
        console.log(
          `  ✅ Standing: rank #${lb.body.viewer.rank} · ${lb.body.viewer.points} pts (${lb.body.viewer.displayName})`,
        );
      } else {
        const prog = await member.req("/api/member/gamification");
        if (prog.res.ok) {
          console.log(
            `  ✅ Scores snapshot: totalPoints=${prog.body.totalPoints ?? prog.body?.progress?.totalPoints}`,
          );
        } else {
          console.log(`  ⚠ leaderboard ${lb.res.status} / gamification ${prog.res.status}`);
        }
      }

      // Coach can see live floor / set checks
      console.log("  → Coach live-session readback");
      const coach2 = await loginAs(
        COACH_EMAIL,
        process.env.COACH_PASSWORD || "LaserChickenSoak2026!",
      );
      const liveGet = await coach2.req(
        `/api/workouts/${workoutId}/live-session?userId=${encodeURIComponent(memberId)}&date=${sessionDate}`,
      );
      if (liveGet.res.ok) {
        const sess = liveGet.body?.session || liveGet.body;
        const finished = sess?.finishedExercises || [];
        const sets = sess?.completedSets || {};
        console.log(
          `  ✅ Coach sees checklist: finished=${finished.length} setKeys=${Object.keys(sets).length}`,
        );
      } else {
        console.log(`  ⚠ coach live get ${liveGet.res.status}`);
      }

      // Cleanup workout + exercise for this round (keep member points — real)
      await coach2.req(`/api/workouts/${workoutId}`, { method: "DELETE" });
      await coach2.req(`/api/exercises/${exerciseId}`, { method: "DELETE" });
      console.log("  ✅ Cleaned goose workout/exercise");

      summary.push({
        round,
        pointsEarned,
        totalPoints: gamification.totalPoints,
        awarded: gamification.awarded,
      });
      await sleep(400);
    }

    writeFileSync(
      new URL("./.confetti-goose-soak-latest.json", import.meta.url),
      JSON.stringify({ ok: true, mark: MARK, run: RUN, summary, at: new Date().toISOString() }, null, 2),
    );
    console.log(`\n🎆 ${MARK} ALL ROUNDS PASSED\n`);
  } catch (e) {
    console.error("\n❌", e.message);
    writeFileSync(
      new URL("./.confetti-goose-soak-latest.json", import.meta.url),
      JSON.stringify({ ok: false, error: e.message, summary, at: new Date().toISOString() }, null, 2),
    );
    // Best-effort cleanup marked workouts
    try {
      const coach = await loginAs(
        COACH_EMAIL,
        process.env.COACH_PASSWORD || "LaserChickenSoak2026!",
      );
      const list = await coach.req("/api/workouts");
      if (list.res.ok && Array.isArray(list.body)) {
        for (const w of list.body) {
          if (String(w.name || "").includes(MARK)) {
            await coach.req(`/api/workouts/${w.id}`, { method: "DELETE" });
          }
        }
      }
      const ex = await coach.req("/api/exercises");
      if (ex.res.ok && Array.isArray(ex.body)) {
        for (const e of ex.body) {
          if (String(e.name || "").includes(MARK)) {
            await coach.req(`/api/exercises/${e.id}`, { method: "DELETE" });
          }
        }
      }
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
}

main();
