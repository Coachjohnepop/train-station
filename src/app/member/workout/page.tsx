import Link from "next/link";
import MemberWorkoutConsole from "@/components/MemberWorkoutConsole";
import FloatingVideoPlayer from "@/components/FloatingVideoPlayer";
import { getDemoMemberWorkout } from "@/lib/demo-workout";
import { getMemberWorkoutById } from "@/lib/member-workout";

type Props = {
  searchParams: Promise<{ workoutId?: string; program?: string; subJourney?: string; subDay?: string; option?: string; asInstructor?: string; forUser?: string; review?: string }>;
};

export const dynamic = "force-dynamic";

export default async function MemberWorkoutPage({ searchParams }: Props) {
  const { workoutId, program, subJourney, subDay, option, asInstructor, forUser, review } = await searchParams;

  let workout = workoutId
    ? await getMemberWorkoutById(workoutId)
    : await getDemoMemberWorkout();

  // Support reminder links: /member/workout?program=adult  -> resolve today's workout from enrollment
  if (!workout && program) {
    // In real: look up user's current enrollment for program, find the ProgramDay for currentWeek/currentDay, get its workoutId
    // For demo: use the first workout in the program or a known one
    const { listPrograms } = await import("@/lib/program-data");
    const progs = await listPrograms();
    const prog = progs.find((p: any) => p.slug === program);
    if (prog && prog.weeks?.[0]?.days?.[0]?.workoutId) {
      const demoWorkoutId = prog.weeks[0].days[0].workoutId; // fallback to day 1 for demo
      workout = await getMemberWorkoutById(demoWorkoutId);
    }
  }

  // Substitution support: if subJourney & subDay, load the journey day video for following along (sub into this workout)
  let subVideoUrl: string | null = null;
  let subTitle: string | null = null;
  if (subJourney) {
    const { getProgramBySlug } = await import("@/lib/program-data");
    const jprog = await getProgramBySlug(subJourney);
    if (jprog) {
      const dnum = parseInt(subDay || "1", 10) || 1;
      const jday = jprog.weeks.flatMap((w: any) => w.days).find((d: any) => d.dayNumber === dnum);
      if (jday?.videoUrl) {
        subVideoUrl = jday.videoUrl;
        subTitle = jday.notes || `Journey day ${dnum} from ${jprog.name}`;
      }
    }
  }

  const backHref = program ? `/member/programs/${program}` : "/member";
  const backLabel = program ? "← Back to program" : "← Dashboard";

  return (
    <div>
      <Link href={backHref} className="text-xs text-accent hover:underline">
        {backLabel}
      </Link>

      {subVideoUrl && (
        <>
          <div className="mt-4 p-4 rounded border border-accent bg-accent-muted text-sm">
            <div className="font-semibold">Substituting journey recording:</div>
            <div className="text-xs text-[var(--muted)]">{subTitle}</div>
            <p className="mt-1 text-[10px] text-[var(--muted)]">
              A floating player has opened with the recording. <strong>Drag the title bar</strong> to move the video aside so you can see and use the full workout checklist below while following along. 
              The exercises may vary slightly from the recording.
            </p>
          </div>

          {/* Draggable / movable video player for following the checklist */}
          <FloatingVideoPlayer
            videoUrl={subVideoUrl}
            title={subTitle || "John & Steph recording"}
            onClose={() => { /* stays open while sub active; drag aside or use the X to temporarily hide */ }}
            initialPosition={{ x: 620, y: 140 }}
          />
        </>
      )}

      {workout ? (
        <div className="-mx-4 mt-4">
          {asInstructor && (
            <div className="mx-4 mb-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <strong>Instructor Coaching Mode</strong> — Checking off exercises on behalf of the member. 
              Progress and logs will be attributed to them. {forUser && `(User: ${forUser})`}
            </div>
          )}
          {option && (
            <div className="px-4 mb-2 text-xs text-[var(--muted)]">Option selected: <strong>{option}</strong> (home or gym version)</div>
          )}
          <MemberWorkoutConsole
            workout={workout}
            backHref={backHref}
            backLabel={backLabel}
            programSlug={program}
            targetUserId={asInstructor ? "demo-user" : undefined}
            instructorName={asInstructor ? "Instructor" : undefined}
            reviewMode={!!review}
          />

          {/* Eating report visible to coach while doing the live workout coaching (coming soon - temporarily disabled) */}
          {/* {asInstructor && studentEatingReport && ( ... removed ... )} */}
        </div>
      ) : (
        <>
          <h1 className="mt-3 text-2xl font-bold">Workout not found</h1>
          <p className="mt-4 text-center text-[var(--muted)]">
            {workoutId
              ? "This workout is missing or has no exercises yet."
              : "Run npm run db:seed to load a sample workout."}
          </p>
          <Link href={backHref} className="btn-ghost mt-6 inline-flex text-sm">
            {backLabel}
          </Link>
        </>
      )}
    </div>
  );
}