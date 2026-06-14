import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

const SEED_FILE = path.join(process.cwd(), "prisma", "seed-data.json");

// Always re-read so that any admin-driven writes back to seed-data.json are visible
// immediately (consistent with the other demo loaders).
function loadSeed() {
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
}
function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function GET() {
  if (isDemoMode()) {
    const data = loadSeed();
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
      workouts.sort((a: any, b: any) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),
    );
  }
  const workouts = await prisma.workout.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { exercises: true } },
    },
  });
  return NextResponse.json(workouts);
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  if (isDemoMode()) {
    // Return a unique ID for new workout creation so we can support fresh ones with auto warm-ups
    const newId = `new-w-${Date.now()}`;
    return NextResponse.json(
      { id: newId, name: parsed.data.name.trim(), description: parsed.data.description?.trim() || null },
      { status: 201 },
    );
  }
  const workout = await prisma.workout.create({
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
    },
  });
  return NextResponse.json(workout, { status: 201 });
}