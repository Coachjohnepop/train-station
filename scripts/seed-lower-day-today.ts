/**
 * Assign today's Lower Day SMS workout to John + Stephanie on prod blob.
 *
 *   npx tsx scripts/seed-lower-day-today.ts
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createTodaySessionFromSms } from "../src/lib/today-sessions";

const LOWER_DAY_SMS = `Lower Day

Warm up bicycle or walk at 3.3 on treadmill at 7.0 incline
5 mins

Rest periods are 1:30 min

Upper body warm up
Band exercises
Dumbbell bicep curls 20
Dumbbell shoulder press 20

25 air squats

Leg press
4 sets
20 sec hold at bottom of lift
Then burnout reps immediately
Stay flexible

Barbell hip thrust raise
4 sets
30 sec hold at top of squeeze
Then burnout reps immediately

Seated calf raises
4 sets
30 sec hold at top of squeeze
Then 15 reps immediately

Dumbbell Bulgarian split squats
3 sets each leg
Hold at bottom 20 sec
Then burnout reps immediately

HIIT jump squats to finish
8 rounds 20 sec on 20 sec off

Stretch well`;

const MEMBER_EMAILS = ["john@bcxvoice.com", "sprealty9@gmail.com"];

async function main() {
  const { listSelfRegisteredAccounts } = await import("../src/lib/member-accounts-store");
  const accounts = await listSelfRegisteredAccounts();
  const byEmail = new Map(accounts.map((a) => [a.email.toLowerCase(), a.account.userId]));

  const userIds: string[] = [];
  for (const email of MEMBER_EMAILS) {
    const id = byEmail.get(email.toLowerCase());
    if (!id) {
      console.warn(`Skip — no account: ${email}`);
      continue;
    }
    userIds.push(id);
    console.log(`✓ ${email} → ${id}`);
  }

  if (userIds.length === 0) {
    console.error("No member user IDs found.");
    process.exit(1);
  }

  const now = new Date();
  const sessionDate = now.toISOString().slice(0, 10);
  const scheduled = new Date(now);
  scheduled.setHours(6, 30, 0, 0);

  const result = await createTodaySessionFromSms({
    sessionDate,
    scheduledAt: scheduled.toISOString(),
    rawSms: LOWER_DAY_SMS,
    programSlug: "adult",
    userIds,
    replacesSchedule: true,
    createdBy: "seed-lower-day-today",
    title: "Lower Day",
  });

  console.log(`\nSeeded session ${result.session.id} for ${sessionDate}`);
  console.log(`Workout: ${result.workoutId}`);
  console.log(`Blocks (${result.parsed.exercises.length}):`);
  for (const ex of result.parsed.exercises) {
    console.log(`  - ${ex.name}: ${ex.sets}× ${ex.reps}${ex.notes ? ` — ${ex.notes.slice(0, 50)}` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});