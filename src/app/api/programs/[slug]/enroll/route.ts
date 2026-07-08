import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDemoMode, getDemoEnrollments, enrollDemo, unenrollDemo } from "@/lib/demo-enrollments";
import { resolvePostEnrollRedirect } from "@/lib/member-destinations";
import { getCatalogStatus } from "@/lib/programs";
import { requireSession } from "@/lib/api-auth";

type Params = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { slug } = await params;
  const uid = auth.session.id;

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
    const { listPrograms } = await import("@/lib/program-data");
    const programs = await listPrograms();
    const program = programs.find((p: { slug: string }) => p.slug === slug);
    if (!program) {
      return NextResponse.json({ detail: "Program not found" }, { status: 404 });
    }
    await enrollDemo(slug, uid);
    const redirectTo = await resolvePostEnrollRedirect(uid, slug);
    return NextResponse.json({ success: true, enrollmentId: `enroll-${uid}-${slug}`, redirectTo });
  }

  const user = await prisma.user.findUnique({ where: { id: uid } });
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
    where: { userId: uid, programId: program.id },
  });
  if (existing) {
    return NextResponse.json({ detail: "Already enrolled" }, { status: 400 });
  }

  const enrollment = await prisma.programEnrollment.create({
    data: {
      userId: uid,
      programId: program.id,
      startedAt: new Date(),
      currentWeek: 1,
      currentDay: 1,
    },
  });

  const redirectTo = await resolvePostEnrollRedirect(uid, slug);
  return NextResponse.json({ success: true, enrollmentId: enrollment.id, redirectTo });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { slug } = await params;
  const uid = auth.session.id;

  if (isDemoMode()) {
    const current = getDemoEnrollments(uid);
    if (!current[slug]) {
      return NextResponse.json({ detail: "Not enrolled" }, { status: 400 });
    }
    await unenrollDemo(slug, uid);
    return NextResponse.json({ success: true });
  }

  const user = await prisma.user.findUnique({ where: { id: uid } });
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
    where: { userId: uid, programId: program.id },
  });

  return NextResponse.json({ success: true });
}