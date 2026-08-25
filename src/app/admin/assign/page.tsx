import Link from "next/link";
import CoachAssignWorkout from "@/components/CoachAssignWorkout";
import { listCoachMembersForUi } from "@/lib/sms";

export const dynamic = "force-dynamic";

export default async function AdminAssignWorkoutPage() {
  const coachMembers = (await listCoachMembersForUi()).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
  }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-accent">
          <Link href="/admin/today" className="hover:underline">
            Go to Today schedule
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Assign workout</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Paste coach SMS text, pick members and a date — today or any future day.
        </p>
      </div>

      <CoachAssignWorkout memberOptions={coachMembers} />
    </div>
  );
}