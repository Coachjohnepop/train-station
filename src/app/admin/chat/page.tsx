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
import { getMemberCoachingMode } from "@/lib/member-coaching-mode";

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
  const members = roster.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    coachingMode: getMemberCoachingMode(m.id),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Community feed for station-wide posts; direct inbox for 1:1 member threads.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Community feed</h2>
          <p className="text-[11px] text-[var(--muted)]">{COMMUNITY_NO_BROADCAST_NOTE}</p>
        </div>
        <CommunityComposer embedded />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Inbox</h2>
        <p className="text-sm text-[var(--muted)]">
          Color-coded — green Live, blue Asynch, violet Community. On phone, use Inbox / Chat tabs.
        </p>
        <AdminChatWorkspace
          initialThreads={threads}
          members={members}
          initialUnreadByThread={getUnreadCountsByThreadForCoach()}
          initialMemberId={sp.member}
        />
      </section>

      <details className="group rounded-xl border border-accent/25 bg-accent/5">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-sm">
          <span className="text-accent group-open:rotate-90 transition-transform text-xs">▶</span>
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