export type ParsedExerciseLine = {
  name: string;
  tags?: string;
  description?: string;
};

export function parseExerciseList(rawText: string): { exercises: ParsedExerciseLine[] } {
  const exercises: ParsedExerciseLine[] = [];

  for (const raw of rawText.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const cleaned = line.replace(/^[-*•]\s+/, "").trim();
    if (!cleaned) continue;

    if (cleaned.includes("|")) {
      const [name, ...rest] = cleaned.split("|").map((p) => p.trim());
      if (name) exercises.push({ name, tags: rest.join(", ") || undefined });
      continue;
    }

    const commaIdx = cleaned.indexOf(",");
    if (commaIdx > 0 && commaIdx < cleaned.length - 1) {
      const name = cleaned.slice(0, commaIdx).trim();
      const tags = cleaned.slice(commaIdx + 1).trim();
      if (name) exercises.push({ name, tags: tags || undefined });
      continue;
    }

    exercises.push({ name: cleaned });
  }

  return { exercises };
}