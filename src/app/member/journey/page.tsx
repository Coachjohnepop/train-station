import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramBySlug } from "@/lib/program-data";
import { getMemberDashboard } from "@/lib/member-context";

async function markWatchedAction(slug: string, dayNum: number) {
  'use server';
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/programs/${slug}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day: dayNum }),
  });
}

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ program?: string; day?: string }>;
};

function getYoutubeEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  // support youtu.be and youtube.com/watch?v= and /embed/
  const m = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
  if (m && m[1]) {
    return `https://www.youtube.com/embed/${m[1]}`;
  }
  return null;
}

export default async function MemberJourneyPage({ searchParams }: Props) {
  const { program: slug, day: dayStr = "1" } = await searchParams;
  if (!slug) notFound();

  const dashboard = await getMemberDashboard();
  const program = await getProgramBySlug(slug);
  if (!dashboard || !program) notFound();

  const dayNum = Math.max(1, Math.min(7, parseInt(dayStr, 10) || 1));
  const isEnrolled = dashboard.enrollments.some((e) => e.program.slug === slug);

  const allDays = program.weeks.flatMap((w: any) => w.days);
  const day = allDays.find((d: any) => d.dayNumber === dayNum) || { notes: "Watch the recorded session.", videoUrl: null };

  const embedUrl = getYoutubeEmbed(day.videoUrl);
  const title = day.notes || "Recorded Live Session";

  return (
    <div className="max-w-3xl mx-auto">
      <Link href={`/member/programs/${slug}`} className="text-xs text-accent hover:underline">
        ← Back to {program.name}
      </Link>

      <h1 className="mt-3 text-2xl font-bold">Journey Session — Day {dayNum}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">{program.name} • Longer 30-40 min recorded live sessions. Watch the full video + follow the session-specific checklist below (custom to the recording). These are substitutable into matching workout days.</p>

      {!isEnrolled && (
        <div className="mt-4 p-3 rounded border border-accent bg-accent-muted text-sm">
          Enroll to track your watched sessions and substitute into workouts.
        </div>
      )}

      <div className="mt-6 card">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        {day.videoUrl && (
          <p className="text-xs text-[var(--muted)] mb-3">YouTube: <a href={day.videoUrl} target="_blank" className="underline">{day.videoUrl}</a></p>
        )}

        {embedUrl ? (
          <div className="relative w-full pb-[56.25%] bg-black rounded overflow-hidden">
            <iframe
              src={embedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        ) : (
          <div className="p-8 text-center text-[var(--muted)] border border-dashed rounded">
            No video linked for this session yet. (Admin can add YouTube URL to the day in seed or editor.)
          </div>
        )}

        {/* Checklist / follow-along for the long recording */}
        {day.notes && (
          <div className="mt-4">
            <h3 className="font-semibold text-sm mb-1">Follow-along checklist for this recording</h3>
            <p className="text-[10px] text-[var(--muted)] mb-2">This checklist is specific to what this 30-40 min video covers (it may vary from standard workouts based on the session's exercises and flow). Watch the full video and follow these steps.</p>
            <ul className="list-disc pl-5 text-sm space-y-0.5">
              {day.notes
                .split(/[\n•;]+/)
                .map((s: string) => s.trim())
                .filter(Boolean)
                .map((step: string, i: number) => (
                  <li key={i}>{step}</li>
                ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={day.videoUrl || "#"}
            target="_blank"
            className="btn-primary text-sm"
          >
            Open on YouTube ↗
          </a>

          <form action={markWatchedAction.bind(null, slug, dayNum)}>
            <button
              type="submit"
              className="btn-ghost text-sm"
              disabled={!isEnrolled}
              title={isEnrolled ? "Mark watched and advance your journey day" : "Enroll first"}
            >
              Mark watched & advance day →
            </button>
          </form>

          <Link href={`/member/programs/${slug}`} className="text-sm text-accent hover:underline self-center">
            View full schedule
          </Link>
        </div>

        <p className="mt-3 text-[10px] text-[var(--muted)]">
          These are longer 30-40 minute recorded live sessions. Watch the full video and follow the session-specific checklist above. Mark watched when complete to advance this journey (independent of workout programs).
          Use these as substitutions for matching days in your workout programs (e.g. a leg day recording for an Adult leg day) — the video guides you while you log the day.
        </p>
      </div>

      <div className="mt-6 text-xs text-[var(--muted)]">
        Tip for substitution: While on a workout day (including hybrid Gym/Home options in Adult), look for the "follow the full John & Steph recording & checklist" link. The long video guides you; log via the day's exercise list below.
      </div>
    </div>
  );
}
