import "server-only";

import { adminManagedUserToRow, listAdminManagedUsers } from "@/lib/admin-managed-users";
import { normalizeAccountEmail } from "@/lib/account-email";
import { getDemoEnrollments, isDemoMode } from "@/lib/demo-enrollments";
import { isDemoSeedUserHidden } from "@/lib/demo-hidden-users";
import {
  getDemoPerformanceCount,
  getDemoStrengthScore,
  getDemoWorkoutLogCount,
} from "@/lib/demo-logs";
import { getDemoUserSettings, hydrateDemoUserSettings } from "@/lib/demo-reminders";
import { resolveDemoUser, resolveDemoUserByEmail } from "@/lib/demo-user-directory";
import { DEMO_USER_DIRECTORY } from "@/lib/demo-user-directory";
import { getAccountByEmail, getAllSignInAccounts } from "@/lib/member-accounts-store";

type DemoUserRow = Record<string, unknown>;

const SEED_DEMO_IDS = new Set(DEMO_USER_DIRECTORY.map((u) => u.id));

const SEED_NOTES: Record<string, string> = {
  "demo-user-john-steph":
    "Test account — John & Steph (primary demo couple). Safe to edit phone/reminder.",
  "demo-user": "Test account — Alex (demo member for Coach Jeremy).",
  "demo-user-john": "Test account — Chad.",
  "demo-user-stephanie": "Test account — Katie. Edit phone here for SMS reminders.",
  "demo-user-2": "Test account — Jordan Lee.",
  "demo-user-3": "Test account — Casey (no phone yet; broadcast filter testing).",
  "demo-coach-jeremy": "Primary coach — roster: John & Steph, Chad, Kaite, Alex, Jordan.",
  "demo-coach-john": "Site admin — sign in at /login with this email.",
};

const SEED_SUBSCRIPTION: Record<string, { tier: string; status: string } | null> = {
  "demo-user-john-steph": { tier: "first_class", status: "active" },
  "demo-user": { tier: "first_class", status: "active" },
  "demo-user-john": { tier: "first_class", status: "active" },
  "demo-user-stephanie": { tier: "first_class", status: "active" },
  "demo-user-2": { tier: "coach", status: "active" },
};

function demoCountsForUser(userId: string): {
  enrollments: number;
  performances: number;
  workoutLogs: number;
  strengthScore: number;
} {
  const enrollments = Object.keys(getDemoEnrollments(userId)).length;
  if (userId === "demo-user") {
    return {
      enrollments,
      performances: getDemoPerformanceCount(),
      workoutLogs: getDemoWorkoutLogCount(),
      strengthScore: getDemoStrengthScore(),
    };
  }
  return { enrollments, performances: 0, workoutLogs: 0, strengthScore: 0 };
}

/** Every sign-in account (seed + registered + admin-managed), for admin Users. */
export async function listDemoUsersForAdmin(options?: {
  includeHidden?: boolean;
}): Promise<DemoUserRow[]> {
  if (!isDemoMode()) return [];

  await hydrateDemoUserSettings();

  const includeHidden = options?.includeHidden ?? true;
  const accounts = await getAllSignInAccounts();
  const managed = await listAdminManagedUsers({ includeHidden: true });
  const managedByEmail = new Map(managed.map((u) => [u.email.toLowerCase(), u]));

  const rows: DemoUserRow[] = [];
  const seenEmails = new Set<string>();

  for (const entry of DEMO_USER_DIRECTORY) {
    if (!accounts[entry.email] && !managedByEmail.has(entry.email.toLowerCase())) {
      accounts[entry.email] = {
        userId: entry.id,
        role: "MEMBER",
        name: entry.name,
        phone: entry.phone ?? undefined,
      };
    }
  }

  for (const [rawEmail, account] of Object.entries(accounts)) {
    const email = normalizeAccountEmail(rawEmail) || rawEmail;
    const key = email.toLowerCase();
    if (seenEmails.has(key)) continue;
    seenEmails.add(key);

    const managedUser = managedByEmail.get(key);
    if (managedUser) {
      rows.push({ ...adminManagedUserToRow(managedUser), source: "managed" });
      continue;
    }

    const directory = resolveDemoUserByEmail(email) || resolveDemoUser(account.userId);
    const settings = getDemoUserSettings(account.userId);
    const registered = await getAccountByEmail(email);
    const hidden =
      Boolean(registered?.hidden) || (await isDemoSeedUserHidden(account.userId));
    const counts = demoCountsForUser(account.userId);

    rows.push({
      id: account.userId,
      email,
      name: account.name || directory?.name || email.split("@")[0],
      role: account.role,
      status: "active",
      notes: SEED_NOTES[account.userId] ?? null,
      phone: account.phone || directory?.phone || settings.phone || null,
      dailyReminderTime: settings.dailyReminderTime || null,
      hidden,
      hiddenAt: null,
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      subscription: SEED_SUBSCRIPTION[account.userId] ?? null,
      counts: {
        enrollments: counts.enrollments,
        performances: counts.performances,
        workoutLogs: counts.workoutLogs,
      },
      strengthScore: counts.strengthScore,
      source: SEED_DEMO_IDS.has(account.userId) ? "seed" : "sign-in",
    });
  }

  const sorted = rows.sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  );

  return includeHidden ? sorted : sorted.filter((u) => !u.hidden);
}

export async function findDemoUserRow(
  id: string,
  email: string,
): Promise<DemoUserRow | null> {
  const all = await listDemoUsersForAdmin({ includeHidden: true });
  const normalized = email.toLowerCase();
  return (
    all.find(
      (u) => u.id === id || String(u.email || "").toLowerCase() === normalized,
    ) ?? null
  );
}