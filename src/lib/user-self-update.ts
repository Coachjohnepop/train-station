import "server-only";

import { hashPassword } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth-session";
import { isDemoMode } from "@/lib/demo-enrollments";
import { updateDemoUserSettings } from "@/lib/demo-reminders";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { upsertSignInAccount } from "@/lib/member-accounts-store";
import { prisma } from "@/lib/prisma";
import { pickSelfProfilePatch } from "@/lib/users-admin-session";

type SelfPatch = {
  name?: string;
  phone?: string | null;
  dailyReminderTime?: string | null;
  password?: string;
};

export async function applySelfProfileUpdate(
  session: SessionUser,
  userId: string,
  raw: SelfPatch,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const patch = pickSelfProfilePatch(raw) as SelfPatch;
  if (Object.keys(patch).length === 0) {
    return { ok: false, detail: "No profile fields to update." };
  }

  if (isDemoMode()) {
    const directory = resolveDemoUser(userId);
    const email = directory?.email ?? session.email;

    if (patch.phone !== undefined || patch.dailyReminderTime !== undefined) {
      updateDemoUserSettings(userId, {
        phone: patch.phone ?? null,
        dailyReminderTime: patch.dailyReminderTime ?? null,
      });
    }

    if (patch.name || patch.password || patch.phone !== undefined) {
      await upsertSignInAccount({
        email,
        userId,
        role: session.role,
        name: patch.name?.trim() || session.name,
        phone: patch.phone !== undefined ? patch.phone : undefined,
        passwordHash: patch.password ? hashPassword(patch.password) : undefined,
      });
    }

    return { ok: true };
  }

  try {
    const data: {
      name?: string;
      phone?: string | null;
      dailyReminderTime?: string | null;
      passwordHash?: string;
    } = {};

    if (patch.name) data.name = patch.name.trim();
    if (patch.phone !== undefined) data.phone = patch.phone;
    if (patch.dailyReminderTime !== undefined) data.dailyReminderTime = patch.dailyReminderTime;
    if (patch.password) data.passwordHash = hashPassword(patch.password);

    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    if (patch.password) {
      await upsertSignInAccount({
        email: user.email,
        userId: user.id,
        role: user.role as SessionUser["role"],
        name: user.name || user.email.split("@")[0],
        phone: user.phone,
        passwordHash: data.passwordHash,
      });
    }

    return { ok: true };
  } catch {
    return { ok: false, detail: "Profile update failed." };
  }
}