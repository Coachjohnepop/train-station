import { NextResponse } from "next/server";
import { isDemoMode, advanceDemoEnrollment } from "@/lib/demo-enrollments";
import { prisma } from "@/lib/prisma";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const day = body.day ? parseInt(body.day, 10) : undefined;
  // targetUserId for coach impersonation (future: persist responses under the correct member)
  const targetUserId = body.targetUserId || undefined;

  if (isDemoMode()) {
    advanceDemoEnrollment(slug);
    // In a fuller implementation we would also persist any `body.responses` for eating days under targetUserId
    return NextResponse.json({ ok: true, demo: true, targetUserId });
  }

  // Real DB path
  try {
    const user = await prisma.user.findUnique({ where: { email: DEMO_MEMBER_EMAIL } });
    if (!user) return NextResponse.json({ detail: "User not found" }, { status: 404 });

    const enrollment = await prisma.programEnrollment.findFirst({
      where: {
        userId: user.id,
        program: { slug },
      },
      include: { program: true },
    });

    if (!enrollment) {
      return NextResponse.json({ ok: false, detail: "Not enrolled" }, { status: 400 });
    }

    let nextWeek = enrollment.currentWeek;
    let nextDay = (day ?? enrollment.currentDay) + 1;

    if (nextDay > 7) {
      nextDay = 1;
      nextWeek += 1;
    }
    const maxWeeks = enrollment.program.durationWeeks || 4;
    if (nextWeek > maxWeeks) {
      nextWeek = maxWeeks;
      nextDay = 7;
    }

    await prisma.programEnrollment.update({
      where: { id: enrollment.id },
      data: { currentWeek: nextWeek, currentDay: nextDay },
    });

    return NextResponse.json({ ok: true, currentWeek: nextWeek, currentDay: nextDay });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
