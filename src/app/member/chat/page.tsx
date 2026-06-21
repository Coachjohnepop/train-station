import Link from "next/link";
import MemberChatWorkspace from "@/components/MemberChatWorkspace";
import { ensureCohortThread, ensureMemberThread, hydrateCoachChat, listThreadsForMember } from "@/lib/coach-chat";
import { resolveUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function MemberChatPage() {
  const uid = await resolveUserId();
  await hydrateCoachChat();
  await ensureMemberThread(uid);
  await ensureCohortThread("adult", "Adult program cohort");
  const threads = listThreadsForMember(uid, ["adult"]);

  return (
    <div className="space-y-4">
      <Link href="/member" className="text-xs text-accent hover:underline">
        ← Dashboard
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Coach posts, videos, and notes — like a Patreon creator feed. Reply below or text your coach. Workouts with checklists are on Go to Today.
        </p>
      </div>
      <MemberChatWorkspace initialThreads={threads} memberId={uid} />
    </div>
  );
}