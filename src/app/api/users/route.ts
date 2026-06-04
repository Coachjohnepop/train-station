import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";

const ROLES = ["ADMIN", "INSTRUCTOR", "MEMBER", "PROSPECTIVE_INSTRUCTOR"] as const;

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).default("MEMBER"),
  status: z.string().default("active"),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.toLowerCase() || "";
  const role = searchParams.get("role") as $Enums.Role | null;

  const users = await prisma.user.findMany({
    where: {
      AND: [
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

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      notes: u.notes,
      createdAt: u.createdAt,
      subscription: u.subscriptions[0]
        ? {
            tier: u.subscriptions[0].tier.slug,
            status: u.subscriptions[0].status,
          }
        : null,
      counts: u._count,
    }))
  );
}

export async function POST(request: Request) {
  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const user = await prisma.user.create({
      data: parsed.data,
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ detail: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ detail: "Failed to create user" }, { status: 500 });
  }
}
