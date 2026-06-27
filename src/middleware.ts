import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionTokenEdge, SESSION_COOKIE } from "@/lib/auth-session-edge";

const NEEDS_ONBOARD_COOKIE = "ts_needs_onboard";
const SIGNUP_PLAN_COOKIE = "ts_signup_plan";
const NEEDS_PAYMENT_COOKIE = "ts_needs_payment";
const PENDING_APPROVAL_COOKIE = "ts_pending_approval";

/** Public pages — no session required. */
const PUBLIC_PAGE_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/signup",
  "/coming-soon",
  "/join",
];

/** Public API routes — webhooks, auth, signup only. Everything else requires a session. */
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/signup",
  "/api/join",
  "/api/payments/public",
  "/api/pricing/public",
  "/api/stripe/webhook",
  "/api/sms/inbound",
];

function isPublicPage(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function sessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? await verifySessionTokenEdge(token) : null;
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

  // Lock down API routes: anonymous callers get 401 unless explicitly public.
  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }

    const session = await sessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.next();
  }

  if (isPublicPage(pathname)) {
    return NextResponse.next();
  }

  const needsAuth = pathname.startsWith("/member") || pathname.startsWith("/admin");
  if (!needsAuth) {
    return NextResponse.next();
  }

  const session = await sessionFromRequest(request);
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/admin") && session.role !== "ADMIN" && session.role !== "INSTRUCTOR") {
    return NextResponse.redirect(new URL("/member", request.url));
  }

  const platformAdminOnly =
    pathname === "/admin/platform" ||
    pathname.startsWith("/admin/platform/") ||
    pathname.startsWith("/admin/commission") ||
    pathname.startsWith("/admin/pricing") ||
    pathname.startsWith("/admin/offers") ||
    pathname.startsWith("/admin/users") ||
    pathname.startsWith("/admin/reports");
  if (platformAdminOnly && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (session.role === "MEMBER" && pathname.startsWith("/member")) {
    const plan =
      request.nextUrl.searchParams.get("plan") ||
      request.cookies.get(SIGNUP_PLAN_COOKIE)?.value;

    if (
      !pathname.startsWith("/member/checkout") &&
      request.cookies.get(NEEDS_PAYMENT_COOKIE)?.value === "1"
    ) {
      const checkout = new URL("/member/checkout", request.url);
      if (plan) checkout.searchParams.set("plan", plan);
      return NextResponse.redirect(checkout);
    }

    if (
      !pathname.startsWith("/member/onboard") &&
      !pathname.startsWith("/member/checkout") &&
      request.cookies.get(NEEDS_ONBOARD_COOKIE)?.value === "1" &&
      request.cookies.get(NEEDS_PAYMENT_COOKIE)?.value !== "1"
    ) {
      const onboard = new URL("/member/onboard", request.url);
      if (plan) onboard.searchParams.set("plan", plan);
      return NextResponse.redirect(onboard);
    }

    if (
      !pathname.startsWith("/member/pending") &&
      request.cookies.get(PENDING_APPROVAL_COOKIE)?.value === "1"
    ) {
      return NextResponse.redirect(new URL("/member/pending", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};