import { Suspense } from "react";
import AdminDailyActivityClient from "@/components/AdminDailyActivityClient";
import { isIsoDate, yesterdayIso } from "@/lib/daily-user-activity-format";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ date?: string }> };

export default async function AdminDailyActivityPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialDate = isIsoDate(params.date) ? params.date : yesterdayIso();

  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading daily activity…</p>}>
      <AdminDailyActivityClient initialDate={initialDate} />
    </Suspense>
  );
}
