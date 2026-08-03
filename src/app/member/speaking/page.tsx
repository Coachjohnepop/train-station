import { Suspense } from "react";
import SpeakingIntakeWizard from "@/components/SpeakingIntakeWizard";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SpeakingIntakePage() {
  const session = await getSessionUser();

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md p-6 text-center text-sm text-[var(--muted)]">
          Loading speaking intake…
        </div>
      }
    >
      <SpeakingIntakeWizard
        email={session?.email || ""}
        name={session?.name || ""}
      />
    </Suspense>
  );
}
