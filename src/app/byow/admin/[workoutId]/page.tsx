import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessByowAdmin } from "@/lib/byow-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ByowAdminNotesPage({
  params,
}: {
  params: Promise<{ workoutId: string }>;
}) {
  const session = await getSessionUser();
  if (!canAccessByowAdmin(session)) redirect("/byow");
  const { workoutId } = await params;

  const workout = await prisma.byowWorkout.findUnique({
    where: { id: workoutId },
    include: {
      owner: { select: { name: true, email: true } },
      sourceNote: true,
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: { select: { name: true } } },
      },
    },
  });
  if (!workout) notFound();

  const raw = workout.sourceNote?.rawText ?? workout.exportText ?? "";
  const lines = raw.split("\n");

  return (
    <div className="space-y-6">
      <Link href="/byow/admin" className="text-xs text-accent hover:underline">
        ← All libraries
      </Link>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          Exact notes · coaching copy
        </p>
        <h1 className="mt-1 font-serif text-3xl">{workout.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {workout.owner.name || workout.owner.email}
          {workout.sourceNote?.filename ? ` · file ${workout.sourceNote.filename}` : ""}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">What they typed (line by line)</h2>
        <p className="text-xs text-[var(--muted)]">
          Unparsed original — this is the format they used, not our translation.
        </p>
        <ol className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[13px] leading-6">
          {lines.map((line, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-8 shrink-0 select-none text-right text-[10px] text-[var(--muted)]">
                {i + 1}
              </span>
              <span className="min-w-0 whitespace-pre-wrap break-words text-[var(--text)]">
                {line.length === 0 ? " " : line}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">How we read it</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {workout.exercises.map((ex) => (
            <li key={ex.id}>
              {ex.exercise.name}{" "}
              <span className="text-[var(--muted)]">
                {ex.sets ?? "?"} × {ex.reps ?? "—"}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <Link
        href={`/member/workout?byow=${encodeURIComponent(workout.id)}`}
        className="inline-flex text-sm text-accent hover:underline"
      >
        Open in console
      </Link>
    </div>
  );
}
