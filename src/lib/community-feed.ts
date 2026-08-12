import { TOP_LEVEL_PROGRAMS, type CatalogProgramDef } from "@/lib/programs";

/**
 * Station-wide community (every member sees this group tab).
 * New posts targeted at “Everyone” use this slug.
 */
export const STATION_COMMUNITY_SLUG = "station";
export const STATION_COMMUNITY_TITLE = "Train Station · Everyone";

/**
 * Legacy station-wide feed slug (historical posts). Still shown to all members
 * so older community messages stay visible.
 */
export const COMMUNITY_FEED_PROGRAM_SLUG = "adult";
export const COMMUNITY_FEED_TITLE = "Train Station community";

/** Shown in coach/member UI — community is in-app only, not SMS/email blast. */
export const COMMUNITY_NO_BROADCAST_NOTE =
  "In-app feed only — badges for enrolled members (or everyone for station-wide).";

/** Programs coaches can target for program-scoped community posts. */
export function communityProgramTargets(): Array<{ slug: string; name: string }> {
  return TOP_LEVEL_PROGRAMS.filter(
    (p: CatalogProgramDef) => p.catalogStatus === "live" || p.catalogStatus === "coming_soon",
  ).map((p) => ({ slug: p.slug, name: p.name }));
}

export function cohortTitleForSlug(slug: string): string {
  if (slug === STATION_COMMUNITY_SLUG) return STATION_COMMUNITY_TITLE;
  if (slug === COMMUNITY_FEED_PROGRAM_SLUG) return COMMUNITY_FEED_TITLE;
  const hit = TOP_LEVEL_PROGRAMS.find((p) => p.slug === slug);
  return hit ? `${hit.name} · Group` : `${slug} · Group`;
}

/**
 * @deprecated Member Messages no longer auto-show these groups.
 * Kept for coach compose targets / historical callers. Visibility is enrollment-only
 * via `resolveMemberVisibleCohortSlugs` (see member-chat-access.ts).
 */
export function alwaysOnCommunitySlugs(): string[] {
  return [STATION_COMMUNITY_SLUG, COMMUNITY_FEED_PROGRAM_SLUG];
}
