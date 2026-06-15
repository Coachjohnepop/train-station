import Link from "next/link";
import { notFound } from "next/navigation";
import ProgramScheduleBuilder from "@/components/ProgramScheduleBuilder";
import { getProgramBySlug } from "@/lib/program-data";
import { syncProgramSchedule } from "@/lib/program-schedule";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function ProgramAdminDetailPage({ params }: Props) {
  const { slug } = await params;

  const program = await getProgramBySlug(slug);
  if (!program) notFound();

  let workouts: { id: string; name: string }[] = [];

  if (isDemoMode()) {
    // In pure demo mode (DATABASE_URL contains "dummy") we load everything from seed-data.json.
    // No real Prisma connection is possible/necessary.
    try {
      const seedPath = path.join(process.cwd(), "prisma/seed-data.json");
      const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
      workouts = (seed.workouts || []).map((w: any) => ({ id: w.id, name: w.name }));
    } catch {
      workouts = [];
    }
    // syncProgramSchedule + direct prisma.program.findUnique are DB-only; we skip them in demo
    // because getProgramBySlug (called above) already reconstructs the full schedule from JSON.
  } else {
    const programRecord = await prisma.program.findUnique({ where: { slug } });
    if (!programRecord) notFound();

    await syncProgramSchedule(programRecord.id);

    workouts = await prisma.workout.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  const assignedCount = program.weeks.reduce(
    (n: number, w: any) => n + w.days.filter((d: any) => d.workoutId).length,
    0,
  );

  return (
    <div>
      <Link href="/admin/programs" className="text-xs text-accent hover:underline">← Programs</Link>
      <div className="mt-1 flex items-baseline gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{program.name}</h1>
        <span className="text-[10px] text-[var(--muted)]">{assignedCount} slots · {program.durationWeeks} weeks</span>
      </div>

      <div className="mt-3">
        <ProgramScheduleBuilder
          program={{
            id: program.id,
            slug: program.slug,
            name: program.name,
            durationWeeks: program.durationWeeks,
            weeks: program.weeks,
          }}
          workouts={workouts}
        />
      </div>
    </div>
  );
}