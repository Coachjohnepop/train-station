import { parseCycleDayKey } from "@/lib/program-cycle-day";

export type ParsedWeekDaySlot = {
  dayNumber: number;
  label: string;
  workoutName: string;
  cycleMonth?: number;
  cycleDay?: number;
};

function resolveDayNumber(
  cycleMonth: number | undefined,
  cycleDay: number | undefined,
  fallbackDay: number,
): number {
  if (cycleMonth != null && cycleDay != null) {
    const linear = (cycleMonth - 1) * 28 + cycleDay;
    return ((linear - 1) % 7) + 1;
  }
  return fallbackDay;
}

export function parseProgramWeekText(rawText: string): {
  slots: ParsedWeekDaySlot[];
  warnings: string[];
} {
  const slots: ParsedWeekDaySlot[] = [];
  const warnings: string[] = [];

  for (const raw of rawText.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const cycleMatch = line.match(/^m(\d+)d(\d+)\s*[-:|\s]+\s*(\w+)\s*[-:]\s*(.+)$/i);
    if (cycleMatch) {
      const cycleMonth = parseInt(cycleMatch[1], 10);
      const cycleDay = parseInt(cycleMatch[2], 10);
      const label = cycleMatch[3].charAt(0).toUpperCase() + cycleMatch[3].slice(1).toLowerCase();
      const workoutName = cycleMatch[4].trim();
      if (cycleMonth >= 1 && cycleDay >= 1 && cycleDay <= 28 && workoutName) {
        slots.push({
          dayNumber: resolveDayNumber(cycleMonth, cycleDay, 1),
          label,
          workoutName,
          cycleMonth,
          cycleDay,
        });
        continue;
      }
    }

    const patterns: RegExp[] = [
      /^day\s*(\d+)\s*[-:|\s]+\s*(\w+)\s*[-:]\s*(.+)$/i,
      /^(\d+)\s+(\w+)\s*:\s*(.+)$/i,
      /^d(\d+)\s*[-|]\s*(\w+)\s*[-|]\s*(.+)$/i,
      /^(\d+)\s*[-|]\s*(\w+)\s*[-|]\s*(.+)$/i,
    ];

    let matched = false;
    for (const re of patterns) {
      const m = line.match(re);
      if (!m) continue;
      const dayNumber = parseInt(m[1], 10);
      const label = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase();
      const workoutName = m[3].trim();
      if (dayNumber >= 1 && dayNumber <= 7 && workoutName) {
        const cycle = parseCycleDayKey(`M1D${dayNumber}`);
        slots.push({
          dayNumber,
          label,
          workoutName,
          cycleMonth: cycle?.cycleMonth,
          cycleDay: cycle?.cycleDay,
        });
        matched = true;
      }
      break;
    }

    if (!matched) {
      warnings.push(`Could not parse: "${line}"`);
    }
  }

  return { slots, warnings };
}