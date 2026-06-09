import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberDashboard } from "@/lib/member-context";

export const dynamic = "force-dynamic";

export default async function MemberLivePage() {
  const data = await getMemberDashboard();
  if (!data) notFound();

  const canLive = data.access.canAccessFeature("live_sessions");

  return (
    <div>
      <h1 className="text-2xl font-bold">Live sessions</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        On-demand programs plus live coaching with your trainer.
      </p>

      <div className="card mt-6 card-accent-frame">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          {data.access.isPreview ? "Preview access" : data.access.tierLabel}
        </p>
        {canLive ? (
          <>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Live booking and video rooms are coming soon. Your{" "}
              {data.access.tierLabel} membership will unlock scheduling here.
            </p>
            <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--muted)]">
              No upcoming live sessions scheduled yet.
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">
            1st Class required for live sessions (Coach access is on-demand only).
          </p>
        )}
        <p className="mt-4 text-sm">
          New members must book a 15-min onboarding Zoom call first.{" "}
          <Link href="/member/book" className="text-accent hover:underline">Book your call →</Link>
        </p>
      </div>

      <Link href="/member" className="btn-ghost mt-6 inline-flex text-sm">
        ← Dashboard
      </Link>
    </div>
  );
}