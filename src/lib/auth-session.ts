import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "ts_session";

export type UserRole = "ADMIN" | "INSTRUCTOR" | "MEMBER" | "PROSPECTIVE_INSTRUCTOR";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

type SessionPayload = SessionUser & { exp: number };

function sessionSecret(): string {
  return process.env.SESSION_SECRET || "train-station-dev-session-secret-change-me";
}

function signPayload(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(user: SessionUser): string {
  const payload: SessionPayload = {
    ...user,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  return signPayload(payload);
}

export function isStaffRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "INSTRUCTOR";
}