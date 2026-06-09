import { NextResponse } from "next/server";
import { z } from "zod";
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
    // Return a stub so redirect works; use a real seed workout id for the builder to load
    const data = loadSeed();
    const first = (data.workouts || [])[0];
    return NextResponse.json(
      { id: first?.id || "demo-w", name: parsed.data.name.trim(), description: parsed.data.description?.trim() || null },
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