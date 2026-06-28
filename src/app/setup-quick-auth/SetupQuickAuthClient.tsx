"use client";

import { useRouter } from "next/navigation";
import QuickAuthSetupPrompt from "@/components/QuickAuthSetupPrompt";

export default function SetupQuickAuthClient({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  const router = useRouter();

  return (
    <QuickAuthSetupPrompt
      email={email}
      onContinue={() => {
        router.push(redirectTo);
        router.refresh();
      }}
    />
  );
}