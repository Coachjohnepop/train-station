import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
  return NextResponse.json({ email: email || null });
}