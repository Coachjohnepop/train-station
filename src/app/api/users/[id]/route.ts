import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "INSTRUCTOR", "MEMBER", "PROSPECTIVE_INSTRUCTOR"] as const;

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  dailyReminderTime: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscriptions: { include: { tier: true }, orderBy: { id: "desc" }, take: 1 },
      enrollments: { include: { program: true }, orderBy: { startedAt: "desc" }, take: 5 },
      workoutLogs: { orderBy: { performedAt: "desc" }, take: 5 },
    },
  });
  if (!user) return NextResponse.json({ detail: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ detail: "User not found or update failed" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.user.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ detail: "User not found" }, { status: 404 });
  }
}
