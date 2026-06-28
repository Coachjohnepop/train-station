import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookies, getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/auth-session";
import { MEMBER_COOKIE } from "@/lib/current-user";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import {
  applyEmailHistoryCookies,
  readEmailHistoryFromRequestCookies,
} from "@/lib/email-history-cookies";

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

async function rememberEmailOnLogout(
  res: NextResponse,
  email: string | null,
) {
  if (!email) return;
  const cookieStore = await cookies();
  applyEmailHistoryCookies(
    res,
    email,
    readEmailHistoryFromRequestCookies((name) => cookieStore.get(name)),
  );
}

export async function POST() {
  const email = await emailToRememberOnLogout();
  const res = NextResponse.json({ ok: true });
  await rememberEmailOnLogout(res, email);
  clearSessionCookies(res);
  return res;
}

export async function GET(request: Request) {
  const email = await emailToRememberOnLogout();
  const reqUrl = new URL(request.url);
  const nextParam = reqUrl.searchParams.get("next");
  const loginUrl = new URL("/login", reqUrl.origin);
  loginUrl.searchParams.set("switch", "1");
  const redirectAfter = reqUrl.searchParams.get("redirect");
  if (redirectAfter?.startsWith("/")) {
    loginUrl.searchParams.set("redirect", redirectAfter);
  }
  const destination = nextParam?.startsWith("/") ? new URL(nextParam, reqUrl.origin) : loginUrl;
  const res = NextResponse.redirect(destination);
  await rememberEmailOnLogout(res, email);
  clearSessionCookies(res);
  return res;
}