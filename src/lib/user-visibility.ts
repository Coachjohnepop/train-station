import "server-only";

import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";
import {
  hideAdminManagedUser,
  unhideAdminManagedUser,
} from "@/lib/admin-managed-users";
import {
  hideDemoSeedUser,
  unhideDemoSeedUser,
} from "@/lib/demo-hidden-users";
import { setSignInAccountHidden } from "@/lib/member-accounts-store";

export type HideUserResult =
  | { ok: true; mode: "db" | "managed" | "seed" }
  | { ok: false; reason: "not_found" | "forbidden" };

export async function hideUserById(id: string): Promise<HideUserResult> {
  if (isDemoMode()) {
    const managed = await hideAdminManagedUser(id);
    if (managed) return { ok: true, mode: "managed" };

    const seedIds = new Set([
      "demo-user-john-steph",
      "demo-user",
      "demo-user-john",
      "demo-user-stephanie",
      "demo-user-2",
      "demo-user-3",
      "demo-coach-jeremy",
      "demo-coach-john",
    ]);
    if (seedIds.has(id)) {
      await hideDemoSeedUser(id);
      return { ok: true, mode: "seed" };
    }

    return { ok: false, reason: "not_found" };
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { hidden: true, hiddenAt: new Date() },
    });
    await setSignInAccountHidden(user.email, true);
    return { ok: true, mode: "db" };
  } catch {
    return { ok: false, reason: "not_found" };
  }
}

export async function unhideUserById(id: string): Promise<HideUserResult> {
  if (isDemoMode()) {
    const managed = await unhideAdminManagedUser(id);
    if (managed) return { ok: true, mode: "managed" };

    if (await unhideDemoSeedUser(id)) return { ok: true, mode: "seed" };
    return { ok: false, reason: "not_found" };
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { hidden: false, hiddenAt: null },
    });
    await setSignInAccountHidden(user.email, false);
    return { ok: true, mode: "db" };
  } catch {
    return { ok: false, reason: "not_found" };
  }
}