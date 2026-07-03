import "server-only";

import { DEMO_USER_DIRECTORY, resolveDemoUser, resolveDemoUserByEmail } from "@/lib/demo-user-directory";

const SEED_NOTES: Record<string, string> = {
  "demo-user-john-steph":
    "Test account — John & Steph (primary demo couple). Safe to edit phone/reminder.",
  "demo-user": "Test account — Alex (demo member for Coach Jeremy).",
  "demo-user-john": "Test account — Chad.",
  "demo-user-stephanie": "Test account — Katie. Edit phone here for SMS reminders.",
  "demo-user-2": "Test account — Jordan Lee.",
  "demo-user-3": "Test account — Casey (no phone yet; broadcast filter testing).",
};

const SEED_EMAILS = new Map(
  DEMO_USER_DIRECTORY.filter((e) => !e.id.includes("coach")).map((e) => [e.email.toLowerCase(), e]),
);

export type AdminUserListRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  notes: string | null;
  phone: string | null;
  dailyReminderTime: string | null;
  hidden?: boolean;
  hiddenAt?: Date | string | null;
  createdAt: Date | string;
  subscription: { tier: string; status: string } | null;
  counts: { enrollments: number; performances: number; workoutLogs: number };
  strengthScore?: number;
  source?: "seed" | "sign-in" | "managed";
};

export function annotatePrismaUserRow<T extends AdminUserListRow>(row: T): T {
  const demo = SEED_EMAILS.get(row.email.toLowerCase());
  if (!demo) {
    return { ...row, source: row.source ?? "sign-in" };
  }
  return {
    ...row,
    source: "seed",
    notes: row.notes || SEED_NOTES[demo.id] || null,
  };
}

export async function resolvePrismaUserIdForAdmin(userId: string): Promise<string | null> {
  const { resolveStorageUserId } = await import("@/lib/enrollment-db");
  const { prisma } = await import("@/lib/prisma");

  const storageId = await resolveStorageUserId(userId);
  const direct = await prisma.user.findUnique({ where: { id: storageId }, select: { id: true } });
  if (direct) return direct.id;

  const demo = resolveDemoUser(userId);
  if (demo) {
    const byEmail = await prisma.user.findUnique({
      where: { email: demo.email },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  const byEmailOnly = resolveDemoUserByEmail(userId);
  if (byEmailOnly) {
    const byEmail = await prisma.user.findUnique({
      where: { email: byEmailOnly.email },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  return null;
}