/**
 * Edge-safe session verification for middleware (no Node crypto / Buffer).
 * Must stay algorithm-compatible with auth-session.ts on the server.
 */

export const SESSION_COOKIE = "ts_session";

export type UserRole = "ADMIN" | "INSTRUCTOR" | "MEMBER" | "PROSPECTIVE_INSTRUCTOR";

export type SessionPayload = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  exp: number;
};

function sessionSecret(): string {
  return process.env.SESSION_SECRET || "train-station-dev-session-secret-change-me";
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const base64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySessionTokenEdge(token: string): Promise<SessionPayload | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(sessionSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const expected = bytesToBase64Url(new Uint8Array(mac));
    if (!safeEqual(sig, expected)) return null;

    const json = new TextDecoder().decode(base64UrlToBytes(body));
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}