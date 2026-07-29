import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionTokenEdge, SESSION_COOKIE } from "@/lib/auth-session-edge";
import { isStaffRole, staffAdminRedirect } from "@/lib/staff-access";
import { purchaseHref } from "@/lib/member-purchase-path";
import { memberPathRequiresPayment } from "@/lib/member-route-gates";

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
  "/api/calendly/webhook",
  "/api/sms/inbound",
  "/api/sms/status", // Twilio delivery receipts (signed)
  "/api/analytics",
  // Product photos for <img> — same-origin proxy; no secrets, catalog ids only
  "/api/equipment/image",
  // Safe read-only public config (no secrets)
  "/api/landing-media",
  "/api/brand/public",
  // Web Push VAPID public key is meant to be public (private key stays server-side)
  "/api/push/vapid-public-key",
  // Vercel Cron + manual Bearer CRON_SECRET — each route still authorizes
  "/api/cron",
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

/** Pass pathname into server layouts (onboarding gate reads x-pathname). */
function nextWithPath(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
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
      return nextWithPath(request, pathname);
    }

    // Ops bootstrap: Bearer OPS_BOOTSTRAP_SECRET / CRON_SECRET (no session cookie).
    if (pathname === "/api/admin/ops/stripe-bootstrap") {
      const secret =
        process.env.OPS_BOOTSTRAP_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
      const header = request.headers.get("authorization") || "";
      if (secret && header === `Bearer ${secret}`) {
        return NextResponse.next();
      }
      // else fall through — staff session still allowed
    }

    const session = await sessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    if (pathname.startsWith("/api/admin/") && !isStaffRole(session.role)) {
      return NextResponse.json({ error: "Staff access required." }, { status: 403 });
    }

    if (pathname.startsWith("/api/dev/") && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    return NextResponse.next();
  }

  if (pathname === "/signup" || pathname.startsWith("/signup/")) {
    const session = await sessionFromRequest(request);
    if (session) {
      const plan = request.nextUrl.searchParams.get("plan");
      const interest = request.nextUrl.searchParams.get("interest");
      const isWaitlistOnly = Boolean(interest && !plan);
      if (!isWaitlistOnly) {
        const href = purchaseHref(plan || "explorer", { signedIn: true, role: session.role }, {
          quote: request.nextUrl.searchParams.get("quote") === "1",
        });
        if (session.role === "MEMBER" || isStaffRole(session.role)) {
          return NextResponse.redirect(new URL(href, request.url));
        }
      }
    }
    return NextResponse.next();
  }

  if (isPublicPage(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/setup-quick-auth") {
    const session = await sessionFromRequest(request);
    if (!session) {
      const login = new URL("/login", request.url);
      login.searchParams.set("redirect", pathname);
      return NextResponse.redirect(login);
    }
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

  if (pathname.startsWith("/admin") && !isStaffRole(session.role)) {
    return NextResponse.redirect(new URL("/member/today", request.url));
  }

  const staffRedirect = staffAdminRedirect(pathname, session.role);
  if (staffRedirect) {
    return NextResponse.redirect(new URL(staffRedirect, request.url));
  }

  if (pathname === "/member") {
    // Cookie shortcut when present; otherwise /member/page.tsx resolves from DB profile
    // (cookie-only was skipping free Explorer past the onboarding wizard).
    if (
      session.role === "MEMBER" &&
      request.cookies.get(NEEDS_ONBOARD_COOKIE)?.value === "1" &&
      request.cookies.get(NEEDS_PAYMENT_COOKIE)?.value !== "1"
    ) {
      const plan =
        request.nextUrl.searchParams.get("plan") ||
        request.cookies.get(SIGNUP_PLAN_COOKIE)?.value;
      const onboard = new URL("/member/onboard", request.url);
      if (plan) onboard.searchParams.set("plan", plan);
      return NextResponse.redirect(onboard);
    }
    return nextWithPath(request, pathname);
  }

  if (session.role === "MEMBER") {
    const plan =
      request.nextUrl.searchParams.get("plan") ||
      request.cookies.get(SIGNUP_PLAN_COOKIE)?.value;

    // Landing home while still onboarding → back to wizard
    if (
      (pathname === "/" || pathname === "") &&
      request.cookies.get(NEEDS_ONBOARD_COOKIE)?.value === "1" &&
      request.cookies.get(NEEDS_PAYMENT_COOKIE)?.value !== "1"
    ) {
      const onboard = new URL("/member/onboard", request.url);
      if (plan) onboard.searchParams.set("plan", plan);
      return NextResponse.redirect(onboard);
    }

    if (pathname.startsWith("/member")) {
      if (
        memberPathRequiresPayment(pathname) &&
        request.cookies.get(NEEDS_PAYMENT_COOKIE)?.value === "1"
      ) {
        const checkout = new URL("/member/checkout", request.url);
        if (plan) checkout.searchParams.set("plan", plan);
        return NextResponse.redirect(checkout);
      }

      // While onboarding: keep them in the wizard for Today / training routes,
      // but allow Account (settings, payment confirmation) and checkout paths.
      if (
        request.cookies.get(NEEDS_ONBOARD_COOKIE)?.value === "1" &&
        request.cookies.get(NEEDS_PAYMENT_COOKIE)?.value !== "1"
      ) {
        const onboardAllowed =
          pathname.startsWith("/member/onboard") ||
          pathname.startsWith("/member/checkout") ||
          pathname.startsWith("/member/account");
        if (!onboardAllowed) {
          const onboard = new URL("/member/onboard", request.url);
          if (plan) onboard.searchParams.set("plan", plan);
          return NextResponse.redirect(onboard);
        }
      }

      if (
        !pathname.startsWith("/member/pending") &&
        request.cookies.get(PENDING_APPROVAL_COOKIE)?.value === "1"
      ) {
        return NextResponse.redirect(new URL("/member/pending", request.url));
      }
    }
  }

  return nextWithPath(request, pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};