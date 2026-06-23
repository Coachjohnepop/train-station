"use client";

import { useState } from "react";
import ExportSeedButton from "@/components/ExportSeedButton";
import ProgramCalendarBuilder from "@/components/ProgramCalendarBuilder";
import ProgramNameEditor from "@/components/ProgramNameEditor";

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

type Program = {
  id: string;
  slug: string;
  name: string;
  durationWeeks: number;
  startDate?: string | null;
  weeks: { id: string; weekNumber: number; days: ProgramDay[] }[];
};

export default function ProgramAdminClient({
  program: initial,
  workouts,
}: {
  program: Program;
  workouts: WorkoutOption[];
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
      <p className="mt-1 text-[10px] text-[var(--muted)]">
        When content is final, export seed snapshot and commit{" "}
        <code className="rounded bg-[var(--surface-2)] px-1">prisma/seed-data.json</code> so it
        ships with the next deploy.
      </p>

      <div className="mt-3">
        <ProgramCalendarBuilder
          program={{ ...initial, name: programName }}
          workouts={workouts}
        />
      </div>
    </>
  );
}