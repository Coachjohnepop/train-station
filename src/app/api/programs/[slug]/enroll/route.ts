import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";
import { isDemoMode, getDemoEnrollments, enrollDemo, unenrollDemo } from "@/lib/demo-enrollments";
import { resolveUserId } from "@/lib/current-user";
import { resolvePostEnrollRedirect } from "@/lib/member-destinations";
import { getCatalogStatus } from "@/lib/programs";

type Params = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { slug } = await params;
  const uid = await resolveUserId();

  if (getCatalogStatus(slug) === "coming_soon") {
    return NextResponse.json({ detail: "This program is coming soon" }, { status: 403 });
  }
  if (getCatalogStatus(slug) === "hidden") {
    return NextResponse.json({ detail: "Program not found" }, { status: 404 });
  }

  if (isDemoMode()) {
    const current = getDemoEnrollments(uid);
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
    enrollDemo(slug, uid);
    const redirectTo = await resolvePostEnrollRedirect(uid, slug);
    return NextResponse.json({ success: true, enrollmentId: `enroll-${uid}-${slug}`, redirectTo });
  }

  // Real DB: use cookie user or fallback to legacy demo email
  let userId = uid;
  let user = await prisma.user.findUnique({ where: { id: uid } }).catch(() => null);
  if (!user) {
    user = await prisma.user.findUnique({ where: { email: DEMO_MEMBER_EMAIL } });
    if (user) userId = user.id;
  }
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
    where: { userId: userId, programId: program.id },
  });
  if (existing) {
    return NextResponse.json({ detail: "Already enrolled" }, { status: 400 });
  }

  const enrollment = await prisma.programEnrollment.create({
    data: {
      userId: userId,
      programId: program.id,
      startedAt: new Date(),
      currentWeek: 1,
      currentDay: 1,
    },
  });

  const redirectTo = await resolvePostEnrollRedirect(userId, slug);
  return NextResponse.json({ success: true, enrollmentId: enrollment.id, redirectTo });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { slug } = await params;
  const uid = await resolveUserId();

  if (isDemoMode()) {
    const current = getDemoEnrollments(uid);
    if (!current[slug]) {
      return NextResponse.json({ detail: "Not enrolled" }, { status: 400 });
    }
    unenrollDemo(slug, uid);
    return NextResponse.json({ success: true });
  }

  let userId = uid;
  let user = await prisma.user.findUnique({ where: { id: uid } }).catch(() => null);
  if (!user) {
    user = await prisma.user.findUnique({ where: { email: DEMO_MEMBER_EMAIL } });
    if (user) userId = user.id;
  }
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
    where: { userId: userId, programId: program.id },
  });

  return NextResponse.json({ success: true });
}
