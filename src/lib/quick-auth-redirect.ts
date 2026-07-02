/** Paths where we should not interrupt with quick-auth setup (onboarding/checkout first). */
export function shouldOfferQuickAuthSetup(destination: string): boolean {
  if (!destination.startsWith("/")) return false;
  if (destination.includes("/member/onboard")) return false;
  if (destination.includes("/member/checkout")) return false;
  if (destination.includes("/member/quote-received")) return false;
  if (destination.includes("/setup-quick-auth")) return false;
  return true;
}

export function quickAuthSetupUrl(destination: string): string {
  const params = new URLSearchParams({ redirect: destination });
  return `/setup-quick-auth?${params}`;
}