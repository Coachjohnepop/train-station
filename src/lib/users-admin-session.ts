import "server-only";

import { normalizeAccountEmail } from "@/lib/account-email";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth-session";
import { findDemoUserRow, listDemoUsersForAdmin } from "@/lib/demo-users-admin";
import { isDemoMode } from "@/lib/demo-enrollments";
import { prisma } from "@/lib/prisma";

export type AdminUserRow = Record<string, unknown>;

export const SELF_PROFILE_FIELDS = ["name", "phone", "dailyReminderTime", "password"] as const;

export function isSelfUserRow(session: SessionUser | null, row: AdminUserRow): boolean {
  if (!session) return false;
  const email = String(row.email || "").toLowerCase();
  return row.id === session.id || email === session.email.toLowerCase();
}

export function pickSelfProfilePatch<T extends Record<string, unknown>>(data: T): Partial<T> {
  const picked: Partial<T> = {};
  for (const key of SELF_PROFILE_FIELDS) {
    if (data[key] !== undefined) picked[key as keyof T] = data[key as keyof T];
  }
  return picked;
}

async function buildDbUserRow(session: SessionUser): Promise<AdminUserRow | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: {
        subscriptions: { include: { tier: true }, orderBy: { id: "desc" }, take: 1 },
        _count: { select: { enrollments: true, performances: true, workoutLogs: true } },
      },
    });
    if (!user) {
      const byEmail = await prisma.user.findUnique({
        where: { email: normalizeAccountEmail(session.email) || session.email },
        include: {
          subscriptions: { include: { tier: true }, orderBy: { id: "desc" }, take: 1 },
          _count: { select: { enrollments: true, performances: true, workoutLogs: true } },
        },
      });
      if (!byEmail) return null;
      return mapDbUser(byEmail);
    }
    return mapDbUser(user);
  } catch {
    return null;
  }
}

function mapDbUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  notes: string | null;
  phone: string | null;
  dailyReminderTime: string | null;
  hidden: boolean;
  hiddenAt: Date | null;
  createdAt: Date;
  subscriptions: Array<{ tier: { slug: string }; status: string }>;
  _count: { enrollments: number; performances: number; workoutLogs: number };
}): AdminUserRow {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    notes: user.notes,
    phone: user.phone,
    dailyReminderTime: user.dailyReminderTime,
    hidden: user.hidden,
    hiddenAt: user.hiddenAt,
    createdAt: user.createdAt,
    subscription: user.subscriptions[0]
      ? { tier: user.subscriptions[0].tier.slug, status: user.subscriptions[0].status }
      : null,
    counts: user._count,
  };
}

async function buildSessionUserRow(session: SessionUser): Promise<AdminUserRow | null> {
  if (isDemoMode()) {
    return findDemoUserRow(session.id, session.email);
  }
  return buildDbUserRow(session);
}

/** Staff always see their own row, even when hidden or filtered out. */
export async function annotateAdminUsersForSession(
  users: AdminUserRow[],
  options?: { session?: SessionUser | null },
): Promise<AdminUserRow[]> {
  const session = options?.session ?? (await getSessionUser());
  if (!session || !isStaffRole(session.role)) {
    return users.map((u) => ({ ...u, isSelf: false }));
  }

  let list: AdminUserRow[] = users.map((u) => ({
    ...u,
    isSelf: isSelfUserRow(session, u),
  }));

  if (!list.some((u) => u.isSelf)) {
    const selfRow = await buildSessionUserRow(session);
    if (selfRow) {
      list = [{ ...selfRow, isSelf: true, hidden: false }, ...list];
    }
  } else {
    list = list.map((u) =>
      u.isSelf ? { ...u, hidden: false } : u,
    );
  }

  const self = list.find((u) => u.isSelf);
  if (self) {
    const rest = list.filter((u) => !u.isSelf);
    list = [self, ...rest];
  }

  return list;
}

export async function getAdminSession(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function isSelfUserId(session: SessionUser, userId: string): Promise<boolean> {
  if (session.id === userId) return true;

  if (isDemoMode()) {
    const all = await listDemoUsersForAdmin({ includeHidden: true });
    const row = all.find((u) => u.id === userId);
    return Boolean(
      row && String(row.email || "").toLowerCase() === session.email.toLowerCase(),
    );
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return Boolean(
      user && user.email.toLowerCase() === session.email.toLowerCase(),
    );
  } catch {
    return false;
  }
}