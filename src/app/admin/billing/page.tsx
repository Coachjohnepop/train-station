import { Suspense } from "react";
import AdminBillingClient from "./AdminBillingClient";

export const dynamic = "force-dynamic";

export default function AdminBillingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading billing…</p>}>
      <AdminBillingClient />
    </Suspense>
  );
}
