/** Coach-facing D&D-style member card (15-minute intro / intake). */
export function memberCardPath(userId: string): string {
  return `/admin/members/${encodeURIComponent(userId)}`;
}
