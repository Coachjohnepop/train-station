import { NextResponse } from "next/server";
import { z } from "zod";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { prisma } from "@/lib/prisma";
import { mutateDemoSeed } from "@/lib/demo-seed-store";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { normalizeProgramSlug } from "@/lib/programs";
import { requireCoachStaff } from "@/lib/api-auth";
import { reanchorProgramCalendar } from "@/lib/program-calendar-reanchor";
import { getProgramBySlug } from "@/lib/program-data";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  /** YYYY-MM-DD program calendar anchor (snapped to that week's Monday). */
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  /**
   * When true with startDate, rewrite every day.calendarDate from week/day numbers
   * so the design calendar no longer shows a stale month (e.g. June after July starts).
   */
  reanchorCalendar: z.boolean().optional(),
});

type Params = { params: Promise<{ slug: string }> };

/** Full program tree for coach builder refresh (paste, multi-part, etc.). */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { slug } = await params;
  try {
    const full = await getProgramBySlug(slug);
    if (!full) {
      return NextResponse.json({ detail: "Program not found" }, { status: 404 });
    }
    return NextResponse.json(full);
  } catch (e) {
    console.error("GET program failed", e);
    return NextResponse.json({ detail: "Could not load program" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { slug } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const { name, startDate, reanchorCalendar } = parsed.data;
  if (name === undefined && startDate === undefined) {
    return NextResponse.json({ detail: "No fields to update" }, { status: 400 });
  }

  try {
    if (startDate != null && reanchorCalendar !== false) {
      // Default: changing the anchor always rewrites day dates so UI matches.
      await reanchorProgramCalendar(slug, startDate);
    } else if (startDate === null) {
      // Clear anchor → design calendar falls back to “this week’s Monday”.
      if (isCoachCatalogDemo()) {
        let notFound = false;
        const { blobSaved } = await mutateDemoSeed((data) => {
          const programs = (data.programs || []) as Array<Record<string, unknown>>;
          const target = normalizeProgramSlug(slug);
          const idx = programs.findIndex(
            (p) =>
              p.slug === slug || normalizeProgramSlug(String(p.slug ?? "")) === target,
          );
          if (idx < 0) {
            notFound = true;
            return;
          }
          programs[idx] = { ...programs[idx], startDate: null };
          data.programs = programs;
        }, { preferFresh: true });
        if (notFound) {
          return NextResponse.json({ detail: "Program not found" }, { status: 404 });
        }
        requireBlobPersisted(blobSaved, "Program startDate clear");
      } else {
        await prisma.program.update({
          where: { slug },
          data: { startDate: null },
        });
      }
    } else if (startDate != null && reanchorCalendar === false) {
      if (isCoachCatalogDemo()) {
        let notFound = false;
        const { blobSaved } = await mutateDemoSeed((data) => {
          const programs = (data.programs || []) as Array<Record<string, unknown>>;
          const target = normalizeProgramSlug(slug);
          const idx = programs.findIndex(
            (p) =>
              p.slug === slug || normalizeProgramSlug(String(p.slug ?? "")) === target,
          );
          if (idx < 0) {
            notFound = true;
            return;
          }
          programs[idx] = { ...programs[idx], startDate };
          data.programs = programs;
        }, { preferFresh: true });
        if (notFound) {
          return NextResponse.json({ detail: "Program not found" }, { status: 404 });
        }
        requireBlobPersisted(blobSaved, "Program startDate update");
      } else {
        await prisma.program.update({
          where: { slug },
          data: { startDate },
        });
      }
    }

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return NextResponse.json({ detail: "Name required" }, { status: 400 });
      }
      if (isCoachCatalogDemo()) {
        let notFound = false;
        const { blobSaved } = await mutateDemoSeed((data) => {
          const programs = (data.programs || []) as Array<Record<string, unknown>>;
          const target = normalizeProgramSlug(slug);
          const idx = programs.findIndex(
            (p) =>
              p.slug === slug || normalizeProgramSlug(String(p.slug ?? "")) === target,
          );
          if (idx < 0) {
            notFound = true;
            return;
          }
          programs[idx] = { ...programs[idx], name: trimmedName };
          data.programs = programs;
        }, { preferFresh: true });
        if (notFound) {
          return NextResponse.json({ detail: "Program not found" }, { status: 404 });
        }
        requireBlobPersisted(blobSaved, "Program name update");
      } else {
        await prisma.program.update({
          where: { slug },
          data: { name: trimmedName },
        });
      }
    }

    const full = await getProgramBySlug(slug);
    if (!full) {
      return NextResponse.json({ detail: "Program not found" }, { status: 404 });
    }
    return NextResponse.json(full);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    const status =
      msg === "PROGRAM_NOT_FOUND" ? 404 : msg === "INVALID_START_DATE" ? 400 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}