import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo-enrollments";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { AFFILIATE_SESSION_COOKIE } from "@/lib/affiliate/cookies";
import { createAffiliateToken, verifyAffiliateToken } from "@/lib/affiliate/token";

const SESSION_SECONDS = 7 * 24 * 60 * 60;

export async function authenticateAffiliate(email: string, password: string) {
  if (isDemoMode()) return null;
  const affiliate = await prisma.affiliate.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!affiliate || affiliate.status === "TERMINATED") return null;
  if (!verifyPassword(password, affiliate.passwordHash)) return null;
  return affiliate;
}

export function hashAffiliatePassword(password: string): string {
  return hashPassword(password);
}

export async function getAffiliateSession() {
  const jar = await cookies();
  const token = jar.get(AFFILIATE_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyAffiliateToken(token);
}

export async function getCurrentAffiliate() {
  const session = await getAffiliateSession();
  if (!session || isDemoMode()) return null;
  const affiliate = await prisma.affiliate.findUnique({ where: { id: session.affiliateId } });
  if (!affiliate || affiliate.status === "TERMINATED") return null;
  return affiliate;
}

export function applyAffiliateSessionCookie(
  res: NextResponse,
  affiliate: { id: string; email: string; name: string },
) {
  const token = createAffiliateToken({
    affiliateId: affiliate.id,
    email: affiliate.email,
    name: affiliate.name,
  });
  res.cookies.set(AFFILIATE_SESSION_COOKIE, token, sessionCookieOptions(SESSION_SECONDS));
}

export function clearAffiliateSessionCookie(res: NextResponse) {
  res.cookies.set(AFFILIATE_SESSION_COOKIE, "", sessionCookieOptions(0));
}
