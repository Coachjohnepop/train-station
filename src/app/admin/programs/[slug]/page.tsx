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
      <Link
        href="/admin/programs"
        className="text-sm text-accent hover:underline"
      >
        ← All programs
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{program.name}</h1>
      <p className="mt-2 text-[var(--muted)]">{program.description}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {assignedCount} {program.category === "workout" ? "workout" : program.category === "journey" ? "journey session" : "content"} slot{assignedCount === 1 ? "" : "s"} assigned
      </p>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Assign workouts to program</h2>
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