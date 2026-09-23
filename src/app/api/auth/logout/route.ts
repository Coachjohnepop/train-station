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

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Vercel-CDN-Cache-Control", "no-store");
  return res;
}

async function logoutRedirect(request: Request) {
  const email = await emailToRememberOnLogout();
  const reqUrl = new URL(request.url);
  // Public landing, not the account and not the login page. Login was
  // starting Face ID and signing them straight back in.
  const destination = new URL("/", reqUrl.origin);
  destination.searchParams.set("signedout", "1");
  const res = NextResponse.redirect(destination, 303);
  await rememberEmailOnLogout(res, email);
  clearSessionCookies(res);
  return noStore(res);
}

export async function POST(request: Request) {
  return logoutRedirect(request);
}

export async function GET(request: Request) {
  return logoutRedirect(request);
}