/** Staff grants that never drop on the 1st — auto-renew instead of expire. */

export const STANDING_STAFF_GRANT_EMAILS = [
  "sprealty9@gmail.com",
  // Developer / builder — never billed. Training member + yahoo soak that Stripe was charging.
  "john@lemonvoice.com",
  "coachjohnepop@yahoo.com",
  "john@thetrainstation.co",
] as const;

export function isStandingStaffGrantEmail(
  email: string | null | undefined,
): boolean {
  const key = email?.trim().toLowerCase();
  if (!key) return false;
  return (STANDING_STAFF_GRANT_EMAILS as readonly string[]).includes(key);
}
