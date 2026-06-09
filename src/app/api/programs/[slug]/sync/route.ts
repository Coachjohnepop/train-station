import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncProgramSchedule } from "@/lib/program-schedule";
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

type Params = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { slug } = await params;
  if (isDemoMode()) {
    const data = loadSeed();
    const prog = (data.programs || []).find((p: any) => p.slug === slug);
    if (!prog) {
      return NextResponse.json({ detail: "Program not found" }, { status: 404 });
    }
    const workoutsById: Record<string, any> = Object.fromEntries(
      (data.workouts || []).map((w: any) => [w.id, w])
    );
    const weeks = (data.programWeeks || [])
      .filter((w: any) => w.programId === prog.id)
      .sort((a: any, b: any) => a.weekNumber - b.weekNumber)
      .map((w: any) => ({
        id: w.id,
        weekNumber: w.weekNumber,
        days: (data.programDays || [])
          .filter((d: any) => d.weekId === w.id)
          .sort((a: any, b: any) => a.dayNumber - b.dayNumber)
          .map((d: any) => {
            const dayOpts = (data.programDayOptions || []).filter((o: any) => o.dayId === d.id).map((o: any) => ({
              workoutId: o.workoutId,
              label: o.label,
              workout: workoutsById[o.workoutId] || null,
            }));
            return {
              id: d.id,
              dayNumber: d.dayNumber,
              workoutId: d.workoutId,
              notes: d.notes,
              videoUrl: d.videoUrl || null,
              workout: d.workoutId ? workoutsById[d.workoutId] || null : null,
              options: dayOpts.length > 0 ? dayOpts : (d.workoutId ? [{ workoutId: d.workoutId, label: "Standard", workout: workoutsById[d.workoutId] || null }] : []),
            };
          }),
      }));
    return NextResponse.json({
      ...prog,
      weeks,
    });
  }

  const program = await prisma.program.findUnique({ where: { slug } });
  if (!program) {
    return NextResponse.json({ detail: "Program not found" }, { status: 404 });
  }

  const synced = await syncProgramSchedule(program.id);
  return NextResponse.json(synced);
}