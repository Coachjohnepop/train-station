"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import QuickAuthSetupPrompt from "@/components/QuickAuthSetupPrompt";
import { markQuickAuthSetupSkipped } from "@/lib/quick-auth-client";

export default function SetupQuickAuthClient({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  const router = useRouter();

  function skipSetup() {
    markQuickAuthSetupSkipped();
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      <QuickAuthSetupPrompt
        email={email}
        onContinue={() => {
          router.push(redirectTo);
          router.refresh();
        }}
      />
      <p className="mt-6 text-center text-sm">
        <button type="button" onClick={skipSetup} className="text-accent hover:underline">
          Skip for now →
        </button>
        {" · "}
        <Link href={redirectTo} className="text-[var(--muted)] hover:underline">
          Go without saving
        </Link>
      </p>
    </>
  );
}