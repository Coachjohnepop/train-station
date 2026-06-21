export const LAST_EMAIL_COOKIE = "ts_last_email";

export function normalizeRememberedEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function rememberedEmailCookieOptions(maxAge = 365 * 24 * 60 * 60) {
  return {
    path: "/",
    maxAge,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  };
}

export function applyRememberedEmailCookie(
  res: { cookies: { set: (name: string, value: string, opts?: object) => void } },
  rawEmail: string,
) {
  const email = normalizeRememberedEmail(rawEmail);
  if (!email) return;
  res.cookies.set(LAST_EMAIL_COOKIE, email, rememberedEmailCookieOptions());
}