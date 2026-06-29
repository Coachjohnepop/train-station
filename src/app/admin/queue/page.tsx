import Link from "next/link";
import { listSelfRegisteredAccounts } from "@/lib/member-accounts-store";
import { listMemberProfiles } from "@/lib/member-profiles-store";
import { signupPlanLabel } from "@/lib/signup-plans";

export const dynamic = "force-dynamic";

function isPaidPlan(plan: string): boolean {
  return plan === "member" || plan === "pro" || plan === "business";
}

export default async function AdminQueuePage() {
  const [accounts, profiles] = await Promise.all([
    listSelfRegisteredAccounts(),
    listMemberProfiles(),
  ]);
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  type QueueItem = {
    userId: string;
    name: string;
    email: string;
    reason: string;
    href: string;
  };

  const queue: QueueItem[] = [];

  for (const { email, account } of accounts) {
    const profile = profileByUserId.get(account.userId);
    if (!profile) continue;

    if (profile.approvalStatus === "pending" && profile.onboardingComplete) {
      queue.push({
        userId: account.userId,
        name: account.name,
        email,
        reason: "Pending approval",
        href: "/admin/members",
      });
      continue;
    }

    if (isPaidPlan(profile.plan) && profile.paymentStatus !== "paid") {
      queue.push({
        userId: account.userId,
        name: account.name,
        email,
        reason: `Awaiting payment · ${signupPlanLabel(profile.plan)}`,
        href: "/admin/members",
      });
      continue;
    }

    if (profile.onboardingComplete && !profile.coachIntakeCompleteAt) {
      queue.push({
        userId: account.userId,
        name: account.name,
        email,
        reason: "Needs intake sign-off",
        href: "/admin/members",
      });
      continue;
    }

    if (profile.coachMeetingRequestedAt) {
      queue.push({
        userId: account.userId,
        name: account.name,
        email,
        reason: "Meeting requested",
        href: "/admin/members",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Queue</h1>
        <p className="text-sm text-[var(--muted)]">
          Members who need your attention — approve, payment, intake, or follow-up.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-medium">Queue is clear.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            New signups will show up here when they need action.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {queue.map((item) => (
            <li key={`${item.userId}-${item.reason}`}>
              <Link
                href={item.href}
                className="card flex min-h-[56px] flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:border-accent/40"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--muted)]">{item.email}</p>
                </div>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-semibold uppercase text-amber-200">
                  {item.reason}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/admin/members" className="text-sm text-accent hover:underline">
        Open full members table →
      </Link>
    </div>
  );
}