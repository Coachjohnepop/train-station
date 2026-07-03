import { parseSmsWorkout } from "../src/lib/sms-workout-parser";
import {
  formatParsedWorkoutAsSms,
  resolveCertifiedExportText,
  validateWorkoutExportText,
} from "../src/lib/workout-export";

const SAMPLE = `Upper body push — Tuesday

Warm up 5 min row

Jump squats 15

Flat bench dumbbell press
10,10,10

Incline flyes
12,12,12

Stretch`;

const parsed = parseSmsWorkout(SAMPLE);
const formatted = formatParsedWorkoutAsSms(parsed);
const validation = validateWorkoutExportText(formatted, parsed);
const resolved = resolveCertifiedExportText(SAMPLE, parsed);

if (!validation.ok) {
  console.error("Formatted export failed:", validation.issues);
  process.exit(1);
}
if (!resolved.validation.ok) {
  console.error("Resolved export failed:", resolved.validation.issues);
  process.exit(1);
}
console.log("OK — workout export round-trip");