import Link from "next/link";

export type LatestStripePurchaseView = {
  chargeId: string;
  paymentIntentId: string | null;
  amountLabel: string;
  status: string;
  description: string | null;
  customerEmail: string | null;
  customerName: string | null;
  memberUserId: string | null;
  memberPlan: string | null;
  createdAt: string;
  cardBrand: string | null;
  cardLast4: string | null;
  receiptUrl: string | null;
};

function whenLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LatestStripePurchaseCard({
  purchase,
  heading = "Stripe income",
}: {
  purchase: LatestStripePurchaseView | null | undefined;
  heading?: string;
}) {
  return (
    <section className="space-y-3" id="stripe-income">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {heading}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Latest succeeded charge on Jeremy&apos;s Train Station Stripe.
          </p>
        </div>
        <Link href="/admin/billing?tab=charges" className="text-xs font-semibold text-accent hover:underline">
          All charges
        </Link>
      </div>

      {!purchase ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm text-[var(--muted)]">
          No Stripe purchases on this account yet.
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
            Latest purchase
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            {purchase.amountLabel}
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--text)]">
            {purchase.customerName || purchase.customerEmail || "Card charge"}
          </p>
          {purchase.customerEmail && purchase.customerName ? (
            <p className="text-xs text-[var(--muted)]">{purchase.customerEmail}</p>
          ) : null}
          <p className="mt-2 text-sm text-[var(--muted)]">
            {purchase.description || "Stripe charge"}
            {purchase.memberPlan ? ` · ${purchase.memberPlan}` : ""}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {whenLabel(purchase.createdAt)}
            {purchase.cardBrand || purchase.cardLast4
              ? ` · ${purchase.cardBrand || "card"}${purchase.cardLast4 ? ` •${purchase.cardLast4}` : ""}`
              : ""}
            {` · ${purchase.status}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {purchase.receiptUrl ? (
              <a
                href={purchase.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-accent hover:underline"
              >
                Receipt ↗
              </a>
            ) : null}
            {purchase.memberUserId ? (
              <Link
                href={`/admin/members?q=${encodeURIComponent(purchase.customerEmail || purchase.memberUserId)}`}
                className="font-semibold text-accent hover:underline"
              >
                Member
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
