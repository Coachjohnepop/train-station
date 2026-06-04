import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncProgramSchedule } from "@/lib/program-schedule";

type Params = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { slug } = await params;
  const program = await prisma.program.findUnique({ where: { slug } });
  if (!program) {
    return NextResponse.json({ detail: "Program not found" }, { status: 404 });
  }

  const synced = await syncProgramSchedule(program.id);
  return NextResponse.json(synced);
}