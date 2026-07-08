import { NextResponse } from "next/server";
import { isDemoMode, advanceDemoEnrollment } from "@/lib/demo-enrollments";
import { prisma } from "@/lib/prisma";
import { requireSession, assertUserScope } from "@/lib/api-auth";
import { isStaffRole } from "@/lib/staff-access";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const day = body.day ? parseInt(body.day, 10) : undefined;
  const requestedUserId = body.targetUserId as string | undefined;
  const userId = isStaffRole(auth.session.role) && requestedUserId
    ? requestedUserId
    : auth.session.id;
  const scopeErr = assertUserScope(auth.session, userId);
  if (scopeErr) return scopeErr;

  if (isDemoMode()) {
    await advanceDemoEnrollment(slug, userId);
    return NextResponse.json({ ok: true, demo: true, targetUserId: userId });
  }

  try {
    const enrollment = await prisma.programEnrollment.findFirst({
      where: {
        userId,
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