import Link from "next/link";
import MemberChatWorkspace from "@/components/MemberChatWorkspace";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  ensureCohortThread,
  ensureMemberThread,
  hydrateCoachChat,
  listThreadsForMember,
} from "@/lib/coach-chat";
import { COMMUNITY_FEED_PROGRAM_SLUG, COMMUNITY_FEED_TITLE } from "@/lib/community-feed";
import { getUserEnrollments } from "@/lib/data/user-data";
import { DEFAULT_DEMO_MEMBER_ID } from "@/lib/demo-coach";
import { resolveMemberUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function MemberChatPage() {
  const [uid, session] = await Promise.all([resolveMemberUserId(), getSessionUser()]);
  await hydrateCoachChat({ preferFresh: true });
  await ensureMemberThread(uid);
  const communitySlug = COMMUNITY_FEED_PROGRAM_SLUG;
  await ensureCohortThread(communitySlug, COMMUNITY_FEED_TITLE);
  const enrolledSlugs = Object.keys(getUserEnrollments(uid));
  const programSlugs = [...new Set([communitySlug, ...enrolledSlugs])];
  const threads = listThreadsForMember(uid, programSlugs);

  const staffViewingSelf =
    session && isStaffRole(session.role) && uid === session.id;

  return (
    <div className="space-y-4">
      <Link href="/member/today" className="text-xs text-accent hover:underline">
        ← Today
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Community tab — coach posts, videos, and notes (Patreon-style). Coach tab — private 1:1 thread. Workouts with checklists are on Go to Today.
        </p>
      </div>

      {staffViewingSelf && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          You&apos;re signed in as <strong>{session?.name || "Coach"}</strong> — this is not a member inbox.
          Tap <strong>Chad</strong> (or the member you messaged) in the bar above, then open Messages again.
        </div>
      )}

      {session && isStaffRole(session.role) && uid === DEFAULT_DEMO_MEMBER_ID && (
        <p className="text-xs text-[var(--muted)]">
          Previewing as <strong>John &amp; Steph</strong> — replies here show in Coach admin → John &amp; Steph.
        </p>
      )}

      <MemberChatWorkspace initialThreads={threads} memberId={uid} />
    </div>
  );
}