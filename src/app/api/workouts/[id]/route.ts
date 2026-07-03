import { NextResponse } from "next/server";
import { z } from "zod";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { prisma } from "@/lib/prisma";
import { hydrateDemoExercises, loadDemoExercises } from "@/lib/demo-exercises";
import { getDemoSeed, mutateDemoSeed } from "@/lib/demo-seed-store";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { requireStaff } from "@/lib/api-auth";
import {
  buildDemoWorkoutExerciseItems,
  findDemoWorkoutRecord,
} from "@/lib/demo-workout-items";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  exportText: z.string().max(100_000).optional().nullable(),
  certifiedAt: z.string().datetime().optional().nullable(),
  clearCertification: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (isCoachCatalogDemo()) {
    const data = await getDemoSeed({ preferFresh: true });
    await hydrateDemoExercises({ preferFresh: true });
    const exList = loadDemoExercises();
    const workoutExercises = (data.workoutExercises || []) as any[];
    const w = findDemoWorkoutRecord((data.workouts || []) as any[], id, workoutExercises);
    if (!w) {
      return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
    }
    const items = buildDemoWorkoutExerciseItems(id, workoutExercises, exList);
    return NextResponse.json({ ...w, exercises: items });
  }
  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: true },
      },
    },
  });
  if (!workout) {
    return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
  }
  return NextResponse.json(workout);
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  if (isCoachCatalogDemo()) {
    const expectedName =
      parsed.data.name !== undefined ? parsed.data.name.trim() : undefined;
    const expectedDescription =
      parsed.data.description !== undefined
        ? parsed.data.description?.trim() || null
        : undefined;
    const expectedExportText =
      parsed.data.clearCertification === true
        ? null
        : parsed.data.exportText !== undefined
          ? parsed.data.exportText
          : undefined;
    const expectedCertifiedAt =
      parsed.data.clearCertification === true
        ? null
        : parsed.data.certifiedAt !== undefined
          ? parsed.data.certifiedAt
          : undefined;

    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        let updated: Record<string, unknown> | null = null;
        let notFound = false;
        const { blobSaved } = await mutateDemoSeed((data) => {
          const workouts = (data.workouts || []) as any[];
          const idx = workouts.findIndex((w) => w.id === id);
          if (idx === -1) {
            notFound = true;
            return;
          }
          const w = { ...workouts[idx] };
          if (expectedName !== undefined) w.name = expectedName;
          if (expectedDescription !== undefined) w.description = expectedDescription;
          if (parsed.data.clearCertification) {
            w.exportText = null;
            w.certifiedAt = null;
            w.certifiedBy = null;
          } else {
            if (expectedExportText !== undefined) w.exportText = expectedExportText;
            if (expectedCertifiedAt !== undefined) {
              w.certifiedAt = expectedCertifiedAt;
              w.certifiedBy = auth.ok ? auth.session.id : w.certifiedBy ?? null;
            }
          }
          w.updatedAt = new Date().toISOString();
          workouts[idx] = w;
          data.workouts = workouts;
          updated = w;
        });
        if (notFound) {
          return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
        }
        requireBlobPersisted(blobSaved, "Workout update");

        const seed = await getDemoSeed({ preferFresh: Boolean(BLOB_TOKEN) });
        const persisted = ((seed.workouts as any[]) || []).find((w) => w.id === id);
        const nameOk =
          expectedName === undefined || persisted?.name === expectedName;
        const descOk =
          expectedDescription === undefined ||
          (persisted?.description ?? null) === expectedDescription;
        const exportOk =
          expectedExportText === undefined ||
          (persisted?.exportText ?? null) === expectedExportText;
        const certOk =
          expectedCertifiedAt === undefined ||
          (persisted?.certifiedAt ?? null) === expectedCertifiedAt;
        if (persisted && nameOk && descOk && exportOk && certOk) {
          const data = await getDemoSeed({ preferFresh: true });
          await hydrateDemoExercises({ preferFresh: true });
          const items = buildDemoWorkoutExerciseItems(
            id,
            (data.workoutExercises || []) as any[],
            loadDemoExercises(),
          );
          return NextResponse.json({ ...persisted, exercises: items });
        }
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
      return NextResponse.json(
        { detail: "Workout update could not be verified — retry in a moment." },
        { status: 503 },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Workout update failed";
      return NextResponse.json({ detail: msg }, { status: 503 });
    }
  }

  try {
    const data: {
      name?: string;
      description?: string | null;
      exportText?: string | null;
      certifiedAt?: Date | null;
      certifiedBy?: string | null;
    } = {};

    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
    if (parsed.data.description !== undefined) {
      data.description = parsed.data.description?.trim() || null;
    }
    if (parsed.data.clearCertification) {
      data.exportText = null;
      data.certifiedAt = null;
      data.certifiedBy = null;
    } else {
      if (parsed.data.exportText !== undefined) data.exportText = parsed.data.exportText;
      if (parsed.data.certifiedAt !== undefined) {
        data.certifiedAt = parsed.data.certifiedAt
          ? new Date(parsed.data.certifiedAt)
          : null;
        data.certifiedBy = auth.ok ? auth.session.id : null;
      }
    }

    const workout = await prisma.workout.update({
      where: { id },
      data,
      include: {
        exercises: {
          orderBy: { sortOrder: "asc" },
          include: { exercise: true },
        },
      },
    });
    return NextResponse.json(workout);
  } catch {
    return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.workout.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
  }
}