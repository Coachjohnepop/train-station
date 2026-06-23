import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookies, getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/auth-session";
import { MEMBER_COOKIE } from "@/lib/current-user";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { applyRememberedEmailCookie } from "@/lib/remembered-email";

async function emailToRememberOnLogout(): Promise<string | null> {
  const user = await getSessionUser();
  const cookieStore = await cookies();
  const viewedId = cookieStore.get(MEMBER_COOKIE)?.value;
  const viewed = viewedId ? resolveDemoUser(viewedId) : undefined;

  if (user && isStaffRole(user.role) && viewed?.email) {
    return viewed.email;
  }
  return user?.email || viewed?.email || null;
}

export async function POST() {
  const email = await emailToRememberOnLogout();
  const res = NextResponse.json({ ok: true });
  if (email) applyRememberedEmailCookie(res, email);
  clearSessionCookies(res);
  return res;
}

export async function GET(request: Request) {
  const email = await emailToRememberOnLogout();
  const res = NextResponse.redirect(new URL("/", request.url));
  if (email) applyRememberedEmailCookie(res, email);
  clearSessionCookies(res);
  return res;
}