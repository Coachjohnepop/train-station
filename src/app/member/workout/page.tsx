import Link from "next/link";
import MemberWorkoutConsole from "@/components/MemberWorkoutConsole";
import { getDemoMemberWorkout } from "@/lib/demo-workout";
import { getMemberWorkoutById } from "@/lib/member-workout";

type Props = {
  searchParams: Promise<{ workoutId?: string; program?: string }>;
};

export const dynamic = "force-dynamic";

export default async function MemberWorkoutPage({ searchParams }: Props) {
  const { workoutId, program } = await searchParams;

  const workout = workoutId
    ? await getMemberWorkoutById(workoutId)
    : await getDemoMemberWorkout();

  const backHref = program ? `/member/programs/${program}` : "/member";
  const backLabel = program ? "← Back to program" : "← Dashboard";

  return (
    <div>
      <Link href={backHref} className="text-xs text-accent hover:underline">
        {backLabel}
      </Link>

      {workout ? (
        <div className="-mx-4 mt-4">
          <MemberWorkoutConsole
            workout={workout}
            backHref={backHref}
            backLabel={backLabel}
            programSlug={program}
          />
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