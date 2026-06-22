import Link from "next/link";
import ExportSeedButton from "@/components/ExportSeedButton";
import { listPrograms } from "@/lib/program-data";
import { filterAdminCatalogPrograms } from "@/lib/programs";

export const dynamic = "force-dynamic";

export default async function ProgramsAdminPage() {
  const programs = filterAdminCatalogPrograms(await listPrograms());

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

      <ul className="mt-8 space-y-3">
        {programs.map((program: any) => {
          const assigned = program.weeks.reduce(
            (n: number, w: any) => n + w.days.filter((d: any) => d.workoutId).length,
            0
          );
          const totalSlots = program.weeks.length * 7;
          return (
            <li key={program.id}>
              <Link
                href={`/admin/programs/${program.slug}`}
                className="card flex flex-wrap items-center justify-between gap-4 transition hover-accent-border"
              >
                <div>
                  <p className="text-xs text-[var(--muted)]">
                    #{program.sortOrder} · {program.slug}
                  </p>
                  <p className="text-lg font-semibold">{program.name} <span className="text-xs align-middle font-normal text-[var(--muted)]">({program.category || "workout"})</span></p>
                  {program.description && (
                    <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
                      {program.description}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm text-[var(--muted)]">
                  <p>
                    {assigned} / {totalSlots} slots assigned
                  </p>
                  <p>{program._count.enrollments} members enrolled</p>
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