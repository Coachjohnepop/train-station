import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessByowAdmin, canUseByowUpload } from "@/lib/byow-access";
import { listByowWorkoutsForOwner } from "@/lib/byow-build";
import ByowUploadClient from "@/components/ByowUploadClient";

export const dynamic = "force-dynamic";

export default async function ByowPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/byow/signup");
  }
  if (!canUseByowUpload(session)) {
    redirect("/login?redirect=/byow");
  }

  const workouts = await listByowWorkoutsForOwner(session.id);
  const admin = canAccessByowAdmin(session);

  return (
    <div className="space-y-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
        Hidden · BYOW
      </p>
      <h1 className="font-serif text-3xl">Bring your own workout</h1>
      <p className="text-sm text-[var(--muted)]">
        Paste notes or upload a .txt the way Jeremy builds days. Exercises stay in{" "}
        <strong className="text-[var(--text)]">your</strong> library — they never go into the
        coach catalog.
      </p>
      <ByowUploadClient />
      {workouts.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Your workouts</h2>
          <ul className="space-y-2">
            {workouts.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/member/workout?byow=${encodeURIComponent(w.id)}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm hover:border-[var(--ramp-gold)]"
                >
                  <span className="font-medium">{w.name}</span>
                  <span className="text-xs text-[var(--muted)]">{w._count.exercises} moves</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-xs text-[var(--muted)]">
        <Link href="/member/byow?tab=report" className="text-accent hover:underline">
          This week&apos;s report
        </Link>
        {" · "}
        <Link href="/member/byow" className="text-accent hover:underline">
          Open in the member app
        </Link>
        {admin ? (
          <>
            {" · "}
            <Link href="/byow/admin" className="text-accent hover:underline">
              Admin library
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
