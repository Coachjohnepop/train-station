"use client";

import { useState } from "react";
import ExportSeedButton from "@/components/ExportSeedButton";
import ProgramCalendarBuilder from "@/components/ProgramCalendarBuilder";
import ProgramNameEditor from "@/components/ProgramNameEditor";
import type { CoachContentAlert } from "@/lib/coach-content-alerts";

type WorkoutOption = { id: string; name: string };

type ProgramDay = {
  id: string;
  dayNumber: number;
  workoutId: string | null;
  calendarDate?: string | null;
  defaultSets?: number | null;
  defaultReps?: string | null;
  defaultRestSec?: number | null;
  publishedAt?: string | null;
  videoUrl?: string | null;
  options?: { workoutId: string; label: string }[];
};

type MacroPhase = {
  phaseIndex: number;
  name: string;
  minWeeks: number;
  maxWeeks: number;
};

type Program = {
  id: string;
  slug: string;
  name: string;
  durationWeeks: number;
  startDate?: string | null;
  macroPhases?: MacroPhase[];
  weeks: {
    id: string;
    weekNumber: number;
    macroPhaseIndex?: number;
    phaseWeekNumber?: number;
    days: ProgramDay[];
  }[];
};

export default function ProgramAdminClient({
  program: initial,
  workouts,
  contentAlert = null,
}: {
  program: Program;
  workouts: WorkoutOption[];
  contentAlert?: CoachContentAlert | null;
}) {
  const [programName, setProgramName] = useState(initial.name);

  return (
    <>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <ProgramNameEditor
            slug={initial.slug}
            initialName={programName}
            onSaved={setProgramName}
          />
          <span className="text-[10px] text-[var(--muted)]">
            {initial.durationWeeks} weeks · calendar starts Monday
          </span>
        </div>
        <ExportSeedButton className="text-xs" />
      </div>

      {initial.macroPhases && initial.macroPhases.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {initial.macroPhases.map((phase) => (
            <span
              key={phase.phaseIndex}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[10px] text-[var(--muted)]"
            >
              <span className="font-medium text-[var(--text)]">{phase.name}</span>
              {" · "}
              {phase.minWeeks === phase.maxWeeks
                ? `${phase.maxWeeks} wk`
                : `${phase.minWeeks}–${phase.maxWeeks} wk`}
            </span>
          ))}
        </div>
      )}
      <p className="mt-1 text-[10px] text-[var(--muted)]">
        When content is final, export seed snapshot and commit{" "}
        <code className="rounded bg-[var(--surface-2)] px-1">prisma/seed-data.json</code> so it
        ships with the next deploy.
      </p>

      <div className="mt-3">
        <ProgramCalendarBuilder
          program={{ ...initial, name: programName }}
          workouts={workouts}
          contentAlert={contentAlert}
        />
      </div>
    </>
  );
}