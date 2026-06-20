export type ParsedWeekDaySlot = {
  dayNumber: number;
  label: string;
  workoutName: string;
};

export function parseProgramWeekText(rawText: string): {
  slots: ParsedWeekDaySlot[];
  warnings: string[];
} {
  const slots: ParsedWeekDaySlot[] = [];
  const warnings: string[] = [];

  for (const raw of rawText.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

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
        slots.push({ dayNumber, label, workoutName });
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