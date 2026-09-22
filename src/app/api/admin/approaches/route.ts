import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { listApproaches } from "@/lib/approach-catalog";
import { prisma } from "@/lib/prisma";

const writeSchema = z.object({
  label: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const approaches = await listApproaches();
  return NextResponse.json({ approaches });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const parsed = writeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: "Label and description are required." }, { status: 400 });
  }
  const max = await prisma.approach.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.approach.create({
    data: {
      label: parsed.data.label,
      description: parsed.data.description,
      sortOrder: parsed.data.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
