import { Suspense } from "react";
import Link from "next/link";
import AdminCommissionClient from "./AdminCommissionClient";

export const dynamic = "force-dynamic";

/**
 * Advanced partner / pool settings. Day-to-day balance, bank history, and share run
 * also live on Admin → Stripe money (unified page).
 */
export default function AdminCommissionPage() {
  return (
    <div className="space-y-4">
      <div className="card border-accent/30 bg-accent/5 px-4 py-3 text-sm text-[var(--muted)]">
        Day-to-day money (platform + partner balances, bank payouts, run share) is on{" "}
        <Link href="/admin/billing?tab=share" className="font-medium text-accent hover:underline">
          Stripe money → Share
        </Link>
        . This page is the advanced partner desk (Connect, pool schedule, history).
      </div>
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading commission…</p>}>
        <AdminCommissionClient />
      </Suspense>
    </div>
  );
}