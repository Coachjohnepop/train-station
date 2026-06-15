import CoachChatComposer from "@/components/CoachChatComposer";
import AdminChatWorkspace from "@/components/AdminChatWorkspace";
import { listThreadsForCoach } from "@/lib/coach-chat";
import { listDemoMembersForCoach } from "@/lib/sms";

export const dynamic = "force-dynamic";

export default function AdminChatPage() {
  const threads = listThreadsForCoach();
  const members = listDemoMembersForCoach().map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Coach Jeremy — chat</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Patreon-style feed — post workouts, short clips, and YouTube demos. Members get an in-app badge and SMS alert.
        </p>
      </div>

      <CoachChatComposer members={members} />
      <AdminChatWorkspace initialThreads={threads} />
    </div>
  );
}