import { parseCycleDayKey } from "@/lib/program-cycle-day";
import { stripDayPrefixFromWorkoutName, stripLocationSuffixFromWorkoutName } from "@/lib/workout-content-name";

export type UploadCycleTarget = {
  /** Day within the 28-day month (1–28). */
  cycleDay: number | null;
  /** Override month from text (e.g. M5D3); null = use selected cycle month. */
  cycleMonth: number | null;
  trainingLocation: "gym" | "home" | null;
  contentTitle: string;
};

function stripLocationHints(name: string): { location: "gym" | "home" | null; text: string } {
  let text = name.trim();
  let location: "gym" | "home" | null = null;

  if (/\s*[-–—]\s*home\s*$/i.test(text) || /\s*\(home\)\s*$/i.test(text)) {
    location = "home";
    text = text.replace(/\s*[-–—]\s*home\s*$/i, "").replace(/\s*\(home\)\s*$/i, "");
  } else if (/\s*[-–—]\s*gym\s*$/i.test(text) || /\s*\(gym\)\s*$/i.test(text)) {
    location = "gym";
    text = text.replace(/\s*[-–—]\s*gym\s*$/i, "").replace(/\s*\(gym\)\s*$/i, "");
  }

  return { location, text: text.trim() };
}

/** Parse day/location/title from pasted title or first line (e.g. "Day 3 Upper Body - Home"). */
export function parseUploadCycleTarget(input: string): UploadCycleTarget {
  let text = String(input || "").trim();
  let cycleDay: number | null = null;
  let cycleMonth: number | null = null;

  const md = text.match(/^m(\d+)d(\d+)\s*[-–—:·]\s*/i);
  if (md) {
    cycleMonth = Math.max(1, parseInt(md[1], 10));
    cycleDay = Math.min(28, Math.max(1, parseInt(md[2], 10)));
    text = text.slice(md[0].length).trim();
  } else {
    const cycleKey = text.match(/^(m\d+d\d+)\s*[-–—:·]\s*/i);
    if (cycleKey) {
      const parsed = parseCycleDayKey(cycleKey[1]);
      if (parsed) {
        cycleMonth = parsed.cycleMonth;
        cycleDay = parsed.cycleDay;
        text = text.slice(cycleKey[0].length).trim();
      }
    }
  }

  if (cycleDay == null) {
    const dayLead = text.match(/^day\s*(\d{1,2})\s*[-–—:·]\s*/i);
    if (dayLead) {
      const n = parseInt(dayLead[1], 10);
      if (n >= 1 && n <= 28) cycleDay = n;
      text = text.slice(dayLead[0].length).trim();
    } else {
      const dayOnly = text.match(/^day\s*(\d{1,2})\b\s+/i);
      if (dayOnly) {
        const n = parseInt(dayOnly[1], 10);
        if (n >= 1 && n <= 28) cycleDay = n;
        text = text.replace(/^day\s*\d{1,2}\b\s+/i, "").trim();
      }
    }
  }

  const { location, text: afterLoc } = stripLocationHints(text);
  const contentTitle =
    stripLocationSuffixFromWorkoutName(stripDayPrefixFromWorkoutName(afterLoc)) || afterLoc || "Workout";

  return {
    cycleDay,
    cycleMonth,
    trainingLocation: location,
    contentTitle,
  };
}

export function detectUploadTargetFromPaste(
  workoutName: string,
  rawText: string,
): UploadCycleTarget {
  const firstLine = rawText.split("\n").map((l) => l.trim()).find(Boolean) || "";
  const fromName = parseUploadCycleTarget(workoutName);
  if (fromName.cycleDay != null) return fromName;
  return parseUploadCycleTarget(firstLine);
}