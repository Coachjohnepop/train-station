import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";
import { DEFAULT_DEMO_MEMBER_ID } from "@/lib/demo-coach";

export const MEMBER_COOKIE = "ts_uid";
export const MEMBER_NAME_COOKIE = "ts_name";

export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const uid = cookieStore.get(MEMBER_COOKIE)?.value;
  if (uid) return uid;
  return null;
}

export async function getCurrentUserName(): Promise<string | null> {
  const cookieStore = await cookies();
  const name = cookieStore.get(MEMBER_NAME_COOKIE)?.value;
  if (name) return name;
  return null;
}

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
};

/**
 * Returns the current joined member (from cookie) or null.
 * In real DB mode tries to load from prisma.
 * In demo mode returns a synthetic from cookies (or falls back to demo-user).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;

  const nameFromCookie = await getCurrentUserName();

  if (isDemoMode()) {
    // Demo / no real DB: return cookie-backed identity (join flow sets it)
    return {
      id: uid,
      name: nameFromCookie || "Member",
      email: null,
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, name: true, email: true },
    });
    if (user) {
      return {
        id: user.id,
        name: user.name || nameFromCookie,
        email: user.email,
      };
    }
  } catch {
    // fall through to cookie synthetic
  }

  return {
    id: uid,
    name: nameFromCookie || "Member",
    email: null,
  };
}

/**
 * Helper for data layers: resolve the effective user id for data (cookie first, then demo fallback).
 */
export async function resolveUserId(fallback: string = DEFAULT_DEMO_MEMBER_ID): Promise<string> {
  const uid = await getCurrentUserId();
  return uid || fallback;
}

/** Member-area routes: logged-in members use session id (not a stale coach cookie). */
export async function resolveMemberUserId(
  fallback: string = DEFAULT_DEMO_MEMBER_ID,
): Promise<string> {
  const session = await getSessionUser();
  if (session && !isStaffRole(session.role)) {
    return session.id;
  }
  return resolveUserId(fallback);
}

export type UserLocation = {
  city: string | null;
  state: string | null;
};

/**
 * Gets member's training location from cookies (demo/onboard) or DB (real).
 * Falls back to demo defaults in demo mode.
 */
export async function getCurrentUserLocation(): Promise<UserLocation> {
  const cookieStore = await cookies();
  const city = cookieStore.get("ts_city")?.value || null;
  const state = cookieStore.get("ts_state")?.value || null;

  if (isDemoMode()) {
    return {
      city: city || "Austin",
      state: state || "TX",
    };
  }

  const uid = await getCurrentUserId();
  if (uid) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: uid },
        select: { city: true, state: true },
      });
      if (user) {
        return {
          city: user.city || city,
          state: user.state || state,
        };
      }
    } catch {}
  }

  return { city, state };
}
