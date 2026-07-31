import { Suspense } from "react";
import AdminPlatformDashboardClient from "@/components/AdminPlatformDashboardClient";

export const dynamic = "force-dynamic";

export default function PlatformAdminPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading backoffice…</p>}>
      <AdminPlatformDashboardClient />
    </Suspense>
  );
}
