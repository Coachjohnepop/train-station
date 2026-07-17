import "server-only";

import { getSessionUser, isStaffRole } from "@/lib/auth";

export async function requireCoachChatAccess() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return { ok: false as const, error: "Coach access required" };
  }
  return { ok: true as const, session };
}

/**
 * Coach can upload image or short video.
 * Members can upload images only (paste/photo in reply box).
 */
export async function requireChatMediaUploadAccess(kind: "image" | "video" | string) {
  const session = await getSessionUser();
  if (!session) {
    return { ok: false as const, error: "Sign in required" };
  }
  if (isStaffRole(session.role)) {
    return { ok: true as const, session, as: "coach" as const };
  }
  if (session.role === "MEMBER" && kind === "image") {
    return { ok: true as const, session, as: "member" as const };
  }
  return { ok: false as const, error: kind === "image" ? "Sign in required" : "Coach access required" };
}

/** Reject arbitrary remote URLs — only our chat upload paths. */
export function isAllowedChatMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/uploads/chat/")) return true;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return (
      host.endsWith(".public.blob.vercel-storage.com") ||
      host.endsWith(".blob.vercel-storage.com") ||
      host === "public.blob.vercel-storage.com"
    );
  } catch {
    return false;
  }
}