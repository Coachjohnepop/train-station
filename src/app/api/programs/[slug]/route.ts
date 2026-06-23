import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mutateDemoSeed } from "@/lib/demo-seed-store";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { normalizeProgramSlug } from "@/lib/programs";

function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

type Params = { params: Promise<{ slug: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { slug } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.name === undefined) {
    return NextResponse.json({ detail: "No fields to update" }, { status: 400 });
  }

  const trimmedName = parsed.data.name.trim();

  if (isDemoMode()) {
    let notFound = false;
    let updated: Record<string, unknown> | null = null;
    const { blobSaved } = await mutateDemoSeed((data) => {
      const programs = (data.programs || []) as Array<Record<string, unknown>>;
      const target = normalizeProgramSlug(slug);
      const idx = programs.findIndex(
        (p) => p.slug === slug || normalizeProgramSlug(String(p.slug ?? "")) === target,
      );
      if (idx === -1) {
        notFound = true;
        return;
      }
      const program = { ...programs[idx], name: trimmedName };
      programs[idx] = program;
      data.programs = programs;
      updated = program;
    }, { preferFresh: true });

    if (notFound) {
      return NextResponse.json({ detail: "Program not found" }, { status: 404 });
    }
    try {
      requireBlobPersisted(blobSaved, "Program name update");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Program name update failed";
      return NextResponse.json({ detail: msg }, { status: 503 });
    }
    return NextResponse.json(updated);
  }

  try {
    const program = await prisma.program.update({
      where: { slug },
      data: { name: trimmedName },
    });
    return NextResponse.json(program);
  } catch {
    return NextResponse.json({ detail: "Program not found" }, { status: 404 });
  }
}