/** Staff grants that never drop on the 1st — auto-renew instead of expire. */

export const STANDING_STAFF_GRANT_EMAILS = [
  // House / testers / developers — Business Class, never billed.
  "sprealty9@gmail.com", // Stephanie — developer + tester
  "fletcherboys@att.net", // Ali — we train at her house
  "john@lemonvoice.com", // Lemon John — developer + tester
  "coachjohnepop@yahoo.com", // John's yahoo soak
  "john@thetrainstation.co",
] as const;

export function isStandingStaffGrantEmail(
  email: string | null | undefined,
): boolean {
  const key = email?.trim().toLowerCase();
  if (!key) return false;
  return (STANDING_STAFF_GRANT_EMAILS as readonly string[]).includes(key);
}
