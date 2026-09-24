import { Suspense } from "react";
import AffiliatePortal from "@/components/AffiliatePortal";

export const dynamic = "force-dynamic";

export default function AffiliatePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--bg)]" />}>
      <AffiliatePortal />
    </Suspense>
  );
}
