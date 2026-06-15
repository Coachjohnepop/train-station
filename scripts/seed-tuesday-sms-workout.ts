/**
 * Seeds the sample SMS isolation/core workout for John & Stephanie
 * on Tuesday 2026-06-17 at 6:30 AM local (stored as 10:30 UTC).
 *
 * Run: npx tsx scripts/seed-tuesday-sms-workout.ts
 */
import { createTodaySessionFromSms } from "../src/lib/today-sessions";

const SAMPLE_SMS = `So isolation/Core work

Warm up well 5 min bike

Upper body warm up
Shoulder mobility warm
Up with bands 

Jump squats 20 

Flat bench Single arm dumbbell chest press 
10,10,10,10
Each arm 

Incline bench single arm dumbbell chest press 
10,10,10,10 each arm 

Seated single arm dumbbell shoulder press
10,10,10 each arm 

Flat bench single arm dumbbell tricep extensions 
10,10,10,10 each arm 

Standing Straight bar cable tricep extensions 
10,10,10 

HIIT cool down 
5 mins 
20 sec on 20 sec off  

Stretch well`;

const result = createTodaySessionFromSms({
  sessionDate: "2026-06-17",
  scheduledAt: "2026-06-17T10:30:00.000Z",
  rawSms: SAMPLE_SMS,
  programSlug: "adult",
  userIds: ["demo-user-john", "demo-user-stephanie"],
  replacesSchedule: true,
  createdBy: "seed-script",
  title: "Isolation/Core work",
});

console.log("Seeded today session:", result.session.id);
console.log("Workout:", result.workoutId, "with", result.parsed.exercises.length, "exercise blocks:");
for (const ex of result.parsed.exercises) {
  console.log(`  - ${ex.name}: ${ex.sets}x ${ex.reps}${ex.notes ? ` (${ex.notes})` : ""}`);
}