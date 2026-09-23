import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const row = await prisma.foodEntry.findFirst({
    where: { id, userId: session.id },
    select: { id: true },
  });
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await prisma.foodEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
