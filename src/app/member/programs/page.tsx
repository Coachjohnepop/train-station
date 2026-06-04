import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramAccessState } from "@/lib/access";
import { getMemberDashboard } from "@/lib/member-context";
import EnrollButton from "@/components/EnrollButton";

export const dynamic = "force-dynamic";

export default async function MemberProgramsPage() {
  const data = await getMemberDashboard();
  if (!data) notFound();

  const enrolledSlugs = new Set(data.enrollments.map((e) => e.program.slug));

  return (
    <div>
      <h1 className="text-2xl font-bold">Programs</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Every track is available in preview mode. Enroll to track your progress.
      </p>

      <ul className="mt-6 space-y-3">
        {data.programs.map((program) => {
          const state = getProgramAccessState(program, data.access);
          const isEnrolled = enrolledSlugs.has(program.slug);
          return (
            <li key={program.id}>
              <div className="card block transition hover-accent-border">
                <div className="flex justify-between gap-2">
                  <h2 className="text-lg font-semibold">{program.name}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      state === "included"
                        ? "bg-[var(--success)]/15 text-[var(--success)]"
                        : "nav-tab-active text-accent"
                    }`}
                  >
                    {state === "included" ? "Included" : "Upgrade"}
                  </span>
                </div>
                {program.description && (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {program.description}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <Link
                    href={`/member/programs/${program.slug}`}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {isEnrolled ? "View schedule & progress →" : "Preview program →"}
                  </Link>
                  <EnrollButton
                    slug={program.slug}
                    isEnrolled={isEnrolled}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
