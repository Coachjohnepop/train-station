import AdminPricingClient from "@/app/admin/pricing/AdminPricingClient";

export const dynamic = "force-dynamic";

export default function AdminPricingPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Membership pricing</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Coach Class, Business Class, and 1st Class — adjust what the site shows and optionally push
        new Stripe prices for checkout.
      </p>
      <div className="mt-6">
        <AdminPricingClient />
      </div>
    </div>
  );
}