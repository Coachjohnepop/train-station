/** Legacy / alternate emails that map to the canonical invited account. */
const ACCOUNT_EMAIL_ALIASES: Record<string, string> = {
  "johnsteph@thetrainstation.co": "john@lemonvoice.com",
};

export function normalizeAccountEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "";
  return ACCOUNT_EMAIL_ALIASES[normalized] || normalized;
}