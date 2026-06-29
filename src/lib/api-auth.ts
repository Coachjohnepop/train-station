import "server-only";

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  canAccessCoachAdmin,
  canAccessPlatformAdmin,
  isStaffRole,
} from "@/lib/staff-access";
import type { SessionUser } from "@/lib/auth-session";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { memberHasFullAccess } from "@/lib/member-gates";

export type AuthResult =
  | { ok: true; session: SessionUser }
  | { ok: false; response: NextResponse };

function unauthorized(message = "Sign in required."): AuthResult {
  return { ok: false, response: NextResponse.json({ error: message }, { status: 401 }) };
}

function forbidden(message = "Forbidden."): AuthResult {
  return { ok: false, response: NextResponse.json({ error: message }, { status: 403 }) };
}

export async function requireSession(): Promise<AuthResult> {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  return { ok: true, session };
}

export async function requireStaff(): Promise<AuthResult> {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  if (!isStaffRole(session.role)) return forbidden("Staff access required.");
  return { ok: true, session };
}

export async function requireCoachStaff(): Promise<AuthResult> {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  if (!canAccessCoachAdmin(session.role)) return forbidden("Coach staff access required.");
  return { ok: true, session };
}

export async function requirePlatformStaff(): Promise<AuthResult> {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  if (!canAccessPlatformAdmin(session.role)) return forbidden("Platform staff access required.");
  return { ok: true, session };
}

export async function requireMember(): Promise<AuthResult> {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  if (session.role !== "MEMBER") return forbidden("Member access required.");
  return { ok: true, session };
}

/** Members must be paid + approved; staff always pass. */
export async function requireMemberAccess(): Promise<AuthResult> {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  if (isStaffRole(session.role)) {
    return { ok: true, session };
  }

  if (session.role !== "MEMBER") {
    return forbidden("Member access required.");
  }

  const profile = await getMemberProfile(session.id);
  if (!memberHasFullAccess(profile, session.id)) {
    return forbidden("Complete payment or wait for coach approval.");
  }

  return { ok: true, session };
}

/** Staff may access any userId; members only their own. Returns a 403 response when out of scope. */
export function assertUserScope(session: SessionUser, userId: string): NextResponse | null {
  if (isStaffRole(session.role)) return null;
  if (session.id !== userId) {
    const denied = forbidden("You can only access your own data.");
    return denied.ok ? null : denied.response;
  }
  return null;
}