import { Suspense } from "react";
import FreePaymentSetupClient from "@/components/FreePaymentSetupClient";

export const dynamic = "force-dynamic";

export default async function FreePaymentSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const sp = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[var(--muted)]">Loading card setup…</div>
      }
    >
      <FreePaymentSetupClient canceled={sp.canceled === "1"} />
    </Suspense>
  );
}
