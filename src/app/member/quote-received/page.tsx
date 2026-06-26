import Link from "next/link";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";

export default async function QuoteReceivedPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  const plan = normalizeSignupPlan(params.plan);
  const label = signupPlanLabel(plan);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card space-y-4 p-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[3px] text-accent">Quote request</p>
        <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
        <p className="text-sm text-[var(--muted)]">
          Thanks — Jeremy will follow up with custom pricing. You can sign in anytime while we prepare
          your proposal.
        </p>
        <Link href="/member" className="btn-primary inline-block text-sm">
          Go to member home
        </Link>
      </div>
    </div>
  );
}