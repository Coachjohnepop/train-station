import Link from "next/link";
import type { WorkoutCatalogPreview } from "@/lib/exercise-catalog-preview-types";

function sectionLabel(section: string): string {
  if (section === "warmup") return "Warm-up";
  if (section === "cooldown") return "Cool-down";
  if (section === "notes") return "Note";
  return "Main";
}

function StatusBadge({ status }: { status: "matched" | "new" | "note" }) {
  if (status === "matched") {
    return (
      <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
        In library
      </span>
    );
  }
  if (status === "new") {
    return (
      <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
        New exercise
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
      Note block
    </span>
  );
}

export function ExerciseCatalogMatchSummary({
  preview,
  compact = false,
}: {
  preview: WorkoutCatalogPreview;
  compact?: boolean;
}) {
  const { matched, newCount, noteBlocks } = preview.summary;
  if (compact) {
    return (
      <p className="text-[10px] text-[var(--muted)]">
        <span className="text-emerald-300">{matched} in library</span>
        {newCount > 0 ? (
          <>
            {" "}
            · <span className="text-amber-300">{newCount} new on deploy</span>
          </>
        ) : null}
        {noteBlocks > 0 ? ` · ${noteBlocks} note${noteBlocks !== 1 ? "s" : ""}` : null}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs">
      <p className="font-semibold text-white">Exercise library check</p>
      <p className="mt-1 text-[var(--muted)]">
        <span className="text-emerald-300">{matched} already in your library</span>
        {newCount > 0 ? (
          <>
            {" "}
            ·{" "}
            <span className="text-amber-300">
              {newCount} will be added when you deploy
            </span>
          </>
        ) : (
          <> · nothing new will be created</>
        )}
        {noteBlocks > 0 ? ` · ${noteBlocks} note block${noteBlocks !== 1 ? "s" : ""}` : null}
      </p>
      {newCount > 0 ? (
        <p className="mt-1 text-[10px] text-amber-200/90">
          New exercises land in Admin → Exercises (tagged newly-added). Review names and add
          videos after deploy.
        </p>
      ) : null}
    </div>
  );
}

export default function ExerciseCatalogMatchList({
  preview,
  showSets,
  exercises,
}: {
  preview: WorkoutCatalogPreview;
  showSets?: boolean;
  exercises?: Array<{ name: string; sets: number; reps: string; notes?: string; section?: string }>;
}) {
  return (
    <div className="space-y-2">
      <ExerciseCatalogMatchSummary preview={preview} />
      <ul className="space-y-2 text-sm max-h-72 overflow-auto">
        {preview.rows.map((row, i) => {
          const ex = exercises?.[i];
          return (
            <li key={`${row.parsedName}-${i}`} className="border-b border-[var(--border)] pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{row.parsedName}</span>
                  {showSets && ex ? (
                    <span className="text-[var(--muted)]">
                      {" "}
                      · {ex.sets} set{ex.sets !== 1 ? "s" : ""} · {ex.reps}
                    </span>
                  ) : null}
                  <p className="text-[10px] text-[var(--muted)]">{sectionLabel(row.section)}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              {row.status === "matched" && row.catalogName ? (
                <p className="mt-1 text-[10px] text-emerald-200/90">
                  Links to library: <strong>{row.catalogName}</strong>
                  {row.nameDiffers ? " (name normalized from your text)" : null}
                  {!row.hasVideo ? " · no video yet" : null}
                </p>
              ) : null}
              {row.status === "new" ? (
                <p className="mt-1 text-[10px] text-amber-200/90">
                  No close match — we will create a new library exercise on deploy.
                </p>
              ) : null}
              {ex?.notes ? (
                <p className="mt-1 text-[10px] text-[var(--muted)]">{ex.notes}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function NewExerciseReviewLink({
  count,
  className = "inline-block text-xs font-medium text-accent hover:underline",
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <Link href="/admin/exercises?tab=newly-added" className={className}>
      Review {count} newly added exercise{count !== 1 ? "s" : ""} →
    </Link>
  );
}