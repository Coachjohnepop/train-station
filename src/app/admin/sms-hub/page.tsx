import Link from "next/link";
import SmsHubWorkspace from "@/components/SmsHubWorkspace";
import { COMMUNITY_NO_BROADCAST_NOTE } from "@/lib/community-feed";

export const dynamic = "force-dynamic";

export default function AdminSmsHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SMS Hub</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Coach messaging without a Twilio number — email pings + in-app chat. Members never text your personal phone.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm">
        <p className="font-medium text-[var(--text)]">SMS Hub vs community feed</p>
        <ul className="mt-2 space-y-1.5 text-xs text-[var(--muted)]">
          <li>
            <strong className="text-[var(--text)]">SMS Hub (this page)</strong> — pick members and send a
            personalized check-in. Delivery is email + in-app Messages, not a group text blast.
          </li>
          <li>
            <strong className="text-[var(--text)]">Community feed</strong> — station-wide posts in{" "}
            <Link href="/admin/chat" className="text-accent hover:underline">
              Messages → Community
            </Link>
            . {COMMUNITY_NO_BROADCAST_NOTE}
          </li>
        </ul>
      </div>

      <SmsHubWorkspace />
    </div>
  );
}