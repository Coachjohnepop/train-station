import CoachChatComposer from "@/components/CoachChatComposer";
import AdminChatWorkspace from "@/components/AdminChatWorkspace";
import { hydrateCoachChat, listThreadsForCoach } from "@/lib/coach-chat";
import { listDemoMembersForCoach } from "@/lib/sms";

export const dynamic = "force-dynamic";

export default async function AdminChatPage() {
  await hydrateCoachChat();
  const threads = listThreadsForCoach();
  const members = listDemoMembersForCoach().map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Patreon-style creator inbox — post updates to members, reply in threads, send clips and workout overrides.
        </p>
      </div>

      <AdminChatWorkspace initialThreads={threads} />

      <details className="group rounded-xl border border-accent/25 bg-accent/5">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-sm">
          <span className="text-accent group-open:rotate-90 transition-transform text-xs">▶</span>
          New post to members
          <span className="text-[10px] font-normal text-[var(--muted)]">— workout, video, or announcement</span>
        </summary>
        <div className="border-t border-accent/20 px-1 pb-1">
          <CoachChatComposer members={members} embedded />
        </div>
      </details>
    </div>
  );
}