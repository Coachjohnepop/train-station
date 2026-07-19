import Link from "next/link";
import ExportSeedButton from "@/components/ExportSeedButton";
import { getEnrollmentStatsByProgramSlug } from "@/lib/coach-content-alerts";
import { assessProgramReadiness } from "@/lib/program-readiness";
import { listPrograms } from "@/lib/program-data";
import { filterAdminCatalogPrograms } from "@/lib/programs";

export const dynamic = "force-dynamic";

export default async function ProgramsAdminPage() {
  const programs = filterAdminCatalogPrograms(await listPrograms());
  const enrollmentStats = getEnrollmentStatsByProgramSlug();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Programs</h1>
          <p className="mt-1 text-xs text-[var(--muted)] max-w-xl">
            Build workouts here: pick Gym/Home per day, add exercises, set reps, copy weeks. Paste a full week via Text Upload.
          </p>
        </div>
        <ExportSeedButton />
      </div>

      <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 text-sm text-[var(--muted)]">
        <p className="font-semibold text-violet-100">Jeremy content rails</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          <li>
            <strong className="text-[var(--text)]">Adult Strength</strong> — fill Week 1 Gym + Home for
            Mon–Sun, then <strong className="text-[var(--text)]">Copy week → Week 2</strong> and tweak.
          </li>
          <li>
            Multi-part days (AM / midday / PM): open a day → set parts → members see a part list on{" "}
            <strong className="text-[var(--text)]">Today</strong>.
          </li>
          <li>
            Templates & paste: always clones. Overwrite confirm if the day already has Gym/Home content.
          </li>
          <li>
            Landing YouTube (welcome / free ticket / weekly / dinner):{" "}
            <Link href="/admin/landing" className="text-accent hover:underline">
              Admin → Landing
            </Link>
          </li>
        </ul>
      </div>

      <ul className="mt-8 space-y-3">
        {programs.map((program: any) => {
          const assigned = program.weeks.reduce(
            (n: number, w: any) => n + w.days.filter((d: any) => d.workoutId).length,
            0
          );
          const totalSlots = program.weeks.length * 7;
          const enroll = enrollmentStats[program.slug] ?? { memberCount: 0, maxWeek: 1 };
          const readiness =
            (program.category || "workout") === "workout"
              ? assessProgramReadiness(
                  {
                    slug: program.slug,
                    name: program.name,
                    durationWeeks: program.durationWeeks,
                    startDate: program.startDate ?? null,
                    weeks: program.weeks,
                  },
                  enroll.maxWeek,
                )
              : null;
          const readinessLabel = readiness
            ? readiness.isCurrentWithClients
              ? "Current"
              : !readiness.currentWeekComplete
                ? `W${readiness.anchorWeek} needs work`
                : `W${readiness.nextWeek?.weekNumber} needs work`
            : null;
          const readinessClass = readiness
            ? readiness.isCurrentWithClients
              ? "text-[var(--success)]"
              : readiness.alertLevel === "critical"
                ? "text-red-400"
                : "text-amber-300"
            : "";
          return (
            <li key={program.id}>
              <Link
                href={`/admin/programs/${program.slug}`}
                className="card flex flex-col gap-3 transition hover-accent-border sm:flex-row sm:items-start sm:justify-between sm:gap-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--muted)]">
                    #{program.sortOrder} · {program.slug}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold leading-snug tracking-tight break-words">
                    {program.name}
                    <span className="ml-2 align-middle text-xs font-normal text-[var(--muted)]">
                      ({program.category || "workout"})
                    </span>
                  </p>
                  {program.description && (
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                      {program.description}
                    </p>
                  )}
                </div>
                <div className="shrink-0 space-y-0.5 text-left text-sm leading-snug text-[var(--muted)] sm:text-right">
                  <p>
                    {assigned} / {totalSlots} slots assigned
                  </p>
                  <p>{enroll.memberCount || program._count.enrollments} members enrolled</p>
                  {readinessLabel && (
                    <p className={readinessClass}>{readinessLabel}</p>
                  )}
                  <p className={program.catalogStatus === "live" ? "text-[var(--success)]" : ""}>
                    {program.catalogStatus === "live"
                      ? "Live"
                      : program.catalogStatus === "coming_soon"
                        ? "Coming soon"
                        : "Draft"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}