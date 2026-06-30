"use client";

import TodaySessionPanel from "@/components/TodaySessionPanel";
import type { CoachMemberOption } from "@/components/CoachMemberPicker";

export default function CoachAssignWorkout({
  memberOptions,
}: {
  memberOptions: CoachMemberOption[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <TodaySessionPanel
      asInstructor
      programSlug="adult"
      memberOptions={memberOptions}
      defaultUserIds={memberOptions.map((m) => m.id)}
      defaultDate={today}
      defaultTime="06:30"
      collapsible={false}
      defaultAssignOpen
      defaultOpen
      showQuickDates
    />
  );
}