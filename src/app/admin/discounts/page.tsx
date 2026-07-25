import AdminDiscountsPanel from "@/components/AdminDiscountsPanel";

export const dynamic = "force-dynamic";

export default function AdminDiscountsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Discount codes</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Create Stripe promo codes members enter at Checkout (or{" "}
          <code className="text-xs">?promo=CODE</code>). Early-cohort feedback offers live here.
        </p>
      </div>
      <AdminDiscountsPanel showBillingLink />
    </div>
  );
}
