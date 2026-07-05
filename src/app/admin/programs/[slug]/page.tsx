import Link from "next/link";
import { notFound } from "next/navigation";
import ProgramAdminClient from "@/components/ProgramAdminClient";
import { loadProgramContentAlert } from "@/lib/coach-content-alerts";
import { getProgramBySlug } from "@/lib/program-data";
import { ADULT_MACRO_PHASES } from "@/lib/program-macro-cycle";
import { syncProgramSchedule } from "@/lib/program-schedule";
import { prisma } from "@/lib/prisma";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { getDemoSeed } from "@/lib/demo-seed-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function ProgramAdminDetailPage({ params }: Props) {
  const { slug } = await params;

  const program = await getProgramBySlug(slug);
  if (!program) notFound();

  let workouts: { id: string; name: string }[] = [];

  if (isCoachCatalogDemo()) {
    // In pure demo mode (DATABASE_URL contains "dummy") we load everything from seed-data.json.
    // No real Prisma connection is possible/necessary.
    try {
      const seed = await getDemoSeed({ preferFresh: true });
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

  const contentAlert = await loadProgramContentAlert(slug);

  const macroPhases =
    slug === "adult"
      ? ADULT_MACRO_PHASES.map((p) => ({
          phaseIndex: p.phaseIndex,
          name: p.name,
          minWeeks: p.minWeeks,
          maxWeeks: p.maxWeeks,
        }))
      : undefined;

  return (
    <div>
      <Link href="/admin/programs" className="text-xs text-accent hover:underline">← Programs</Link>
      <ProgramAdminClient
        contentAlert={contentAlert}
        program={{
          id: program.id,
          slug: program.slug,
          name: program.name,
          durationWeeks: program.durationWeeks,
          startDate: (program as { startDate?: string | null }).startDate ?? null,
          macroPhases,
          weeks: program.weeks,
        }}
        workouts={workouts}
      />
    </div>
  );
}