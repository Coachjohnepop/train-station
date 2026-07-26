import Link from "next/link";
import {
  ECO_DELIGHT_DISCOUNT_CODE,
  ECO_DELIGHT_DISCOUNT_PERCENT,
  ECO_DELIGHT_REFERRAL_CODE,
  ecoDelightBuySubscriptionsUrl,
  ecoDelightBuyStoreUrl,
  type EcoDelightSponsorStats,
} from "@/lib/sponsorship";

type Props = {
  stats: EcoDelightSponsorStats | null;
  /** Coach-facing: show commission & portal */
  showCommission?: boolean;
};

function money(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function SponsorshipEcoDelight({
  stats,
  showCommission = true,
}: Props) {
  const buyUrl = stats?.links?.buySubscriptions || ecoDelightBuySubscriptionsUrl();
  const storeUrl = stats?.links?.buyStore || ecoDelightBuyStoreUrl();
  const code = stats?.discount?.code || ECO_DELIGHT_DISCOUNT_CODE;
  const pct = stats?.discount?.percent ?? ECO_DELIGHT_DISCOUNT_PERCENT;
  const s = stats?.stats;

  return (
    <section className="card overflow-hidden border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-[var(--surface)] to-[var(--surface)]">
      <div className="border-b border-amber-500/20 px-4 py-3 sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90">
          Sponsorship · Eco Delight Coffee
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--text)] sm:text-xl">
          Fresh coffee for the station
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Jeremy partners with Eco Delight — clean iced coffee, no creamer or sugar required.
          Members save with code <strong className="text-[var(--text)]">{code}</strong> (
          {pct}% off). Sales through this link pay commission back to The Train Station.
        </p>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/80 p-3 text-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Member discount
            </p>
            <p className="mt-1 font-mono text-xl font-bold tracking-wide text-accent">{code}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {pct}% off · up to {stats?.discount?.maxUsage ?? 100} uses · ref{" "}
              <span className="font-mono">{ECO_DELIGHT_REFERRAL_CODE}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold"
            >
              Buy now · subscriptions →
            </a>
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost inline-flex items-center justify-center border border-[var(--border)] px-4 py-2.5 text-sm font-semibold"
            >
              Shop Eco Delight
            </a>
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Opens Eco Delight with Train Station tracking + discount pre-applied. A short Jeremy
            commercial plays on the subscriptions page.
          </p>
        </div>

        {showCommission ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Affiliate commission
            </p>
            {stats?.ok && s ? (
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-[10px] text-[var(--muted)]">Orders</dt>
                  <dd className="font-semibold tabular-nums">{s.totalOrders}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-[var(--muted)]">Clicks</dt>
                  <dd className="font-semibold tabular-nums">{s.totalClicks}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-[var(--muted)]">Revenue</dt>
                  <dd className="font-semibold tabular-nums">{money(s.totalRevenue)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-[var(--muted)]">Commission earned</dt>
                  <dd className="font-semibold tabular-nums text-accent">
                    {money(s.totalCommission)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[10px] text-[var(--muted)]">Pending payout</dt>
                  <dd className="font-semibold tabular-nums">{money(s.pendingBalance)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted)]">
                {stats?.error
                  ? `Live stats unavailable (${stats.error}). Seed the Eco affiliate + set ECO_DELIGHT_API_URL if needed.`
                  : "Commission totals appear here after the first attributed Eco Delight sale."}
              </p>
            )}
            {stats?.partner?.email ? (
              <p className="mt-3 text-[10px] text-[var(--muted)]">
                Affiliate: {stats.partner.email}
                {stats.partner.stripeOnboarded
                  ? " · Stripe Connect ready"
                  : " · complete Stripe Connect in the Eco affiliate portal for payouts"}
              </p>
            ) : null}
            {stats?.links?.affiliatePortal ? (
              <a
                href={stats.links.affiliatePortal}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-accent hover:underline"
              >
                Eco Delight affiliate portal →
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
