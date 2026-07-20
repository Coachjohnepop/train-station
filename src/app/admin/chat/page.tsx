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
    <div className="space-y-3">
      {/* Slim page — shell already shows Messages title; keep content tight for sticky beans */}
      <AdminChatWorkspace
        initialThreads={threads}
        members={members}
        initialUnreadByThread={getUnreadCountsByThreadForCoach()}
        initialMemberId={sp.member}
      />

      <details className="group rounded-xl border border-violet-400/30 bg-violet-500/5">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold">
          <span className="text-xs text-violet-300 transition-transform group-open:rotate-90">
            ▶
          </span>
          Community feed
          <span className="text-[10px] font-normal text-[var(--muted)]">
            · {COMMUNITY_NO_BROADCAST_NOTE}
          </span>
        </summary>
        <div className="border-t border-violet-400/20 px-2 pb-2 pt-2">
          <CommunityComposer embedded />
        </div>
      </details>

      <details className="group rounded-xl border border-accent/25 bg-accent/5">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold">
          <span className="text-xs text-accent transition-transform group-open:rotate-90">▶</span>
          Post to individual member(s)
        </summary>
        <div className="border-t border-accent/20 px-1 pb-1">
          <CoachChatComposer members={members} embedded />
        </div>
      </details>
    </div>
  );
}
