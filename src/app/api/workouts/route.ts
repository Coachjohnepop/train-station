import { NextResponse } from "next/server";
import { z } from "zod";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { prisma } from "@/lib/prisma";
import { getDemoSeed, mutateDemoSeed } from "@/lib/demo-seed-store";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { filterVisibleWorkouts } from "@/lib/programs";
import { requireStaff } from "@/lib/api-auth";
import {
  canonicalWorkoutContentName,
  findWorkoutByContentTitle,
} from "@/lib/workout-catalog";
import { seedWarmupsIntoWorkout } from "@/lib/seed-workout-warmups";


const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /** Default true — inject coach Settings warm-up blocks onto empty new workouts. */
  seedWarmups: z.boolean().optional().default(true),
});

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  if (isCoachCatalogDemo()) {
    const data = await getDemoSeed();
    const workouts = (data.workouts || []).map((w: any) => {
      const exCount = (data.workoutExercises || []).filter(
        (we: any) => we.workoutId === w.id,
      ).length;
      return {
        ...w,
        _count: { exercises: exCount },
      };
    });
    return NextResponse.json(
      filterVisibleWorkouts(workouts).sort((a: any, b: any) =>
        (b.updatedAt || "").localeCompare(a.updatedAt || ""),
      ),
    );
  }
  const workouts = await prisma.workout.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { exercises: true } },
    },
  });
  return NextResponse.json(filterVisibleWorkouts(workouts));
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  const wantWarmups = parsed.data.seedWarmups !== false;

  if (isCoachCatalogDemo()) {
    try {
      const name = canonicalWorkoutContentName(parsed.data.name);
      const seedBefore = await getDemoSeed({ preferFresh: Boolean(BLOB_TOKEN) });
      const existing = ((seedBefore.workouts as any[]) || []).find(
        (w) => canonicalWorkoutContentName(w.name) === name,
      );
      if (existing) {
        let warmupSeed = null;
        if (wantWarmups) {
          warmupSeed = await seedWarmupsIntoWorkout(existing.id);
        }
        return NextResponse.json({ ...existing, reused: true, warmupSeed });
      }

      const now = new Date().toISOString();
      const workout = {
        id: `new-w-${Date.now()}`,
        name,
        description: parsed.data.description?.trim() || null,
        createdAt: now,
        updatedAt: now,
      };
      for (let attempt = 0; attempt < 4; attempt++) {
        const { blobSaved } = await mutateDemoSeed((data) => {
          if (!data.workouts) data.workouts = [];
          const list = data.workouts as any[];
          if (!list.some((w) => w.id === workout.id)) list.push(workout);
          data.workouts = list;
        });
        requireBlobPersisted(blobSaved, "Workout create");

        const seed = await getDemoSeed({ preferFresh: Boolean(BLOB_TOKEN) });
        if ((seed.workouts as any[])?.some((w) => w.id === workout.id)) {
          const warmupSeed = wantWarmups
            ? await seedWarmupsIntoWorkout(workout.id)
            : null;
          return NextResponse.json({ ...workout, warmupSeed }, { status: 201 });
        }
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
      return NextResponse.json(
        { detail: "Workout created but cloud save failed — retry in a moment." },
        { status: 503 },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Workout create failed";
      return NextResponse.json({ detail: msg }, { status: 503 });
    }
  }
  const name = canonicalWorkoutContentName(parsed.data.name);
  const existing = await findWorkoutByContentTitle(name);
  if (existing) {
    let warmupSeed = null;
    if (wantWarmups) {
      warmupSeed = await seedWarmupsIntoWorkout(existing.id);
    }
    return NextResponse.json({ ...existing, reused: true, warmupSeed });
  }

  const workout = await prisma.workout.create({
    data: {
      name,
      description: parsed.data.description?.trim() || null,
    },
  });
  const warmupSeed = wantWarmups
    ? await seedWarmupsIntoWorkout(workout.id)
    : null;
  return NextResponse.json({ ...workout, warmupSeed }, { status: 201 });
}