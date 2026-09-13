import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { listByowWorkoutsForOwner } from "@/lib/byow-build";
import { canAccessByowAdmin } from "@/lib/byow-access";
import { buildByowWeekReport } from "@/lib/byow-report";
import ByowWeekReportCard from "@/components/ByowWeekReport";

export const dynamic = "force-dynamic";

export default async function MemberByowPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSessionUser();
  if (!session) return null;
  const sp = await searchParams;
  const tab = sp.tab === "report" ? "report" : "workouts";
  const [workouts, report, admin] = await Promise.all([
    listByowWorkoutsForOwner(session.id),
    buildByowWeekReport(session.id),
    Promise.resolve(canAccessByowAdmin(session)),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My notes workouts</h1>
      <div className="flex gap-2">
        <Link
          href="/member/byow"
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            tab === "workouts"
              ? "bg-[var(--ramp-gold)] text-[#1a1204]"
              : "border border-[var(--border)] text-[var(--muted)]"
          }`}
        >
          Workouts
        </Link>
        <Link
          href="/member/byow?tab=report"
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            tab === "report"
              ? "bg-[var(--ramp-gold)] text-[#1a1204]"
              : "border border-[var(--border)] text-[var(--muted)]"
          }`}
        >
          Report
        </Link>
      </div>
      {tab === "report" ? (
        <ByowWeekReportCard report={report} />
      ) : (
        <>
      <p className="text-sm text-[var(--muted)]">
        Workouts you built from notes. Check them off in the same console as Today.
      </p>
      {workouts.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          None yet.{" "}
          <Link href="/byow" className="text-accent hover:underline">
            Upload a notes file
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {workouts.map((w) => (
            <li key={w.id}>
              <Link
                href={`/member/workout?byow=${encodeURIComponent(w.id)}`}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <span className="font-medium">{w.name}</span>
                <span className="text-xs text-[var(--muted)]">{w._count.exercises} moves</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs">
        <Link href="/byow" className="text-accent hover:underline">
          Upload another
        </Link>
        {admin ? (
          <>
            {" · "}
            <Link href="/byow/admin" className="text-accent hover:underline">
              All libraries
            </Link>
          </>
        ) : null}
      </p>
        </>
      )}
    </div>
  );
}
