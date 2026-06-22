import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { adminManagedUserToRow, createAdminManagedUser } from "@/lib/admin-managed-users";
import { listDemoUsersForAdmin } from "@/lib/demo-users-admin";
import { isDemoMode } from "@/lib/demo-enrollments";
import { upsertSignInAccount } from "@/lib/member-accounts-store";
import { annotateAdminUsersForSession } from "@/lib/users-admin-session";

const ROLES = ["ADMIN", "INSTRUCTOR", "MEMBER", "PROSPECTIVE_INSTRUCTOR"] as const;

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).default("MEMBER"),
  status: z.string().default("active"),
  notes: z.string().optional(),
  phone: z.string().optional().nullable(),
  dailyReminderTime: z.string().optional().nullable(), // e.g. "07:30"
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.toLowerCase() || "";
  const role = searchParams.get("role") as $Enums.Role | null;
  const includeHidden = searchParams.get("includeHidden") !== "false"; // default: show all

  if (isDemoMode()) {
    let users = await listDemoUsersForAdmin({ includeHidden });

    if (q) {
      users = users.filter((u) => {
        const name = String(u.name || "").toLowerCase();
        const email = String(u.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }
    if (role) {
      users = users.filter((u) => u.role === role);
    }

    return NextResponse.json(await annotateAdminUsersForSession(users));
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        includeHidden ? {} : { hidden: false }, // includeHidden defaults true via !== "false"
        q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {},
        role ? { role } : {},
      ],
    },
    include: {
      subscriptions: {
        include: { tier: true },
        orderBy: { id: "desc" },
        take: 1,
      },
      _count: {
        select: { enrollments: true, performances: true, workoutLogs: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    notes: u.notes,
    phone: u.phone || null,
    dailyReminderTime: u.dailyReminderTime || null,
    hidden: u.hidden,
    hiddenAt: u.hiddenAt,
    createdAt: u.createdAt,
    subscription: u.subscriptions[0]
      ? {
          tier: u.subscriptions[0].tier.slug,
          status: u.subscriptions[0].status,
        }
      : null,
    counts: u._count,
  }));

  return NextResponse.json(await annotateAdminUsersForSession(rows));
}

export async function POST(request: Request) {
  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const first =
      fieldErrors.email?.[0] ||
      fieldErrors.name?.[0] ||
      fieldErrors.role?.[0] ||
      "Invalid user data.";
    return NextResponse.json({ detail: first, errors: fieldErrors }, { status: 400 });
  }

  if (isDemoMode()) {
    try {
      const user = await createAdminManagedUser(parsed.data);
      return NextResponse.json(adminManagedUserToRow(user), { status: 201 });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to create user";
      const status = message.includes("already exists") ? 409 : 500;
      return NextResponse.json({ detail: message }, { status });
    }
  }

  try {
    const user = await prisma.user.create({
      data: parsed.data,
    });
    await upsertSignInAccount({
      email: user.email,
      userId: user.id,
      role: user.role as "ADMIN" | "INSTRUCTOR" | "MEMBER" | "PROSPECTIVE_INSTRUCTOR",
      name: user.name || user.email.split("@")[0],
      phone: user.phone,
      createdAt: user.createdAt.toISOString(),
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      return NextResponse.json({ detail: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ detail: "Failed to create user" }, { status: 500 });
  }
}
