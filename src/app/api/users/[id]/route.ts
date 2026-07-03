import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  adminManagedUserToRow,
  getAdminManagedUser,
  updateAdminManagedUser,
} from "@/lib/admin-managed-users";

import { isDemoMode } from "@/lib/demo-enrollments";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { updateDemoUserSettings } from "@/lib/demo-reminders";
import { findDemoUserRow } from "@/lib/demo-users-admin";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { getAllSignInAccounts, upsertSignInAccount } from "@/lib/member-accounts-store";
import { applySelfProfileUpdate } from "@/lib/user-self-update";
import { hideUserById, unhideUserById } from "@/lib/user-visibility";
import {
  getAdminSession,
  isSelfUserId,
  pickCoachContactPatch,
  pickSelfProfilePatch,
} from "@/lib/users-admin-session";
import {
  annotatePrismaUserRow,
  resolvePrismaUserIdForAdmin,
} from "@/lib/users-admin-annotations";
import { canAccessPlatformAdmin } from "@/lib/staff-access";
import { assertUserScope, requireCoachStaff, requirePlatformStaff, requireSession } from "@/lib/api-auth";

const ROLES = ["ADMIN", "INSTRUCTOR", "PLATFORM_ADMIN", "MEMBER", "PROSPECTIVE_INSTRUCTOR"] as const;

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  dailyReminderTime: z.string().optional().nullable(),
  hidden: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const scope = assertUserScope(auth.session, id);
  if (scope) {
    const staff = await requirePlatformStaff();
    if (!staff.ok) return staff.response;
  }

  if (isDemoMode()) {
    const managed = await getAdminManagedUser(id);
    if (managed) return NextResponse.json(adminManagedUserToRow(managed));

    const directory = resolveDemoUser(id);
    if (directory) {
      const accounts = await getAllSignInAccounts();
      const account = accounts[directory.email];
      return NextResponse.json({
        id: directory.id,
        email: directory.email,
        name: directory.name,
        role: account?.role ?? "MEMBER",
        phone: directory.phone ?? null,
      });
    }

    return NextResponse.json({ detail: "User not found" }, { status: 404 });
  }

  const prismaUserId = await resolvePrismaUserIdForAdmin(id);
  if (!prismaUserId) {
    return NextResponse.json({ detail: "User not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: prismaUserId },
    include: {
      subscriptions: { include: { tier: true }, orderBy: { id: "desc" }, take: 1 },
      enrollments: { include: { program: true }, orderBy: { startedAt: "desc" }, take: 5 },
      workoutLogs: { orderBy: { performedAt: "desc" }, take: 5 },
      _count: { select: { enrollments: true, performances: true, workoutLogs: true } },
    },
  });
  if (!user) return NextResponse.json({ detail: "User not found" }, { status: 404 });

  return NextResponse.json(
    annotatePrismaUserRow({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      notes: user.notes,
      phone: user.phone || null,
      dailyReminderTime: user.dailyReminderTime || null,
      hidden: user.hidden,
      hiddenAt: user.hiddenAt,
      createdAt: user.createdAt,
      subscription: user.subscriptions[0]
        ? { tier: user.subscriptions[0].tier.slug, status: user.subscriptions[0].status }
        : null,
      counts: user._count,
    }),
  );
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const session = auth.session;
  const isSelf = await isSelfUserId(session, id);

  if (isSelf && parsed.data.hidden === true) {
    return NextResponse.json(
      { detail: "You cannot hide your own account while logged in." },
      { status: 403 },
    );
  }

  if (isSelf) {
    const selfPatch = pickSelfProfilePatch(parsed.data);
    const hasAdminFields =
      parsed.data.role !== undefined ||
      parsed.data.status !== undefined ||
      parsed.data.notes !== undefined ||
      parsed.data.hidden !== undefined;

    if (hasAdminFields && Object.keys(selfPatch).length === 0) {
      return NextResponse.json(
        { detail: "You can only update your profile (name, phone, reminder, password) on your own row." },
        { status: 403 },
      );
    }

    if (Object.keys(selfPatch).length > 0) {
      const result = await applySelfProfileUpdate(session!, id, selfPatch);
      if (!result.ok) {
        return NextResponse.json({ detail: result.detail }, { status: 400 });
      }
      if (isDemoMode()) {
        const row = await findDemoUserRow(session!.id, session!.email);
        if (row) return NextResponse.json({ ...row, isSelf: true });
      } else {
        try {
          const user = await prisma.user.findUnique({ where: { id } });
          if (user) return NextResponse.json({ ...user, isSelf: true });
        } catch {}
      }
      return NextResponse.json({ id, ok: true, isSelf: true });
    }

    if (hasAdminFields) {
      return NextResponse.json(
        { detail: "You can only update your profile (name, phone, reminder, password) on your own row." },
        { status: 403 },
      );
    }
  }

  if (!isSelf) {
    const staff = await requireCoachStaff();
    if (!staff.ok) return staff.response;
  }

  if (parsed.data.hidden !== undefined) {
    const platform = await requirePlatformStaff();
    if (!platform.ok) return platform.response;

    const result = parsed.data.hidden ? await hideUserById(id) : await unhideUserById(id);
    if (!result.ok) {
      return NextResponse.json({ detail: "User not found" }, { status: 404 });
    }
    if (isDemoMode()) {
      const managed = await getAdminManagedUser(id);
      if (managed) return NextResponse.json(adminManagedUserToRow(managed));
      return NextResponse.json({ id, hidden: parsed.data.hidden, ok: true });
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ detail: "User not found" }, { status: 404 });
    return NextResponse.json(user);
  }

  if (isDemoMode()) {
    const managed = await getAdminManagedUser(id);
    if (managed) {
      try {
        const { hidden: _hidden, ...rest } = parsed.data;
        const user = await updateAdminManagedUser(id, rest);
        return NextResponse.json(adminManagedUserToRow(user));
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Update failed";
        return NextResponse.json({ detail: message }, { status: 404 });
      }
    }

    if (parsed.data.phone !== undefined || parsed.data.dailyReminderTime !== undefined) {
      const { blobSaved } = await updateDemoUserSettings(id, {
        phone: parsed.data.phone ?? null,
        dailyReminderTime: parsed.data.dailyReminderTime ?? null,
      });

      const directory = resolveDemoUser(id);
      const accounts = await getAllSignInAccounts();
      let email = directory?.email;
      if (!email) {
        for (const [rawEmail, account] of Object.entries(accounts)) {
          if (account.userId === id) {
            email = rawEmail;
            break;
          }
        }
      }
      if (email && accounts[email]) {
        await upsertSignInAccount({
          email,
          userId: id,
          role: accounts[email].role,
          name: accounts[email].name || directory?.name || email.split("@")[0],
          phone: parsed.data.phone ?? null,
        });
      }

      try {
        requireBlobPersisted(blobSaved, "User phone/reminder update");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "User phone/reminder update failed";
        return NextResponse.json({ detail: msg }, { status: 503 });
      }

      const row = await findDemoUserRow(id, email || "");
      if (row) return NextResponse.json(row);
      return NextResponse.json({
        id,
        phone: parsed.data.phone ?? null,
        dailyReminderTime: parsed.data.dailyReminderTime ?? null,
        ok: true,
      });
    }

    return NextResponse.json(
      {
        detail:
          "This is a seeded demo account. Create a new user for additional admins, or edit phone/reminder fields only.",
      },
      { status: 403 },
    );
  }

  const prismaUserId = await resolvePrismaUserIdForAdmin(id);
  if (!prismaUserId) {
    return NextResponse.json({ detail: "User not found" }, { status: 404 });
  }

  const isPlatform = canAccessPlatformAdmin(session!.role);
  const updateFields = isPlatform
    ? (({ password: _p, hidden: _h, ...rest }) => rest)(parsed.data)
    : pickCoachContactPatch(parsed.data);

  if (!isPlatform) {
    const blocked =
      parsed.data.role !== undefined ||
      parsed.data.status !== undefined ||
      parsed.data.hidden !== undefined;
    if (blocked) {
      return NextResponse.json(
        { detail: "Coaches can update name, phone, reminder, and notes only." },
        { status: 403 },
      );
    }
    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ detail: "No contact fields to update." }, { status: 400 });
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id: prismaUserId },
      data: updateFields,
    });

    if (updateFields.phone !== undefined || updateFields.dailyReminderTime !== undefined) {
      await upsertSignInAccount({
        email: user.email,
        userId: user.id,
        role: user.role as
          | "ADMIN"
          | "INSTRUCTOR"
          | "PLATFORM_ADMIN"
          | "MEMBER"
          | "PROSPECTIVE_INSTRUCTOR",
        name: user.name || user.email.split("@")[0],
        phone: user.phone,
      });
    }

    return NextResponse.json(
      annotatePrismaUserRow({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        notes: user.notes,
        phone: user.phone || null,
        dailyReminderTime: user.dailyReminderTime || null,
        hidden: user.hidden,
        hiddenAt: user.hiddenAt,
        createdAt: user.createdAt,
        subscription: null,
        counts: { enrollments: 0, performances: 0, workoutLogs: 0 },
      }),
    );
  } catch {
    return NextResponse.json({ detail: "User not found or update failed" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const staff = await requirePlatformStaff();
  if (!staff.ok) return staff.response;

  const { id } = await params;

  const session = staff.session;
  if (session && (await isSelfUserId(session, id))) {
    return NextResponse.json(
      { detail: "You cannot hide your own account while logged in." },
      { status: 403 },
    );
  }

  const result = await hideUserById(id);
  if (!result.ok) {
    return NextResponse.json({ detail: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ hidden: true, id });
}