import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readEmailHistoryFromRequestCookies } from "@/lib/email-history-cookies";
import { LAST_EMAIL_COOKIE, normalizeRememberedEmail } from "@/lib/remembered-email";

function readRememberedCookie(raw: string): string | null {
  if (!raw) return null;
  try {
    const decoded = raw.includes("%") ? decodeURIComponent(raw) : raw;
    return normalizeRememberedEmail(decoded);
  } catch {
    return normalizeRememberedEmail(raw);
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LAST_EMAIL_COOKIE)?.value || "";
  const email = readRememberedCookie(raw);
  const emails = readEmailHistoryFromRequestCookies((name) => cookieStore.get(name));
  return NextResponse.json({
    email: email || emails[0] || null,
    emails,
  });
}

/** Clear last-used email cookie so login can switch accounts cleanly. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const opts = { path: "/", maxAge: 0 };
  res.cookies.set(LAST_EMAIL_COOKIE, "", opts);
  return res;
}