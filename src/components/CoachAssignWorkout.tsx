"use client";

import TodaySessionPanel from "@/components/TodaySessionPanel";
import type { CoachMemberOption } from "@/components/CoachMemberPicker";
import { localTodayIso } from "@/lib/program-calendar";

export default function CoachAssignWorkout({
  memberOptions,
}: {
  memberOptions: CoachMemberOption[];
}) {
  const today = localTodayIso();

  return (
    <TodaySessionPanel
      asInstructor
      programSlug="adult"
      memberOptions={memberOptions}
      defaultUserIds={[]}
      defaultDate={today}
      defaultTime="06:30"
      collapsible={false}
      defaultAssignOpen
      defaultOpen
      showQuickDates
    />
  );
}