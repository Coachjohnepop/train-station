/**
 * Legacy / alternate emails → canonical account email.
 * john@lemonvoice.com is not mapped (free for real signup); demo John & Steph is
 * johnsteph@thetrainstation.co only.
 */
const ACCOUNT_EMAIL_ALIASES: Record<string, string> = {};

export function normalizeAccountEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "";
  return ACCOUNT_EMAIL_ALIASES[normalized] || normalized;
}