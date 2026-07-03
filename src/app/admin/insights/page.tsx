import { Suspense } from "react";
import AdminInsightsClient from "@/components/AdminInsightsClient";

export const dynamic = "force-dynamic";

export default function AdminInsightsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading insights…</p>}>
      <AdminInsightsClient />
    </Suspense>
  );
}