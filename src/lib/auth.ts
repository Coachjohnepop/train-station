import "server-only";

import { cookies } from "next/headers";
import { hashPassword, verifyPassword } from "@/lib/password";
import { MEMBER_COOKIE, MEMBER_NAME_COOKIE } from "@/lib/current-user";
import { normalizeAccountEmail } from "@/lib/account-email";
import { getAllSignInAccounts } from "@/lib/member-accounts-store";
import { resolveDemoUser, resolveDemoUserByEmail } from "@/lib/demo-user-directory";
import { isDemoMode } from "@/lib/demo-enrollments";
import {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
  isStaffRole,
  type SessionUser,
  type UserRole,
} from "@/lib/auth-session";
import type { MemberProfile } from "@/lib/member-profiles-store";
import {
  memberNeedsApproval,
  memberNeedsPayment,
} from "@/lib/member-gates";
import { allowBlankPasswordLogin } from "@/lib/security-config";

export type { SessionUser, UserRole };
export { SESSION_COOKIE, verifySessionToken, isStaffRole, resolveDemoUserByEmail };

type DemoAccount = {
  userId: string;
  role: UserRole;
  passwordHash?: string;
  name?: string;
  phone?: string;
};

const SESSION_DAYS = 30;
export const NEEDS_ONBOARD_COOKIE = "ts_needs_onboard";
export const SIGNUP_PLAN_COOKIE = "ts_signup_plan";
export const NEEDS_PAYMENT_COOKIE = "ts_needs_payment";
export const PENDING_APPROVAL_COOKIE = "ts_pending_approval";

export { hashPassword, verifyPassword };

async function loadDemoAccounts(): Promise<Record<string, DemoAccount>> {
  return getAllSignInAccounts();
}

function passwordAccepted(password: string, storedHash?: string | null): boolean {
  if (!storedHash) {
    return allowBlankPasswordLogin();
  }
  if (!password) return false;
  return verifyPassword(password, storedHash);
}

function sessionFromDemoAccount(normalized: string, account: DemoAccount): SessionUser {
  const user = resolveDemoUser(account.userId);
  return {
    id: account.userId,
    email: normalized,
    name: account.name || user?.name || "Member",
    role: account.role,
  };
}

/** Sign in from an account record already in hand (avoids blob re-read after register). */
export function sessionFromStoredAccount(
  email: string,
  account: {
    userId: string;
    role: UserRole;
    name?: string | null;
    passwordHash?: string | null;
  },
  password: string,
): SessionUser | null {
  const normalized = normalizeAccountEmail(email);
  if (!normalized || !passwordAccepted(password, account.passwordHash ?? null)) return null;
  return sessionFromDemoAccount(normalized, {
    userId: account.userId,
    role: account.role,
    name: account.name ?? undefined,
    passwordHash: account.passwordHash ?? undefined,
  });
}

export async function authenticateCredentials(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return null;

  const demoAccount = (await loadDemoAccounts())[normalized];
  if (demoAccount && passwordAccepted(password, demoAccount.passwordHash)) {
    return sessionFromDemoAccount(normalized, demoAccount);
  }

  if (isDemoMode()) {
    return null;
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user || user.hidden || !passwordAccepted(password, user.passwordHash)) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name || "Member",
      role: user.role as UserRole,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  return {
    id: payload.id,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  };
}

export function sessionCookieOptions(maxAge = SESSION_DAYS * 24 * 60 * 60) {
  return {
    path: "/",
    maxAge,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function applySessionCookies(
  res: { cookies: { set: (name: string, value: string, opts?: object) => void } },
  user: SessionUser,
) {
  const token = createSessionToken(user);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  res.cookies.set(MEMBER_COOKIE, user.id, { path: "/", maxAge: SESSION_DAYS * 24 * 60 * 60 });
  res.cookies.set(MEMBER_NAME_COOKIE, user.name, { path: "/", maxAge: SESSION_DAYS * 24 * 60 * 60 });
}

export function clearSessionCookies(
  res: { cookies: { set: (name: string, value: string, opts?: object) => void } },
) {
  const clear = { path: "/", maxAge: 0 };
  res.cookies.set(SESSION_COOKIE, "", clear);
  res.cookies.set(MEMBER_COOKIE, "", clear);
  res.cookies.set(MEMBER_NAME_COOKIE, "", clear);
  res.cookies.set(NEEDS_ONBOARD_COOKIE, "", clear);
  res.cookies.set(SIGNUP_PLAN_COOKIE, "", clear);
  res.cookies.set(NEEDS_PAYMENT_COOKIE, "", clear);
  res.cookies.set(PENDING_APPROVAL_COOKIE, "", clear);
}

export function applyNewMemberOnboardingCookie(
  res: { cookies: { set: (name: string, value: string, opts?: object) => void } },
  plan?: string,
) {
  const cookieOpts = {
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  res.cookies.set(NEEDS_ONBOARD_COOKIE, "1", cookieOpts);
  if (plan) {
    res.cookies.set(SIGNUP_PLAN_COOKIE, plan, cookieOpts);
  }
}

export function clearNewMemberOnboardingCookie(
  res: { cookies: { set: (name: string, value: string, opts?: object) => void } },
) {
  res.cookies.set(NEEDS_ONBOARD_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(SIGNUP_PLAN_COOKIE, "", { path: "/", maxAge: 0 });
}

type CookieWriter = {
  cookies: { set: (name: string, value: string, opts?: object) => void };
};

function gateCookieOptions() {
  return {
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Keep payment + approval gate cookies aligned with the member profile. */
export function syncMemberGateCookies(
  res: CookieWriter,
  input: { userId: string; profile: MemberProfile | null },
) {
  const clear = { path: "/", maxAge: 0 };
  const opts = gateCookieOptions();

  if (memberNeedsPayment(input.profile, input.userId)) {
    res.cookies.set(NEEDS_PAYMENT_COOKIE, "1", opts);
  } else {
    res.cookies.set(NEEDS_PAYMENT_COOKIE, "", clear);
  }

  if (memberNeedsApproval(input.profile, input.userId)) {
    res.cookies.set(PENDING_APPROVAL_COOKIE, "1", opts);
  } else {
    res.cookies.set(PENDING_APPROVAL_COOKIE, "", clear);
  }
}