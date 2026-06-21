import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LAST_EMAIL_COOKIE, normalizeRememberedEmail } from "@/lib/remembered-email";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LAST_EMAIL_COOKIE)?.value || "";
  const email = normalizeRememberedEmail(decodeURIComponent(raw));
  return NextResponse.json({ email: email || null });
}