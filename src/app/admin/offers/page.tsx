import AdminOffersClient from "@/app/admin/offers/AdminOffersClient";

export const dynamic = "force-dynamic";

export default function AdminOffersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Offers &amp; merchandise</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Custom training packages and per-unit merch. Team consultation and speaking fees use the
        quote flow from the landing page.
      </p>
      <div className="mt-6">
        <AdminOffersClient />
      </div>
    </div>
  );
}