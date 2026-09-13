import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { listByowWorkoutsForOwner } from "@/lib/byow-build";
import { canAccessByowAdmin } from "@/lib/byow-access";

export const dynamic = "force-dynamic";

export default async function MemberByowPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const workouts = await listByowWorkoutsForOwner(session.id);
  const admin = canAccessByowAdmin(session);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My notes workouts</h1>
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
    </div>
  );
}
