import Link from "next/link";
import { signupPlanLabel, type MembershipPlan } from "@/lib/signup-plans";

type MembershipOffer = {
  plan: string;
  label: string;
  priceLabel: string;
  stripeReady?: boolean;
};

export default function CheckoutUpgradeOptions({
  currentPlan,
  upgradePlans,
  memberships,
}: {
  currentPlan: MembershipPlan;
  upgradePlans: MembershipPlan[];
  memberships: MembershipOffer[] | null | undefined;
}) {
  if (upgradePlans.length === 0) return null;

  const readyUpgrades = upgradePlans.filter((candidate) => {
    const offer = memberships?.find((m) => m.plan === candidate);
    return offer?.stripeReady !== false;
  });

  if (readyUpgrades.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
          Upgrade your ticket
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Step up before you pay — you won&apos;t see lower tiers here during setup.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {readyUpgrades.map((upgradePlan) => {
          const offer = memberships?.find((m) => m.plan === upgradePlan);
          const price = offer?.priceLabel?.trim();
          return (
            <Link
              key={upgradePlan}
              href={`/member/checkout?plan=${encodeURIComponent(upgradePlan)}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm transition hover:border-[var(--accent)]"
            >
              <span className="font-semibold">{signupPlanLabel(upgradePlan)}</span>
              <span className="text-xs text-[var(--muted)]">{price || "See checkout"}</span>
            </Link>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-[var(--muted)]">
        Paying for {signupPlanLabel(currentPlan)} — pick a higher seat above to switch before checkout.
      </p>
    </div>
  );
}