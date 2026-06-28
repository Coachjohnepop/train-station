import "server-only";

import type { ChatThread } from "@/lib/coach-chat";
import { listMembersForCoach } from "@/lib/demo-coach";
import type { DemoUserEntry } from "@/lib/demo-user-directory";
import { getAccountByUserId, listSelfRegisteredAccounts } from "@/lib/member-accounts-store";

export type CoachChatMemberEntry = DemoUserEntry & { isRegistered?: boolean };

function entryKey(e: { id: string; email: string }): string {
  return e.email ? `${e.id}::${e.email.toLowerCase()}` : e.id;
}

/** Demo roster + real ticket signups (e.g. Katie) + any member threads without a roster row. */
export async function listCoachChatMembers(
  threads: ChatThread[] = [],
): Promise<CoachChatMemberEntry[]> {
  const byKey = new Map<string, CoachChatMemberEntry>();

  for (const demo of listMembersForCoach()) {
    byKey.set(entryKey(demo), { ...demo });
  }

  const registered = await listSelfRegisteredAccounts();
  for (const { email, account } of registered) {
    if (account.hidden || account.role !== "MEMBER") continue;
    const row: CoachChatMemberEntry = {
      id: account.userId,
      email,
      name: account.name || email,
      phone: account.phone ?? null,
      isRegistered: true,
    };
    const key = entryKey(row);
    if (!byKey.has(key)) byKey.set(key, row);
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

  const registeredRows = [...byKey.values()].filter((m) => m.isRegistered);
  const demoRows = [...byKey.values()].filter((m) => !m.isRegistered);
  registeredRows.sort((a, b) => a.name.localeCompare(b.name));
  return [...registeredRows, ...demoRows];
}