import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessByowAdmin } from "@/lib/byow-access";
import { listAllByowWorkouts } from "@/lib/byow-build";

export const dynamic = "force-dynamic";

export default async function ByowAdminPage() {
  const session = await getSessionUser();
  if (!canAccessByowAdmin(session)) {
    redirect("/byow");
  }

  const workouts = await listAllByowWorkouts();

  return (
    <div className="space-y-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
        BYOW admin · John only
      </p>
      <h1 className="font-serif text-3xl">Private notes library</h1>
      <p className="text-sm text-[var(--muted)]">
        Every Bring-Your-Own workout. Separate tables from Jeremy&apos;s Exercise catalog.
      </p>
      {workouts.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {workouts.map((w) => (
            <li key={w.id}>
              <Link
                href={`/member/workout?byow=${encodeURIComponent(w.id)}`}
                className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3"
              >
                <p className="text-sm font-semibold">{w.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {w.owner.name || w.owner.email} · {w._count.exercises} moves ·{" "}
                  {w.updatedAt.toISOString().slice(0, 10)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/byow" className="text-xs text-accent hover:underline">
        ← Upload desk
      </Link>
    </div>
  );
}
