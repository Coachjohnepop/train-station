import "server-only";

import type { ChatThread } from "@/lib/coach-chat";
import type { DemoUserEntry } from "@/lib/demo-user-directory";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import { listCoachRosterMembers } from "@/lib/coach-roster";

export type CoachChatMemberEntry = DemoUserEntry & { isRegistered?: boolean };

function entryKey(e: { id: string; email: string }): string {
  return e.email ? `${e.id}::${e.email.toLowerCase()}` : e.id;
}

/** Demo roster + real ticket signups (e.g. Katie) + any member threads without a roster row. */
export async function listCoachChatMembers(
  threads: ChatThread[] = [],
): Promise<CoachChatMemberEntry[]> {
  const byKey = new Map<string, CoachChatMemberEntry>();

  const roster = await listCoachRosterMembers();
  for (const member of roster) {
    const row: CoachChatMemberEntry = {
      id: member.id,
      email: member.email,
      name: member.name,
      phone: member.phone,
      isRegistered: true,
    };
    byKey.set(entryKey(row), row);
  }

  for (const thread of threads) {
    if (thread.kind !== "member" || !thread.memberId) continue;
    const existing = [...byKey.values()].find((m) => m.id === thread.memberId);
    if (existing) continue;

    const account = await getAccountByUserId(thread.memberId);
    const row: CoachChatMemberEntry = {
      id: thread.memberId,
      email: account?.email || "",
      name: account?.account.name || thread.title || "Member",
      phone: account?.account.phone ?? null,
      isRegistered: Boolean(account),
    };
    byKey.set(entryKey(row), row);
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}