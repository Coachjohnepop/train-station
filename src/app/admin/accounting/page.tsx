import { Suspense } from "react";
import AdminAccountingClient from "./AdminAccountingClient";

export const dynamic = "force-dynamic";

export default function AdminAccountingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading accounting…</p>}>
      <AdminAccountingClient />
    </Suspense>
  );
}
