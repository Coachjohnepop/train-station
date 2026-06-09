import Link from "next/link";
import { listPrograms } from "@/lib/program-data";
import SplashCarousel from "@/components/SplashCarousel";
import { PROGRAM_IMAGES } from "@/lib/program-constants";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const programs = await listPrograms();

  const programImages = PROGRAM_IMAGES;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Professional Rotating Splash Hero with 4 inspiring workout images */}
      <SplashCarousel />

      {/* Programs visible on the home splash */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[3px] text-[var(--accent)]">
            CHOOSE YOUR TRACK
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Programs built for real results
          </h2>
          <p className="mt-4 text-lg text-[var(--muted)]">
            4-week structured training. Choose the one that matches your goals.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {programs.map((program: any) => (
            <Link
              key={program.id}
              href={`/member/programs/${program.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition-all hover:border-[var(--accent)] hover:shadow-2xl"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <img
                  src={programImages[program.slug] || "/images/programs/adult.jpg"}
                  alt={program.name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 p-5">
                  <div className="inline rounded bg-[var(--accent)]/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white">
                    {program.durationWeeks} weeks
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{program.name}</h3>
                </div>
              </div>
              <div className="p-5">
                <p className="line-clamp-3 text-sm text-[var(--muted)]">
                  {program.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-[var(--accent)] group-hover:underline">
                  View program <span className="ml-1 transition group-hover:translate-x-0.5">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Spruced value props */}
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Exercise library",
              body: "Create each movement once. Reuse in every workout. Clean, searchable, and reusable across programs.",
              icon: "🏋️",
            },
            {
              title: "Workout builder",
              body: "Spreadsheet-style rows: sets, reps, rest. Duplicate fast. Full control over schemes and progressions.",
              icon: "📋",
            },
            {
              title: "Program calendar",
              body: "Drag workouts onto weeks. Ship complete programs in minutes. Members get day-by-day access.",
              icon: "📅",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition hover:border-[var(--accent)]">
              <div className="text-3xl">{item.icon}</div>
              <h3 className="mt-4 text-xl font-semibold text-[var(--accent)]">{item.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Professional footer CTA */}
      <div className="border-t border-[var(--border)] bg-[var(--surface)] py-10">
        <div className="mx-auto max-w-4xl px-6 text-center text-sm text-[var(--muted)]">
          Built for coaches who care about real progress.{" "}
          <span className="text-[var(--accent)]">The Train Station</span> — memberships, on-demand programs, and live sessions.
          <div className="mt-2">
            <Link href="/join" className="text-[var(--accent)] hover:underline">View membership &amp; payment options →</Link>
          </div>
          <div className="mt-3 text-xs">Greenfield rebuild at <code className="rounded bg-[var(--surface-2)] px-1 py-px">~/projects/train-station</code></div>
        </div>
      </div>
    </div>
  );
}
