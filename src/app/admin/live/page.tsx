import CoachLiveFloor from "@/components/CoachLiveFloor";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export default async function AdminLiveFloorPage({ searchParams }: Props) {
  const sp = await searchParams;
  const todayKey = new Date().toISOString().slice(0, 10);
  const sessionDate = sp.date || todayKey;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Live Floor</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tap a student to check off sets. Big tiles, one thumb — built for the gym floor.
        </p>
      </div>
      <CoachLiveFloor initialDate={sessionDate} />
    </div>
  );
}