import { NextResponse } from "next/server";
import { clearSessionCookies, getSessionUser } from "@/lib/auth";
import { applyRememberedEmailCookie } from "@/lib/remembered-email";

function rememberCurrentEmail(
  res: { cookies: { set: (name: string, value: string, opts?: object) => void } },
  email?: string | null,
) {
  if (email) applyRememberedEmailCookie(res, email);
}

export async function POST() {
  const user = await getSessionUser();
  const res = NextResponse.json({ ok: true });
  rememberCurrentEmail(res, user?.email);
  clearSessionCookies(res);
  return res;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  const res = NextResponse.redirect(new URL("/", request.url));
  rememberCurrentEmail(res, user?.email);
  clearSessionCookies(res);
  return res;
}