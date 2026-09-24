import { Suspense } from "react";
import AffiliateInviteLanding from "@/components/AffiliateInviteLanding";

export const dynamic = "force-dynamic";

export default function AffiliateInvitePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--bg)]" />}>
      <AffiliateInviteLanding />
    </Suspense>
  );
}
