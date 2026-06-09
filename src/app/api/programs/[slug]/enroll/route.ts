import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";
import { isDemoMode, getDemoEnrollments, enrollDemo, unenrollDemo } from "@/lib/demo-enrollments";

type Params = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { slug } = await params;

  if (isDemoMode()) {
    const current = getDemoEnrollments();
    if (current[slug]) {
      return NextResponse.json({ detail: "Already enrolled" }, { status: 400 });
    }
    // Simulate enrollment; use program data to validate slug exists
    const { listPrograms } = await import("@/lib/program-data");
    const programs = await listPrograms();
    const program = programs.find((p: any) => p.slug === slug);
    if (!program) {
      return NextResponse.json({ detail: "Program not found" }, { status: 404 });
    }
    enrollDemo(slug);
    return NextResponse.json({ success: true, enrollmentId: `demo-enroll-${slug}` });
  }

  const user = await prisma.user.findUnique({
    where: { email: DEMO_MEMBER_EMAIL },
  });
  if (!user) {
    return NextResponse.json({ detail: "User not found" }, { status: 404 });
  }

  const program = await prisma.program.findUnique({
    where: { slug },
  });
  if (!program) {
    return NextResponse.json({ detail: "Program not found" }, { status: 404 });
  }

  const existing = await prisma.programEnrollment.findFirst({
    where: { userId: user.id, programId: program.id },
  });
  if (existing) {
    return NextResponse.json({ detail: "Already enrolled" }, { status: 400 });
  }

  const enrollment = await prisma.programEnrollment.create({
    data: {
      userId: user.id,
      programId: program.id,
      startedAt: new Date(),
      currentWeek: 1,
      currentDay: 1,
    },
  });

  return NextResponse.json({ success: true, enrollmentId: enrollment.id });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { slug } = await params;

  if (isDemoMode()) {
    const current = getDemoEnrollments();
    if (!current[slug]) {
      return NextResponse.json({ detail: "Not enrolled" }, { status: 400 });
    }
    unenrollDemo(slug);
    return NextResponse.json({ success: true });
  }

  const user = await prisma.user.findUnique({
    where: { email: DEMO_MEMBER_EMAIL },
  });
  if (!user) {
    return NextResponse.json({ detail: "User not found" }, { status: 404 });
  }

  const program = await prisma.program.findUnique({
    where: { slug },
  });
  if (!program) {
    return NextResponse.json({ detail: "Program not found" }, { status: 404 });
  }

  await prisma.programEnrollment.deleteMany({
    where: { userId: user.id, programId: program.id },
  });

  return NextResponse.json({ success: true });
}
