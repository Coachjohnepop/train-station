import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionTokenEdge, SESSION_COOKIE } from "@/lib/auth-session-edge";

const NEEDS_ONBOARD_COOKIE = "ts_needs_onboard";
const SIGNUP_PLAN_COOKIE = "ts_signup_plan";

const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/signup",
  "/coming-soon",
  "/join",
  "/api/auth",
  "/api/signup",
  "/api/sms/inbound",
  "/api/join",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|webp)$/)
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const needsAuth = pathname.startsWith("/member") || pathname.startsWith("/admin");
  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionTokenEdge(token) : null;

  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/admin") && session.role !== "ADMIN" && session.role !== "INSTRUCTOR") {
    return NextResponse.redirect(new URL("/member", request.url));
  }

  if (
    session.role === "MEMBER" &&
    pathname.startsWith("/member") &&
    !pathname.startsWith("/member/onboard") &&
    request.cookies.get(NEEDS_ONBOARD_COOKIE)?.value === "1"
  ) {
    const onboard = new URL("/member/onboard", request.url);
    const plan =
      request.nextUrl.searchParams.get("plan") ||
      request.cookies.get(SIGNUP_PLAN_COOKIE)?.value;
    if (plan) onboard.searchParams.set("plan", plan);
    return NextResponse.redirect(onboard);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};