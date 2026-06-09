import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramBySlug } from "@/lib/program-data";
import { getMemberDashboard } from "@/lib/member-context";
import PromptLogger from "@/components/PromptLogger";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ program?: string; day?: string; cat?: string; asInstructor?: string; forUser?: string }>;
};

export default async function MemberPromptsPage({ searchParams }: Props) {
  const { program: slug, day: dayStr = "1", cat = "eating", asInstructor, forUser } = await searchParams;
  if (!slug) notFound();

  const dashboard = await getMemberDashboard();
  const program = await getProgramBySlug(slug);
  if (!dashboard || !program) notFound();

  // Eating temporarily disabled (coming soon)
  if (cat === "eating") {
    return (
      <div className="max-w-2xl mx-auto">
        <Link href={`/member/programs/${slug}`} className="text-xs text-accent hover:underline">
          ← Back to {program.name}
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Eating Approaches — Coming Soon</h1>
        <div className="mt-6 card">
          <p className="text-lg">Eating Approaches are coming soon.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">This will be a simple daily report (not a scheduled workout with gym/home options). Members will be able to log meals, protein targets, etc. Coaches will be able to review the reports while coaching live sessions.</p>
        </div>
      </div>
    );
  }

  const dayNum = Math.max(1, Math.min(7, parseInt(dayStr, 10) || 1));
  const isEnrolled = dashboard.enrollments.some((e) => e.program.slug === slug);
  const isCoachView = !!asInstructor;

  // Find the day's content (notes from seed or fallback)
  const allDays = program.weeks.flatMap((w: any) => w.days);
  const day = allDays.find((d: any) => d.dayNumber === dayNum) || { notes: "Complete today's prompts." };

  const prompts = (day.notes || "Log today's key metrics. Reflect on wins and adjustments.")
    .split(".")
    .map((s: string) => s.trim())
    .filter(Boolean)
    .slice(0, 5); // cascade steps

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/member/programs/${slug}`} className="text-xs text-accent hover:underline">
        ← Back to {program.name}
      </Link>

      <h1 className="mt-3 text-2xl font-bold">
        {cat === "eating" ? "Eating Prompts" : "Yoga / Channel Session"} — Day {dayNum}
      </h1>
      <p className="mt-1 text-sm text-[var(--muted)]">{program.name} • {cat === "eating" ? "Cascading daily prompts for consistency" : "Instructor channel content & practice log"}</p>

      {isCoachView && (
        <div className="mt-4 p-3 rounded border border-amber-500/30 bg-amber-500/10 text-sm">
          <strong>Instructor Coaching Mode</strong> — Checking off on behalf of the member. 
          {forUser && `(User: ${forUser})`}
        </div>
      )}

      {!isEnrolled && !isCoachView && (
        <div className="mt-4 p-3 rounded border border-accent bg-accent-muted text-sm">
          Enroll to save your prompt responses and track streaks.
        </div>
      )}

      <div className="mt-6 card">
        <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-2">Cascading prompts (complete in order)</p>
        <ol className="space-y-4">
          {prompts.length ? prompts.map((p: string, i: number) => (
            <li key={i} className="flex gap-3">
              <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-medium">{i + 1}</span>
              <div className="flex-1">
                <p className="text-sm">{p}{p.endsWith("?") || p.endsWith("!") ? "" : "."}</p>
                <div className="mt-2">
                  {i === 0 && <input className="input w-full" placeholder="e.g. 180g or 1-10" />}
                  {i === 1 && <textarea className="input w-full h-20" placeholder="Your notes..." />}
                  {i > 1 && <button className="btn-ghost text-xs">Mark complete</button>}
                </div>
              </div>
            </li>
          )) : (
            <li>Follow the plan for today. Log your session.</li>
          )}
        </ol>

        <div className="mt-6 flex gap-3">
          <PromptLogger programSlug={slug} day={dayNum} isCoachView={isCoachView} />
          <Link href={`/member/programs/${slug}`} className="btn-ghost">Back to schedule</Link>
        </div>
        <p className="mt-3 text-[10px] text-[var(--muted)]">Responses are private to the member. Instructors see aggregate adherence for coaching.</p>
      </div>

      {cat === "yoga" && (
        <div className="mt-6 text-xs text-[var(--muted)]">
          Yoga instructors: add your flows, live links, and custom prompts in the admin (category=yoga). Members subscribe/enroll to your channel.
        </div>
      )}
    </div>
  );
}
