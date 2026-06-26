import type { ReactNode } from "react";
import MembershipSeatArt from "@/components/MembershipSeatArt";
import {
  paymentBillingSummary,
  paymentPerksForPlan,
  paymentCardTitle,
  membershipThemeTierFromPlan,
} from "@/lib/membership-theme";
import type { SignupPlan } from "@/lib/signup-plans";

export default function MembershipPaymentCard({
  plan,
  priceLabel,
  children,
}: {
  plan: SignupPlan;
  priceLabel?: string | null;
  children?: ReactNode;
}) {
  const perks = paymentPerksForPlan(plan);
  const tier = membershipThemeTierFromPlan(plan);

  return (
    <div className="card payment-seat-card">
      <MembershipSeatArt plan={plan} membershipTier={tier} className="w-full" priority />
      <div className="payment-seat-card__body space-y-4">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[3px] text-accent">
            Your ticket
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{paymentCardTitle(plan)}</h2>
          {priceLabel && (
            <p className="mt-1 text-lg font-semibold text-[var(--text)]">{priceLabel}</p>
          )}
          <p className="mt-2 text-sm text-[var(--muted)]">{paymentBillingSummary(plan, priceLabel)}</p>
        </div>

        {perks.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left text-xs text-[var(--muted)]">
            {perks.slice(0, 4).map((perk) => (
              <li key={perk}>· {perk}</li>
            ))}
          </ul>
        )}

        {children}
      </div>
    </div>
  );
}