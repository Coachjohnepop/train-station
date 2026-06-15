import Link from "next/link";
import MemberChatWorkspace from "@/components/MemberChatWorkspace";
import { listThreadsForMember } from "@/lib/coach-chat";
import { resolveUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function MemberChatPage() {
  const uid = await resolveUserId("demo-user");
  const threads = listThreadsForMember(uid, ["adult"]);

  return (
    <div className="space-y-4">
      <Link href="/member" className="text-xs text-accent hover:underline">
        ← Dashboard
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Coach updates</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Workout overrides, demo videos, and notes from your coach. SMS replies from your phone appear here too.
        </p>
      </div>
      <MemberChatWorkspace initialThreads={threads} />
    </div>
  );
}