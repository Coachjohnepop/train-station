import Link from "next/link";
import { DAY_LABELS } from "@/lib/program-constants";
import ScheduleJumpLink from "@/components/ScheduleJumpLink";

type Program = {
  slug: string;
  name?: string;
  weeks: Array<{
    id: string;
    weekNumber: number;
    days: Array<{
      id: string;
      dayNumber: number;
      workoutId?: string;
      notes?: string | null;
      videoUrl?: string | null;
      smsOverrideActive?: boolean;
      smsWorkoutText?: string;
      smsOverrideLabel?: string;
      replacesLiveSession?: boolean;
      workout?: { id: string; name: string } | null;
      options?: Array<{
        workoutId: string;
        label?: string;
        workout?: { id: string; name: string } | null;
      }>;
    }>;
  }>;
  category?: string;
};

type Props = {
  program: Program;
  curWeek: number;
  curDay: number;
  loggedWorkoutIds: string[];
  idPrefix?: string;
  showThisWeek?: boolean;
  showFullSchedule?: boolean;
  compact?: boolean;
};

function DayCards({
  program,
  week,
  curWeek,
  curDay,
  loggedSet,
  isWorkout,
  isJourney,
  cat,
  compact,
}: {
  program: Program;
  week: Program["weeks"][number];
  curWeek: number;
  curDay: number;
  loggedSet: Set<string>;
  isWorkout: boolean;
  isJourney: boolean;
  cat: string;
  compact?: boolean;
}) {
  const gridClass = compact
    ? "mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:grid-cols-7"
    : "mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7";

  return (
    <ul className={gridClass}>
      {week.days
        .sort((a, b) => a.dayNumber - b.dayNumber)
        .map((day) => {
          const label = DAY_LABELS[day.dayNumber - 1] ?? `Day ${day.dayNumber}`;
          const isCurrentDay = week.weekNumber === curWeek && day.dayNumber === curDay;
          const anchorId = `w${week.weekNumber}-d${day.dayNumber}`;

          if (isWorkout) {
            if (day.smsOverrideActive && day.smsWorkoutText) {
              return (
                <li key={day.id} id={anchorId} className={`space-y-1 scroll-mt-24 ${isCurrentDay ? "ring-2 ring-accent/50 rounded-lg p-0.5" : ""}`}>
                  <div className="text-[10px] lg:text-xs text-[var(--muted)] truncate pl-1">
                    {label}
                    {isCurrentDay && <span className="ml-1 text-accent font-medium">· today</span>}
                  </div>
                  <Link
                    href={`/member/workout?program=${encodeURIComponent(program.slug)}&smsDay=${encodeURIComponent(day.id)}`}
                    className="card flex flex-col gap-2 p-2 lg:p-3 transition hover-accent-border text-sm border-amber-400/50 bg-amber-500/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-amber-200">{day.smsOverrideLabel || "Coach SMS workout"}</p>
                      <span className="text-[10px] rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">SMS</span>
                    </div>
                    {!compact && (
                      <p className="text-xs text-[var(--muted)] line-clamp-3 whitespace-pre-wrap">{day.smsWorkoutText}</p>
                    )}
                    <span className="text-xs font-medium text-accent">Open →</span>
                  </Link>
                </li>
              );
            }

            const opts =
              day.options && day.options.length > 0
                ? day.options
                : day.workout
                  ? [{ workoutId: day.workout.id, label: "Standard", workout: day.workout }]
                  : [];

            if (opts.length === 0) return null;

            const hasLoggedOption =
              opts.some((o) => loggedSet.has(o.workoutId)) ||
              (day.workoutId && loggedSet.has(day.workoutId));
            const dayDone = hasLoggedOption;

            return (
              <li key={day.id} id={anchorId} className={`space-y-1 scroll-mt-24 ${isCurrentDay ? "ring-2 ring-accent/50 rounded-lg p-0.5" : ""}`}>
                <div className="text-[10px] lg:text-xs text-[var(--muted)] truncate pl-1">
                  {label}
                  {isCurrentDay && <span className="ml-1 text-accent font-medium">· today</span>}
                </div>

                {opts.map((opt, idx) => {
                  const w = opt.workout || day.workout;
                  if (!w) return null;
                  const wid = opt.workoutId || w.id;
                  const isThisSessionDone = loggedSet.has(wid);
                  const isHome = /home/i.test(opt.label || "");
                  const weekDayLabel = `W${week.weekNumber} · D${day.dayNumber}`;
                  const displayName =
                    (opts.length > 1 ? `${opt.label}: ` : "") +
                    w.name.replace(/ \(Home\)| \(Gym\)/i, "").replace(/^Day \d+\s*/i, `${weekDayLabel} · `);

                  return (
                    <Link
                      key={idx}
                      href={`/member/workout?workoutId=${encodeURIComponent(wid)}&program=${encodeURIComponent(program.slug)}${opt.label ? `&option=${encodeURIComponent(opt.label)}` : ""}${isThisSessionDone ? "&review=true" : ""}`}
                      className={`card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-1 lg:gap-3 p-2 lg:p-3 transition hover-accent-border text-sm ${
                        isThisSessionDone
                          ? "ring-2 ring-[var(--success)] ring-offset-1 bg-[var(--success)]/5"
                          : dayDone
                            ? "border-[var(--success)]/30"
                            : ""
                      } ${isHome ? "border-blue-300 bg-blue-50/30" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium truncate ${compact ? "text-xs" : ""}`} title={displayName}>
                          {displayName} {isHome && <span className="text-[10px] text-blue-600">(Home)</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap">
                        {isThisSessionDone && (
                          <span
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--success)] text-white text-[9px]"
                            aria-label="You did this session"
                          >
                            ✓
                          </span>
                        )}
                        <span
                          className={
                            isThisSessionDone
                              ? "text-[var(--success)] font-medium"
                              : dayDone
                                ? "text-[var(--success)]"
                                : "text-accent"
                          }
                        >
                          {isThisSessionDone ? "Done" : dayDone ? "Review" : "Start →"}
                        </span>
                      </div>
                    </Link>
                  );
                })}

                {!compact && program.slug === "adult" && (
                  <div className={`text-[9px] mt-0.5 pl-1 ${dayDone ? "ring-1 ring-[var(--success)] p-1 rounded bg-[var(--success)]/5" : ""}`}>
                    {dayDone ? (
                      <span className="text-[var(--success)] font-medium">
                        ✓ John &amp; Steph recording followed
                      </span>
                    ) : (
                      <Link
                        href={`/member/workout?program=${program.slug}&subJourney=john-steph&subDay=${day.dayNumber}`}
                        className="text-accent hover:underline"
                      >
                        or John &amp; Steph recording (day {day.dayNumber}) →
                      </Link>
                    )}
                  </div>
                )}
              </li>
            );
          }

          if (isJourney) {
            const journeyHref = `/member/journey?program=${encodeURIComponent(program.slug)}&day=${day.dayNumber}`;
            const title = day.notes || day.videoUrl ? "Recorded live session" : "Journey session";
            return (
              <li key={day.id} id={anchorId} className={`scroll-mt-24 ${isCurrentDay ? "ring-2 ring-accent/50 rounded-lg" : ""}`}>
                <Link
                  href={journeyHref}
                  className="card flex flex-col gap-1 p-2 transition hover-accent-border text-sm border-accent/30"
                >
                  <span className="text-[10px] text-[var(--muted)]">
                    {label}
                    {isCurrentDay && <span className="ml-1 text-accent font-medium">· today</span>}
                  </span>
                  <p className="font-medium truncate text-xs">▶ {title}</p>
                  <span className="text-xs text-accent">Watch →</span>
                </Link>
              </li>
            );
          }

          const promptHref = `/member/prompts?program=${encodeURIComponent(program.slug)}&day=${day.dayNumber}&cat=${cat}`;
          const title = day.notes || (cat === "eating" ? "Daily eating prompts" : "Yoga flow / session");
          const action = cat === "yoga" ? "Open" : "Start";
          return (
            <li key={day.id} id={anchorId} className={`scroll-mt-24 ${isCurrentDay ? "ring-2 ring-accent/50 rounded-lg" : ""}`}>
              <Link href={promptHref} className="card flex flex-col gap-1 p-2 transition hover-accent-border text-sm">
                <span className="text-[10px] text-[var(--muted)]">
                  {label}
                  {isCurrentDay && <span className="ml-1 text-accent font-medium">· today</span>}
                </span>
                <p className="font-medium truncate text-xs">{title}</p>
                <span className="text-xs text-accent">{action} →</span>
              </Link>
            </li>
          );
        })}
    </ul>
  );
}

export default function MemberProgramSchedule({
  program,
  curWeek,
  curDay,
  loggedWorkoutIds,
  idPrefix = "",
  showThisWeek = true,
  showFullSchedule = true,
  compact = false,
}: Props) {
  const loggedSet = new Set(loggedWorkoutIds);
  const cat = (program.category || "workout") as string;
  const isWorkout = cat === "workout";
  const isJourney = cat === "journey";
  const currentWeek = program.weeks.find((w) => w.weekNumber === curWeek);
  const fullScheduleId = `${idPrefix}full-schedule`;
  const weekDetailsId = (weekNumber: number) => `${idPrefix}week-${weekNumber}`;

  return (
    <div className="space-y-4">
      {showThisWeek && currentWeek && (
        <section className="card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">This week</h2>
              <span className="text-xs text-[var(--muted)]">
                Week {curWeek} · Day {curDay} ({DAY_LABELS[curDay - 1] ?? `Day ${curDay}`})
              </span>
            </div>
            {showFullSchedule && (
              <ScheduleJumpLink
                week={curWeek}
                day={curDay}
                fullScheduleId={fullScheduleId}
                weekDetailsId={weekDetailsId(curWeek)}
                label="Jump to today"
              />
            )}
          </div>
          <p className="text-[10px] text-[var(--muted)] mb-2">
            Your current week at a glance. Expand the full schedule below when you need past or future days.
          </p>
          <DayCards
            program={program}
            week={currentWeek}
            curWeek={curWeek}
            curDay={curDay}
            loggedSet={loggedSet}
            isWorkout={isWorkout}
            isJourney={isJourney}
            cat={cat}
            compact={compact}
          />
        </section>
      )}

      {showFullSchedule && (
        <details id={fullScheduleId} className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-semibold uppercase tracking-wide text-[var(--muted)] group-open:text-white transition mb-2">
            <span className="text-xs text-accent group-open:rotate-90 transition-transform">▶</span>
            Full program schedule
            <span className="text-[10px] normal-case font-normal text-[var(--muted)]">
              ({program.weeks.length} weeks)
            </span>
          </summary>
          <div className="space-y-4 pl-1">
            {program.weeks.map((week) => {
              const isCurrentWeek = week.weekNumber === curWeek;
              return (
                <details
                  key={week.id}
                  id={weekDetailsId(week.weekNumber)}
                  className="group/week"
                  open={isCurrentWeek}
                >
                  <summary className="text-sm font-semibold uppercase tracking-wide text-accent cursor-pointer list-none flex items-center gap-2 hover:text-white transition">
                    <span className="group-open/week:rotate-90 transition-transform text-xs">▶</span>
                    Week {week.weekNumber}
                    {isCurrentWeek && (
                      <span className="text-[10px] normal-case font-normal text-accent/80">(current)</span>
                    )}
                  </summary>
                  <DayCards
                    program={program}
                    week={week}
                    curWeek={curWeek}
                    curDay={curDay}
                    loggedSet={loggedSet}
                    isWorkout={isWorkout}
                    isJourney={isJourney}
                    cat={cat}
                    compact={false}
                  />
                </details>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}