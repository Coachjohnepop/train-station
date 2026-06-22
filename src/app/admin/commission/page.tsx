import { Suspense } from "react";
import AdminCommissionClient from "./AdminCommissionClient";

export const dynamic = "force-dynamic";

export default function AdminCommissionPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading commission…</p>}>
      <AdminCommissionClient />
    </Suspense>
  );
}