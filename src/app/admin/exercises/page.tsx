import { Suspense } from "react";
import ExerciseLibrary from "@/components/ExerciseLibrary";

export default function ExercisesAdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Exercise library</h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        A simple catalog of movement names and demo videos. Program each
        exercise when you add it to a workout.
      </p>

      <div className="mt-6 max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm">
        <p className="font-medium">How to add YouTube demo videos</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--muted)]">
          <li>Open the video on YouTube (phone or desktop) and tap <strong className="text-[var(--text)]">Share → Copy link</strong>.</li>
          <li>Find the exercise in the table below — use search if the list is long.</li>
          <li>Paste into the <strong className="text-[var(--text)]">Video</strong> column and click <strong className="text-[var(--text)]">Add</strong> (or Update).</li>
        </ol>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Works with regular links, Shorts, and{" "}
          <code className="rounded bg-[var(--surface)] px-1">youtu.be/…</code> short links. Members see the
          video in their workout console when they tap the exercise.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Landing page &amp; welcome clips:{" "}
          <a href="/admin/landing" className="text-accent hover:underline">
            Admin → Landing videos
          </a>
          . Program day videos: edit the day in Programs.
        </p>
      </div>

      <div className="mt-8">
        <Suspense
          fallback={<p className="text-sm text-[var(--muted)]">Loading exercise library…</p>}
        >
          <ExerciseLibrary />
        </Suspense>
      </div>
    </div>
  );
}