import CoachChatComposer from "@/components/CoachChatComposer";
import CommunityComposer from "@/components/CommunityComposer";
import AdminChatWorkspace from "@/components/AdminChatWorkspace";
import {
  COMMUNITY_FEED_PROGRAM_SLUG,
  COMMUNITY_FEED_TITLE,
  COMMUNITY_NO_BROADCAST_NOTE,
} from "@/lib/community-feed";
import {
  ensureCohortThread,
  getUnreadCountsByThreadForCoach,
  hydrateCoachChat,
  listThreadsForCoach,
} from "@/lib/coach-chat";
import { listCoachChatMembers } from "@/lib/coach-chat-members";
import { resolveMemberCoachingMode } from "@/lib/member-coach-prefs-store";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ member?: string }>;
};

export default async function AdminChatPage({ searchParams }: Props) {
  const sp = await searchParams;
  await hydrateCoachChat({ preferFresh: true });
  await ensureCohortThread(COMMUNITY_FEED_PROGRAM_SLUG, COMMUNITY_FEED_TITLE);
  const threads = listThreadsForCoach();
  const roster = await listCoachChatMembers(threads);
  const members = await Promise.all(
    roster.map(async (m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      coachingMode: await resolveMemberCoachingMode(m.id),
    })),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Threads stay locked at the top with badges. Clear a badge when done, or use Badge for
          later. Community broadcast is below.
        </p>
      </div>

      {/* Inbox first — sticky thread strip lives inside the workspace */}
      <AdminChatWorkspace
        initialThreads={threads}
        members={members}
        initialUnreadByThread={getUnreadCountsByThreadForCoach()}
        initialMemberId={sp.member}
      />

      <details className="group rounded-xl border border-violet-400/30 bg-violet-500/5">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
          <span className="text-violet-300 transition-transform group-open:rotate-90 text-xs">
            ▶
          </span>
          Community feed
          <span className="text-[10px] font-normal text-[var(--muted)]">
            — station-wide posts · {COMMUNITY_NO_BROADCAST_NOTE}
          </span>
        </summary>
        <div className="space-y-3 border-t border-violet-400/20 px-3 pb-3 pt-2">
          <CommunityComposer embedded />
        </div>
      </details>

      <details className="group rounded-xl border border-accent/25 bg-accent/5">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
          <span className="text-accent transition-transform group-open:rotate-90 text-xs">▶</span>
          Post to individual member(s)
          <span className="text-[10px] font-normal text-[var(--muted)]">— private 1:1 thread</span>
        </summary>
        <div className="border-t border-accent/20 px-1 pb-1">
          <CoachChatComposer members={members} embedded />
        </div>
      </details>
    </div>
  );
}
