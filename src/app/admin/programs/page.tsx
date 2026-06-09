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
        Top-level tracks members choose on {BRAND_NAME}. Workouts, Eating Approaches (cascading daily prompts), Yoga Channels (instructors create their own Patreon-style channels by adding programs with category "yoga"), and Journeys (recorded live sessions with YouTube links that can be substituted into workout days).
      </p>

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