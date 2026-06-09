import { NextResponse } from "next/server";
import { z } from "zod";
import { assignWorkoutToDay } from "@/lib/program-schedule";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

const SEED_FILE = path.join(process.cwd(), "prisma", "seed-data.json");
let seedCache: any = null;
function loadSeed() {
  if (!seedCache) {
    seedCache = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  }
  return seedCache;
}
function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

const patchSchema = z.object({
  workoutId: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  options: z.array(z.object({ workoutId: z.string(), label: z.string() })).optional(),
});

type Params = { params: Promise<{ dayId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { dayId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  if (isDemoMode()) {
    const data = loadSeed();
    const day = (data.programDays || []).find((d: any) => d.id === dayId);
    if (!day) {
      return NextResponse.json({ detail: "Day not found" }, { status: 404 });
    }
    const update: any = { ...day };
    if (parsed.data.options !== undefined) {
      update.options = parsed.data.options;
      // For backward, set first option as primary workoutId if present
      if (parsed.data.options.length > 0) {
        const first = parsed.data.options[0];
        const workout = (data.workouts || []).find((w: any) => w.id === first.workoutId);
        update.workoutId = first.workoutId;
        update.workout = workout || null;
      } else {
        update.workoutId = null;
        update.workout = null;
      }
    } else if (parsed.data.workoutId !== undefined) {
      if (parsed.data.workoutId) {
        const workout = (data.workouts || []).find((w: any) => w.id === parsed.data.workoutId);
        if (!workout) {
          return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
        }
        update.workoutId = parsed.data.workoutId;
        update.workout = workout;
        // clear options or keep if legacy
        if (update.options === undefined) update.options = [{ workoutId: parsed.data.workoutId, label: "Standard" }];
      } else {
        update.workoutId = null;
        update.workout = null;
        update.options = [];
      }
    }
    if (parsed.data.videoUrl !== undefined) update.videoUrl = parsed.data.videoUrl;
    if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
    return NextResponse.json(update);
  }

  try {
    const dataUpdate: any = {};
    if (parsed.data.workoutId !== undefined) {
      if (parsed.data.workoutId) {
        const workout = await prisma.workout.findUnique({ where: { id: parsed.data.workoutId } });
        if (!workout) {
          return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
        }
      }
      dataUpdate.workoutId = parsed.data.workoutId;
    }
    if (parsed.data.videoUrl !== undefined) dataUpdate.videoUrl = parsed.data.videoUrl;
    if (parsed.data.notes !== undefined) dataUpdate.notes = parsed.data.notes;

    if (Object.keys(dataUpdate).length > 0) {
      const day = await prisma.programDay.update({
        where: { id: dayId },
        data: dataUpdate,
        include: { workout: true },
      });
      return NextResponse.json(day);
    }

    // fallback if only workoutId was the old path
    const day = await assignWorkoutToDay(dayId, parsed.data.workoutId ?? null);
    return NextResponse.json(day);
  } catch {
    return NextResponse.json({ detail: "Day not found or update failed" }, { status: 404 });
  }
}