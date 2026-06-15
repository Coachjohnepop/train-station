/**
 * Seeds a week of coach SMS workouts across Jeremy's roster for beta demo.
 * Persists to prisma/*.dev.json (and Vercel Blob on next server write).
 *
 * Run: npx tsx scripts/seed-coach-beta-week.ts
 */
import { createTodaySessionFromSms } from "../src/lib/today-sessions";

const SEEDS = [
  {
    sessionDate: "2026-06-14",
    scheduledAt: "2026-06-14T11:30:00.000Z",
    userIds: ["demo-user"],
    title: "Active recovery",
    rawSms: `Active recovery — Sunday reset

5 min easy bike

Walking lunges 20 steps

Band pull-aparts 15,15,15

Plank 3 x 45 sec

Stretch hips and shoulders`,
  },
  {
    sessionDate: "2026-06-15",
    scheduledAt: "2026-06-15T11:30:00.000Z",
    userIds: ["demo-user-john-steph"],
    title: "Isolation/Core work",
    rawSms: `Isolation/Core work

Jump squats 20

Flat bench dumbbell press
10,10,10

Cable row
12,12,12

Core: dead bug 3 x 10 each side`,
  },
  {
    sessionDate: "2026-06-16",
    scheduledAt: "2026-06-16T10:30:00.000Z",
    userIds: ["demo-user-john", "demo-user-stephanie"],
    title: "Upper body push",
    rawSms: `Upper body push — Tuesday

Warm up 5 min row

Jump squats 15

Flat bench dumbbell press
10,10,10

Incline flyes
12,12,12

Tricep pushdowns
15,15,15`,
  },
  {
    sessionDate: "2026-06-17",
    scheduledAt: "2026-06-17T10:30:00.000Z",
    userIds: ["demo-user-john-steph"],
    title: "Isolation/Core work",
    rawSms: `So isolation/Core work

Warm up well 5 min bike

Jump squats 20

Flat bench Single arm dumbbell chest press
10,10,10,10 each arm

Incline bench single arm dumbbell chest press
10,10,10,10 each arm

HIIT cool down 5 mins
20 sec on 20 sec off`,
  },
  {
    sessionDate: "2026-06-18",
    scheduledAt: "2026-06-18T10:30:00.000Z",
    userIds: ["demo-user-2"],
    title: "Lower body strength",
    rawSms: `Lower body strength — Jordan

Warm up 5 min bike

Goblet squat
10,10,10,10

Romanian deadlift
10,10,10

Walking lunges
12,12 each leg`,
  },
];

async function main() {
  for (const seed of SEEDS) {
    const result = await createTodaySessionFromSms({
      sessionDate: seed.sessionDate,
      scheduledAt: seed.scheduledAt,
      rawSms: seed.rawSms,
      programSlug: "adult",
      userIds: seed.userIds,
      replacesSchedule: true,
      createdBy: "seed-beta",
      title: seed.title,
    });
    console.log(
      `${seed.sessionDate}: "${result.session.title}" → ${seed.userIds.join(", ")} (${result.parsed.exercises.length} blocks)`,
    );
  }
  console.log("\nDone — sessions + workouts saved to prisma JSON stores.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});