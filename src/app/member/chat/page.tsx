import Link from "next/link";
import MemberChatWorkspace from "@/components/MemberChatWorkspace";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  ensureCohortThread,
  ensureMemberThread,
  hydrateCoachChat,
  listThreadsForCoach,
  listThreadsForMember,
} from "@/lib/coach-chat";
import { cohortTitleForSlug, communityProgramTargets } from "@/lib/community-feed";
import { resolveMemberVisibleCohortSlugs } from "@/lib/member-chat-access";
import { DEFAULT_DEMO_MEMBER_ID } from "@/lib/demo-coach";
import { resolveMemberUserId } from "@/lib/current-user";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { getEffectiveMembershipPlan } from "@/lib/gamification-promos";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ ping?: string }>;
};

export default async function MemberChatPage({ searchParams }: Props) {
  const sp = await searchParams;
  const pingZoom = sp.ping === "zoom";
  const [uid, session] = await Promise.all([resolveMemberUserId(), getSessionUser()]);
  const staff = Boolean(session && isStaffRole(session.role));
  await hydrateCoachChat({ preferFresh: true });
  await ensureMemberThread(uid);
  // Visible groups = enrolled programs only (Free Explorer → none). No always-on Station/Adult.
  const programSlugs = await resolveMemberVisibleCohortSlugs(uid);
  for (const slug of programSlugs) {
    await ensureCohortThread(slug, cohortTitleForSlug(slug));
  }
  // Coaches (John + Jeremy) get every program group so they can post anywhere while testing.
  if (staff) {
    for (const p of communityProgramTargets()) {
      await ensureCohortThread(p.slug, cohortTitleForSlug(p.slug));
    }
  }
  let threads = listThreadsForMember(uid, programSlugs);
  if (staff) {
    const byId = new Map(threads.map((t) => [t.id, t]));
    for (const t of listThreadsForCoach()) {
      if (t.kind === "cohort" && !byId.has(t.id)) byId.set(t.id, t);
    }
    threads = [...byId.values()].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  const staffViewingSelf = staff && uid === session?.id;
  const profile = await getMemberProfile(uid);
  const membershipPlan = await getEffectiveMembershipPlan(uid, profile?.plan);

  return (
    <div className="space-y-4">
      <Link href="/member/today" className="text-xs text-accent hover:underline">
        ← Today
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Coach (default) — private 1:1. Groups appear only for programs you&apos;re enrolled in.
          Workouts with checklists are on Go to Today.
        </p>
      </div>

      {pingZoom ? (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <p className="font-semibold">Ping coach to start Zoom</p>
          <p className="mt-1 text-xs text-sky-100/85">
            Message your coach: <em>“Ready for live Zoom when you are.”</em> When they start the
            room, use <strong>Join Live Zoom Now</strong> on the blue bar at the top of the app.
          </p>
        </div>
      ) : null}

      {staffViewingSelf && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          You&apos;re signed in as <strong>{session?.name || "Coach"}</strong> — posts go out{" "}
          <strong>as coach</strong> (same as Jeremy). Use group tabs for Everyone / program feeds,
          or open <a href="/admin/chat" className="underline">Coach Messages</a> for the full coach
          desk.
        </div>
      )}

      {session && isStaffRole(session.role) && uid === DEFAULT_DEMO_MEMBER_ID && (
        <p className="text-xs text-[var(--muted)]">
          Previewing as <strong>John &amp; Steph</strong> — replies here show in Coach admin → John &amp; Steph.
        </p>
      )}

      <MemberChatWorkspace
        initialThreads={threads}
        memberId={uid}
        asCoach={staff}
        membershipPlan={membershipPlan}
      />
    </div>
  );
}