import { Suspense } from "react";
import AdminSiteAnalyticsClient from "@/components/AdminSiteAnalyticsClient";

export const dynamic = "force-dynamic";

export default function AdminSiteAnalyticsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading analytics…</p>}>
      <AdminSiteAnalyticsClient />
    </Suspense>
  );
}
