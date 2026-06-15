import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { isDemoMode, getDemoEnrollments } from "@/lib/demo-enrollments";
import { getDemoWorkoutLogCount, getDemoPerformanceCount, getDemoStrengthScore } from "@/lib/demo-logs";

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

  if (isDemoMode()) {
    // Demo: surface the demo member so instructor/admin can observe logs, the progress % from bottom "log workout complete",
    // and exactly which per-exercise "finished" buttons were tapped (via performance count). Real prisma skipped.
    const demoEnrolls = getDemoEnrollments();
    const enrollCount = Object.keys(demoEnrolls).length;
    const logCount = getDemoWorkoutLogCount();
    const perfCount = getDemoPerformanceCount();
    // Multiple demo users (some with phones) so SMS broadcast can target realistic lists
    const demoStrength = getDemoStrengthScore();
    const demoUsers = [
      {
        id: "demo-user",
        email: "demo@thetrainstation.co",
        name: "Demo Member (Alex)",
        role: "MEMBER" as const,
        status: "active",
        notes: "Primary demo member. Has phone + daily reminder. Use for testing SMS broadcasts and reminders. Strength updates live from logs (0 in fresh review state).",
        createdAt: new Date().toISOString(),
        phone: "(555) 987-6543",
        dailyReminderTime: "07:30",
        subscription: { tier: "first_class", status: "active" },
        counts: { enrollments: enrollCount, performances: perfCount, workoutLogs: logCount },
        strengthScore: demoStrength,
      },
      {
        id: "demo-user-john",
        email: "john@thetrainstation.co",
        name: "John",
        role: "MEMBER" as const,
        status: "active",
        notes: "Train Station member — SMS today sessions (isolation/core Tue 6:30 AM).",
        createdAt: new Date(Date.now() - 432000000).toISOString(),
        phone: "(555) 111-2233",
        dailyReminderTime: "06:30",
        subscription: { tier: "first_class", status: "active" },
        counts: { enrollments: 1, performances: 0, workoutLogs: 0 },
        strengthScore: 0,
      },
      {
        id: "demo-user-stephanie",
        email: "stephanie@thetrainstation.co",
        name: "Stephanie",
        role: "MEMBER" as const,
        status: "active",
        notes: "Train Station member — SMS today sessions (isolation/core Tue 6:30 AM).",
        createdAt: new Date(Date.now() - 432000000).toISOString(),
        phone: "(555) 111-2234",
        dailyReminderTime: "06:30",
        subscription: { tier: "first_class", status: "active" },
        counts: { enrollments: 1, performances: 0, workoutLogs: 0 },
        strengthScore: 0,
      },
      {
        id: "demo-user-2",
        email: "jordan.member@example.com",
        name: "Jordan Lee",
        role: "MEMBER" as const,
        status: "active",
        notes: "Second member with phone for broadcast testing.",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        phone: "(555) 222-3344",
        dailyReminderTime: "08:00",
        subscription: { tier: "coach", status: "active" },
        counts: { enrollments: 1, performances: 12, workoutLogs: 3 },
      },
      {
        id: "demo-user-3",
        email: "casey.prospective@example.com",
        name: "Casey Rivera",
        role: "MEMBER" as const,
        status: "active",
        notes: "Member without phone yet (for broadcast filter testing).",
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        phone: null,
        dailyReminderTime: null,
        subscription: null,
        counts: { enrollments: 0, performances: 0, workoutLogs: 0 },
      },
      {
        id: "demo-instr",
        email: "coach.sam@example.com",
        name: "Sam Coach",
        role: "INSTRUCTOR" as const,
        status: "active",
        notes: "Instructor account (phone for test broadcasts to staff).",
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        phone: "(555) 123-0001",
        dailyReminderTime: null,
        subscription: null,
        counts: { enrollments: 0, performances: 0, workoutLogs: 0 },
      },
    ];
    return NextResponse.json(demoUsers);
  }

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
      phone: u.phone || null,
      dailyReminderTime: u.dailyReminderTime || null,
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
