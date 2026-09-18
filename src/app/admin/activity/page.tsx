import { Suspense } from "react";
import AdminDailyActivityClient from "@/components/AdminDailyActivityClient";
import { isIsoDate, parseUsageRange, yesterdayIso } from "@/lib/daily-user-activity-format";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ date?: string; range?: string }> };

export default async function AdminDailyActivityPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialDate = isIsoDate(params.date) ? params.date : yesterdayIso();
  const initialRange = parseUsageRange(params.range);

  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading usage…</p>}>
      <AdminDailyActivityClient initialDate={initialDate} initialRange={initialRange} />
    </Suspense>
  );
}
