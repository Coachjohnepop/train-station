import { Suspense } from "react";
import AdminGamificationClient from "./AdminGamificationClient";

export const dynamic = "force-dynamic";

export default function AdminGamificationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading gamification…</p>}>
      <AdminGamificationClient />
    </Suspense>
  );
}
