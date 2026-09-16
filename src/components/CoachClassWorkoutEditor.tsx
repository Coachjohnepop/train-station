"use client";

import { useEffect } from "react";
import WorkoutBuilder from "@/components/WorkoutBuilder";

/**
 * iPhone-first class editor: full-screen sheet over the floor so Jeremy is not
 * scrolling past Zoom + roster to add a swap mid-class.
 */
export default function CoachClassWorkoutEditor({
  open,
  workoutId,
  title,
  onClose,
  onSaved,
}: {
  open: boolean;
  workoutId: string;
  title: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-workout-editor-title"
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">
            Change class
          </p>
          <p id="class-workout-editor-title" className="truncate text-sm font-semibold">
            {title}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary min-h-11 shrink-0 px-4 text-sm font-bold"
          onClick={onClose}
        >
          Done
        </button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
        style={{
          paddingBottom:
            "calc(var(--app-bottom-nav-height, 4.5rem) + env(safe-area-inset-bottom, 0px) + 1rem)",
        }}
      >
        <p className="mb-3 text-sm text-[var(--muted)]">
          Swap, add, or remove a move. Everyone in this class gets it — their iPhones update in a
          few seconds if they stay on Today.
        </p>
        <WorkoutBuilder
          workoutId={workoutId}
          embedded
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}
