import Link from "next/link";
import type { CoachDayPlan } from "@/lib/coach-day";

function typeBadge(type: "sms-workout" | "live-booking") {
  if (type === "sms-workout") {
    return (
      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300">
        Text upload
      </span>
    );
  }
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-sky-500/20 text-sky-300">
      Live session
    </span>
  );
}

export default function CoachDayView({ day, dateQuery }: { day: CoachDayPlan; dateQuery: string }) {
  const hasTimeline = day.timeline.length > 0;

  return (
    <div className="space-y-4">
      <details className="group card" open>
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
          <span className="text-accent group-open:rotate-90 transition-transform text-xs">▶</span>
          Your day
          <span className="text-xs font-normal text-[var(--muted)]">
            {day.assignedCount} assigned · {day.openCount} open
          </span>
        </summary>

        <div className="mt-4 space-y-6">
          {!hasTimeline ? (
            <p className="text-sm text-[var(--muted)]">
              Nothing scheduled yet — assign students above and use Text Upload, or add a booking.
            </p>
          ) : (
            <ol className="relative space-y-0 border-l border-[var(--border)] ml-3 pl-6">
              {day.timeline.map((item, idx) => (
                <li key={item.id} className={`relative pb-6 ${idx === day.timeline.length - 1 ? "pb-0" : ""}`}>
                  <span className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full border-2 border-accent bg-[var(--surface)]" />
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-accent font-semibold">{item.timeLabel}</span>
                      {typeBadge(item.type)}
                      {item.status && <span className="text-[var(--muted)] capitalize">{item.status}</span>}
                    </div>
                    <p className="mt-2 font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.memberNames.join(" · ")}</p>

                    {item.exercisePreview.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {item.exercisePreview.map((ex) => (
                          <li
                            key={ex}
                            className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[10px] text-[var(--muted)]"
                          >
                            {ex}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.memberIds.length > 0 ? (
                        <Link
                          href={`/admin/live?date=${dateQuery}`}
                          className="btn-primary px-3 py-1 text-xs"
                        >
                          Open Live Floor
                          {item.memberIds.length > 1 ? ` · ${item.memberIds.length}` : ""}
                        </Link>
                      ) : (
                        <Link href={item.coachHref} className="btn-primary px-3 py-1 text-xs">
                          Open workout
                        </Link>
                      )}
                      {item.memberIds.length <= 1
                        ? item.checkoffHrefs.map((c) => (
                            <Link key={c.memberId} href={c.href} className="btn-ghost px-3 py-1 text-xs">
                              Check off · {c.name}
                            </Link>
                          ))
                        : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div>
            <p className="text-xs font-semibold text-accent mb-3">Your students</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {day.students.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-lg border p-3 text-sm ${
                    s.assigned
                      ? "border-accent/40 bg-accent/5"
                      : "border-[var(--border)] bg-[var(--surface)] opacity-80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{s.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        s.assigned ? "bg-accent/20 text-accent" : "bg-[var(--surface-2)] text-[var(--muted)]"
                      }`}
                    >
                      {s.assigned ? "Assigned" : "Open"}
                    </span>
                  </div>
                  {s.assigned && s.workoutTitle ? (
                    <>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {s.timeLabel} · {s.workoutTitle}
                      </p>
                      {s.exercisePreview.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-[10px] text-[var(--muted)]">
                          {s.exercisePreview.slice(0, 3).map((ex) => (
                            <li key={ex}>· {ex}</li>
                          ))}
                        </ul>
                      )}
                      {s.checkoffHref && (
                        <Link href={s.checkoffHref} className="mt-2 inline-block text-xs text-accent hover:underline">
                          Check off sets →
                        </Link>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--muted)]">No workout assigned for this date.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      {day.sessions.length > 0 && (
        <p className="text-[10px] text-[var(--muted)]">
          {day.sessions.length} workout{day.sessions.length !== 1 ? "s" : ""} persisted (Vercel Blob + JSON)
        </p>
      )}
    </div>
  );
}