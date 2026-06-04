import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";

type Params = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { slug } = await params;

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
