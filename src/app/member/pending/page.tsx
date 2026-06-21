import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { signupPlanLabel } from "@/lib/signup-plans";

export const dynamic = "force-dynamic";

export default async function MemberPendingPage() {
  const session = await getSessionUser();
  const profile = session ? await getMemberProfile(session.id) : null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card space-y-4 p-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[3px] text-accent">
          Almost there
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Coach review in progress</h1>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          {session?.name ? `${session.name}, your` : "Your"}{" "}
          {signupPlanLabel(profile?.plan ?? "explorer")} setup is complete. Jeremy will approve your
          account shortly — then programs, workouts, and coach chat unlock.
        </p>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-left text-sm">
          <p className="font-medium">What happens next</p>
          <ul className="mt-2 space-y-1 text-[var(--muted)]">
            <li>1. Coach reviews your signup</li>
            <li>2. You get the all-clear (usually same day)</li>
            <li>3. Sign back in and start Day 1</li>
          </ul>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Questions?{" "}
          <a href="mailto:jeremy@thetrainstation.co" className="text-accent hover:underline">
            jeremy@thetrainstation.co
          </a>
        </p>
        <Link href="/member/book" className="btn-ghost inline-flex">
          Book your intro session
        </Link>
      </div>
    </div>
  );
}