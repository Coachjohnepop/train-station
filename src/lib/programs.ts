export type CatalogStatus = "live" | "coming_soon" | "hidden";

export type CatalogProgramDef = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  category: "workout" | "yoga" | "journey" | "eating";
  catalogStatus: CatalogStatus;
};

/** Jeremy's program catalog — source of truth for names and visibility. */
export const TOP_LEVEL_PROGRAMS: CatalogProgramDef[] = [
  {
    slug: "adult",
    name: "Adult Strength Conditioning",
    description:
      "General fitness and strength for adults — Gym and Home tracks every day.",
    sortOrder: 1,
    category: "workout",
    catalogStatus: "live",
  },
  {
    slug: "strength-training",
    name: "Athletes — Speed, Strength & Conditioning",
    description:
      "Structured speed, strength, and conditioning for competitive athletes.",
    sortOrder: 2,
    category: "workout",
    catalogStatus: "live",
  },
  {
    slug: "boot-camp-preparation",
    name: "Military Preparation",
    description:
      "Conditioning and resilience work to prepare for military service.",
    sortOrder: 3,
    category: "workout",
    catalogStatus: "live",
  },
  {
    slug: "mom-dads-little-time",
    name: "Mom & Dads with Little Time",
    description:
      "Efficient strength training for busy parents — short sessions that fit real life.",
    sortOrder: 4,
    category: "workout",
    catalogStatus: "live",
  },
  {
    slug: "youth-sports",
    name: "Adolescent Training",
    description:
      "Age-appropriate athletic development for adolescent athletes.",
    sortOrder: 5,
    category: "workout",
    catalogStatus: "coming_soon",
  },
];

/** Legacy / deprioritized slugs — hidden from member and admin program lists. */
export const HIDDEN_PROGRAM_SLUGS = new Set([
  "combat-training",
  "yoga-channel",
  "john-steph",
  "muscle-max",
  "weight-loss",
  "gracefully-age",
]);

const CATALOG_BY_SLUG = Object.fromEntries(
  TOP_LEVEL_PROGRAMS.map((p) => [p.slug, p]),
) as Record<string, CatalogProgramDef>;

/** Old seed/blob slugs mapped to the current catalog slug. */
export const LEGACY_PROGRAM_SLUG_ALIASES: Record<string, string> = {
  "gracefully-age": "mom-dads-little-time",
};

export function normalizeProgramSlug(slug: string): string {
  return LEGACY_PROGRAM_SLUG_ALIASES[slug] ?? slug;
}

export function getCatalogStatus(slug: string): CatalogStatus {
  return CATALOG_BY_SLUG[normalizeProgramSlug(slug)]?.catalogStatus ?? "hidden";
}

export function getCatalogProgramDef(slug: string): CatalogProgramDef | null {
  return CATALOG_BY_SLUG[normalizeProgramSlug(slug)] ?? null;
}

/** Apply Jeremy catalog names/descriptions over seed rows (slug is the key). */
export function applyCatalogMetadata<T extends { slug: string; name?: string; description?: string | null; category?: string | null }>(
  program: T,
): T & { catalogStatus: CatalogStatus } {
  const canonicalSlug = normalizeProgramSlug(program.slug);
  const def = getCatalogProgramDef(canonicalSlug);
  const catalogStatus = getCatalogStatus(canonicalSlug);
  if (!def) return { ...program, slug: canonicalSlug, catalogStatus };
  return {
    ...program,
    slug: canonicalSlug,
    name: def.name,
    description: def.description,
    category: def.category,
    catalogStatus,
  };
}

export function filterMemberCatalogPrograms<T extends { slug: string }>(programs: T[]): T[] {
  return programs.filter((p) => {
    const status = getCatalogStatus(p.slug);
    return status === "live" || status === "coming_soon";
  });
}

export function filterAdminCatalogPrograms<T extends { slug: string }>(programs: T[]): T[] {
  return programs.filter((p) => getCatalogStatus(p.slug) !== "hidden");
}

/** QA, smoke, and sprint-test workouts — hidden from admin lists and safe to purge. */
export function isJunkWorkoutName(name: string): boolean {
  const n = String(name || "").trim();
  const lower = n.toLowerCase();

  if (/\bqa\b/.test(lower) || /\bqa[-_]/.test(lower) || /\bsmoke\b/.test(lower)) {
    return true;
  }
  if (/^s1b-workout/i.test(n)) return true;
  if (/^s2-\d+/i.test(n)) return true;
  if (/^s1c-/i.test(n)) return true;
  if (/^s1d-\d+/i.test(n)) return true; // leaked session/tech ids (S1D-timestamp …)
  if (/^s34-/i.test(n)) return true;
  if (/copy-week/i.test(n)) return true;
  if (/^gym$/i.test(n)) return true;
  if (/day test showing/i.test(n)) return true;
  if (/^adult strength conditioning ·/i.test(n)) return true;
  if (/^totally fake/i.test(n)) return true;
  if (/^qa workout/i.test(n)) return true;

  return false;
}

/** @deprecated Use isJunkWorkoutName — kept for callers that only checked QA/smoke. */
export function isHiddenWorkoutName(name: string): boolean {
  return isJunkWorkoutName(name);
}

export function filterVisibleWorkouts<T extends { name: string }>(workouts: T[]): T[] {
  return workouts.filter((w) => !isHiddenWorkoutName(w.name));
}