/**
 * Who Jeremy means for a special class (not the whole roster).
 * Demo IDs (`demo-user-john-steph`) are not prod members.
 */
export const JOHN_STEPH_CLASS_EMAILS = [
  "john@lemonvoice.com",
  "sprealty9@gmail.com",
] as const;

export const CHAD_KAITE_CLASS_EMAILS = [
  "chad@thetrainstation.co",
  "kaite@thetrainstation.co",
] as const;

export type ClassTargetMember = {
  id: string;
  email?: string | null;
};

function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

export function memberIdsForEmails(
  members: ClassTargetMember[],
  emails: readonly string[],
): string[] {
  const want = new Set(emails.map((e) => normalizeEmail(e)).filter(Boolean));
  if (want.size === 0) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    const email = normalizeEmail(member.email);
    if (!email || !want.has(email) || seen.has(member.id)) continue;
    seen.add(member.id);
    ids.push(member.id);
  }
  return ids;
}

export function memberChipLabel(
  member: { name: string; email?: string | null },
  roster: Array<{ name: string }>,
): string {
  const first = member.name.trim().split(/\s+/)[0] || member.name;
  const firstDup =
    roster.filter((m) => (m.name.trim().split(/\s+/)[0] || m.name) === first).length > 1;
  if (member.email && (firstDup || /john/i.test(member.name))) {
    return `${member.name} · ${member.email}`;
  }
  return member.name;
}
