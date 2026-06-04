import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { listPrograms } from "@/lib/program-data";

export const dynamic = "force-dynamic";

export default async function ProgramsAdminPage() {
  const programs = await listPrograms();

  return (
    <div>
      <h1 className="text-2xl font-bold">Programs</h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        Top-level tracks members choose on {BRAND_NAME}. Assign workouts to
        weeks inside each program.
      </p>

      <ul className="mt-8 space-y-3">
        {programs.map((program) => {
          const assigned = program.weeks.reduce(
            (n, w) => n + w.days.filter((d) => d.workoutId).length,
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
                  <p className="text-lg font-semibold">{program.name}</p>
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
                  <p className={program.published ? "text-[var(--success)]" : ""}>
                    {program.published ? "Published" : "Draft"}
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