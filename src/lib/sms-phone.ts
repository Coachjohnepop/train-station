/** Phone normalization / display format / Twilio env helpers (no server-only). */

/**
 * Train Station display format: area.prefix.suffix
 * Example: 916.284.1994
 */
export function normalizePhoneDigits(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

/** Last 10 national digits (US), dropping leading country 1 when present. */
export function nationalPhoneDigits(phone: string): string {
  let d = normalizePhoneDigits(phone);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  return d;
}

/**
 * Format any phone-ish input as AAA.PPP.SSSS (no parentheses).
 * Example: 916.284.1994
 * Partial entry formats progressively while typing.
 * Empty / non-digit → "".
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const d = nationalPhoneDigits(phone || "");
  if (!d) return "";

  const area = d.slice(0, 3);
  const prefix = d.slice(3, 6);
  const suffix = d.slice(6, 10);

  if (d.length <= 3) return area;
  if (d.length <= 6) return `${area}.${prefix}`;
  return `${area}.${prefix}.${suffix}`;
}

/**
 * As-you-type formatter for controlled inputs.
 * Strips non-digits, caps at 10 national digits, returns display form.
 */
export function formatPhoneInputValue(raw: string): string {
  // Allow user to clear the field
  if (!raw || !raw.trim()) return "";
  return formatPhoneDisplay(raw);
}

export function phonesMatch(a: string, b: string): boolean {
  const da = nationalPhoneDigits(a);
  const db = nationalPhoneDigits(b);
  if (!da || !db) return false;
  return da === db;
}

export function toE164(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

export function twilioConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  );
}
