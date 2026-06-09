import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberDashboard } from "@/lib/member-context";
import EnrollButton from "@/components/EnrollButton";
import { PROGRAM_IMAGES, CATEGORY_LABELS } from "@/lib/program-constants";

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
      <p className="mt-2 text-xs text-[var(--accent)]">
        Workouts, Eating Approaches, Yoga Channels and Journeys are independent — you can be enrolled and active in all at once (different schedules, different daily prompts/sessions/recordings, separate progress). Journey recordings can be substituted into workout days.
      </p>

      {(() => {
        const grouped = (data.programs || []).reduce((acc: Record<string, any[]>, p: any) => {
          const c = p.category || "workout";
          if (!acc[c]) acc[c] = [];
          acc[c].push(p);
          return acc;
        }, {});
        const cats = ["workout", "eating", "yoga", "journey"].filter((c) => grouped[c]?.length);
        return cats.map((cat) => (
          <div key={cat} className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)] mb-2">
              {CATEGORY_LABELS[cat] || cat}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {grouped[cat].map((program: any) => {
                const isEnrolled = enrolledSlugs.has(program.slug);
                const img = PROGRAM_IMAGES[program.slug] || "/images/programs/adult.jpg";
                return (
                  <li key={program.id}>
                    <div className="card group relative block transition hover-accent-border overflow-hidden">
                      <Link href={`/member/programs/${program.slug}`} className="block">
                        <div className="relative h-28 -mx-4 -mt-4 mb-3">
                          <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/60" />
                        </div>
                        <div className="pr-20">
                          <h2 className="text-lg font-semibold">{program.name}</h2>
                          {program.description && (
                            <p className="mt-2 text-sm text-[var(--muted)]">
                              {program.description}
                            </p>
                          )}
                          <div className="mt-1 text-[10px] text-accent group-hover:underline">
                            {isEnrolled ? "Review & track →" : "Preview →"}
                          </div>
                        </div>
                      </Link>

                      {/* Enroll / Unenroll as clear button in bottom right */}
                      <div className="absolute bottom-3 right-3 z-10">
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
        ));
      })()}
    </div>
  );
}
