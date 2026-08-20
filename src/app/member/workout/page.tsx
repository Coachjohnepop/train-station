import Link from "next/link";
import MemberWorkoutConsole from "@/components/MemberWorkoutConsole";
import FloatingVideoPlayer from "@/components/FloatingVideoPlayer";
import SmsWorkoutView from "@/components/SmsWorkoutView";
import { getDemoMemberWorkout } from "@/lib/demo-workout";
import { getMemberWorkoutById } from "@/lib/member-workout";
import { resolveMemberProgramWorkout } from "@/lib/member-program-workout";
import { getCurrentUserLocation, resolveMemberUserId } from "@/lib/current-user";
import { getWeatherForLocation, logUserWeather } from "@/lib/weather";
import { getActiveScheduleOverride } from "@/lib/demo-schedule-overrides";
import { resolveMemberWorkoutContext } from "@/lib/member-workout-context";
import { resolveTargetUserId } from "@/lib/resolve-target-user";

type Props = {
  searchParams: Promise<{
    workoutId?: string;
    program?: string;
    subJourney?: string;
    subDay?: string;
    smsDay?: string;
    option?: string;
    date?: string;
    asInstructor?: string;
    forUser?: string;
    review?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function MemberWorkoutPage({ searchParams }: Props) {
  const {
    workoutId,
    program,
    subJourney,
    subDay,
    smsDay,
    option,
    date,
    asInstructor,
    forUser,
    review,
  } = await searchParams;

  const smsOverride = smsDay ? getActiveScheduleOverride(smsDay) : null;

  let workout = workoutId ? await getMemberWorkoutById(workoutId) : null;

  // /member/workout?program=adult → current enrollment week/day (not generic preview shell)
  if (!workout && program) {
    const uid = await resolveMemberUserId();
    const resolved = await resolveMemberProgramWorkout(program, uid);
    if (resolved) {
      workout = await getMemberWorkoutById(resolved.workoutId);
    }
  }

  if (!workout && !workoutId && !program) {
    workout = await getDemoMemberWorkout();
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

  const memberUserId = resolveTargetUserId(forUser, await resolveMemberUserId());

  const workoutContext = program
    ? await resolveMemberWorkoutContext({
        programSlug: program,
        dateParam: date,
        optionLabel: option,
        userId: memberUserId,
      })
    : null;

  const backHref = "/member/today";
  const backLabel = program ? "← Back to program" : "← Dashboard";

  // Location + current weather for the member (from onboarding cookies or DB)
  // Used to show in console and for instructor context. Also logged for historical reference.
  const memberLocation = await getCurrentUserLocation();
  let currentWeather = null;
  if (memberLocation.city && memberLocation.state) {
    currentWeather = await getWeatherForLocation(memberLocation.city, memberLocation.state);
    // Log for the (demo or target) user so instructor has context of conditions during the session
    const effectiveUser = forUser || "demo-user";
    await logUserWeather(effectiveUser, memberLocation, currentWeather);
  }

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

      {smsOverride ? (
        <SmsWorkoutView
          title={smsOverride.label || `Week ${smsOverride.weekNumber ?? ""} Day ${smsOverride.dayNumber ?? ""}`.trim()}
          body={smsOverride.smsWorkoutText}
          programSlug={program || smsOverride.programSlug || "adult"}
          replacesLiveSession={smsOverride.replacesLiveSession}
        />
      ) : workout ? (
        <div className="-mx-4 mt-4">
          {asInstructor && (
            <div className="mx-4 mb-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <strong>Instructor Coaching Mode</strong> — Checking off exercises on behalf of the member. 
              Progress and logs will be attributed to them. {forUser && `(User: ${forUser})`}
            </div>
          )}
          {workoutContext && (
            <div className="mx-4 mb-2 rounded border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
              <p className="font-medium">{workoutContext.calendarDateLabel}</p>
              {workoutContext.scheduleLabel && (
                <p className="text-xs text-[var(--muted)]">{workoutContext.scheduleLabel}</p>
              )}
              {workoutContext.dayOptionNotes && (
                <p className="mt-2 text-sm text-[var(--text)]">{workoutContext.dayOptionNotes}</p>
              )}
            </div>
          )}
          {option && (
            <div className="px-4 mb-2 text-xs text-[var(--muted)]">Option selected: <strong>{option}</strong> (home or gym version)</div>
          )}

          {/* Weather for the client's training area — visible to member and to instructor in coaching mode.
              Logged on page load so historical conditions are available for review/adjustments (e.g. snow vs sunny, outdoor recommendations). */}
          {(currentWeather || memberLocation) && (
            <div className="mx-4 mb-3 rounded border border-sky-500/30 bg-sky-500/10 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">
                  Weather in {currentWeather?.city || memberLocation?.city || "your area"}, {currentWeather?.state || memberLocation?.state || ""}
                  {currentWeather && (
                    <span className="ml-2 font-normal text-[var(--muted)]">
                      {currentWeather.temperature}°F • {currentWeather.condition} • {currentWeather.windSpeed} mph wind
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-sky-600 shrink-0">📍 client location</span>
              </div>
              {asInstructor && currentWeather && (
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Coach tip: glance here to adjust (e.g. “It’s snowing there — let’s do those walking lunges inside today”).
                </p>
              )}
            </div>
          )}

          <MemberWorkoutConsole
            workout={workout}
            backHref={backHref}
            backLabel={backLabel}
            programSlug={program}
            targetUserId={memberUserId}
            instructorName={asInstructor ? "Instructor" : undefined}
            reviewMode={!!review}
            calendarDateLabel={workoutContext?.calendarDateLabel}
            scheduleLabel={workoutContext?.scheduleLabel}
            liveSyncUserId={memberUserId}
            liveSessionDate={date}
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