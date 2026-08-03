import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  coverUrl: z.string().max(2000).nullable().optional(),
});

/** PATCH — update program catalog art (coverUrl) and other coach-editable fields. */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { slug } = await ctx.params;
  if (!slug?.trim()) {
    return NextResponse.json({ error: "Missing program slug." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (isCoachCatalogDemo()) {
    return NextResponse.json(
      { error: "Catalog demo mode — program cover is not writable here." },
      { status: 400 },
    );
  }

  try {
    const coverUrl =
      parsed.data.coverUrl === undefined
        ? undefined
        : parsed.data.coverUrl?.trim() || null;

    const updated = await prisma.program.update({
      where: { slug: slug.trim() },
      data: {
        ...(coverUrl !== undefined ? { coverUrl } : {}),
      },
      select: { id: true, slug: true, name: true, coverUrl: true },
    });

    return NextResponse.json({ ok: true, program: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Update failed.";
    if (message.includes("Record to update not found")) {
      return NextResponse.json({ error: "Program not found." }, { status: 404 });
    }
    console.error("[admin/programs PATCH]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
