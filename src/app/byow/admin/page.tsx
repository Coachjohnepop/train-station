import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessByowAdmin } from "@/lib/byow-access";
import { listAllByowWorkouts } from "@/lib/byow-build";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ByowAdminPage() {
  const session = await getSessionUser();
  if (!canAccessByowAdmin(session)) {
    redirect("/byow");
  }

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [workouts, byowUsers, views, clicks, sessions] = await Promise.all([
    listAllByowWorkouts(),
    prisma.memberProfile.findMany({
      where: { paymentNote: "byow" },
      orderBy: { createdAt: "desc" },
      select: {
        userId: true,
        email: true,
        createdAt: true,
        user: { select: { name: true, createdAt: true } },
      },
      take: 80,
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: "page_view",
        occurredAt: { gte: since },
        OR: [{ pagePath: { startsWith: "/byow" } }, { pagePath: { startsWith: "/member/byow" } }],
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: "page_click",
        occurredAt: { gte: since },
        OR: [{ pagePath: { startsWith: "/byow" } }, { pagePath: { startsWith: "/member/byow" } }],
      },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        occurredAt: { gte: since },
        OR: [{ pagePath: { startsWith: "/byow" } }, { pagePath: { startsWith: "/member/byow" } }],
      },
      select: { sessionKey: true, pagePath: true, eventType: true, occurredAt: true, deviceType: true },
      orderBy: { occurredAt: "desc" },
      take: 80,
    }),
  ]);

  const uniqueSessions = new Set(sessions.map((s) => s.sessionKey).filter(Boolean)).size;
  const topPaths = new Map<string, number>();
  for (const row of sessions) {
    if (row.eventType !== "page_view" || !row.pagePath) continue;
    topPaths.set(row.pagePath, (topPaths.get(row.pagePath) || 0) + 1);
  }
  const topPages = [...topPaths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="space-y-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
        BYOW admin · John only · no Stripe
      </p>
      <h1 className="font-serif text-3xl">Notes lead desk</h1>
      <p className="text-sm text-[var(--muted)]">
        Manage testers, their libraries, and the /byow journey. Same User / MemberProfile
        rows as main — tagged paymentNote=byow. Free forever on this door.
      </p>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] uppercase text-[var(--muted)]">BYOW users</p>
          <p className="text-2xl font-semibold">{byowUsers.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] uppercase text-[var(--muted)]">Workouts</p>
          <p className="text-2xl font-semibold">{workouts.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] uppercase text-[var(--muted)]">Views 14d</p>
          <p className="text-2xl font-semibold">{views}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] uppercase text-[var(--muted)]">Sessions 14d</p>
          <p className="text-2xl font-semibold">{uniqueSessions}</p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Journey pages</h2>
        {topPages.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No /byow traffic yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {topPages.map(([path, n]) => (
              <li key={path} className="flex justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                <span className="truncate font-mono text-xs">{path}</span>
                <span className="tabular-nums text-[var(--muted)]">{n}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[var(--muted)]">{clicks} clicks in 14d</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Testers</h2>
        {byowUsers.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No BYOW signups yet.</p>
        ) : (
          <ul className="space-y-2">
            {byowUsers.map((u) => (
              <li key={u.userId} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                <p className="text-sm font-semibold">{u.user.name || u.email}</p>
                <p className="text-xs text-[var(--muted)]">
                  {u.email} · {u.createdAt.toISOString().slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Libraries</h2>
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
                    {w.owner.name || w.owner.email} · {w._count.exercises} moves
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-[var(--muted)]">
        Recent events: {sessions.slice(0, 5).map((s) => s.pagePath).filter(Boolean).join(" · ") || "none"}
      </p>
      <Link href="/byow" className="text-xs text-accent hover:underline">
        ← Upload desk
      </Link>
    </div>
  );
}
