import { createHmac, timingSafeEqual } from "crypto";
import { resolveSessionSecret } from "@/lib/session-secret";

export type AffiliateTokenPayload = {
  affiliateId: string;
  email: string;
  name: string;
  type: "affiliate";
  exp: number;
};

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function sign(body: string): string {
  return createHmac("sha256", resolveSessionSecret()).update(body).digest("base64url");
}

export function createAffiliateToken(input: {
  affiliateId: string;
  email: string;
  name: string;
}): string {
  const payload: AffiliateTokenPayload = {
    affiliateId: input.affiliateId,
    email: input.email,
    name: input.name,
    type: "affiliate",
    exp: Date.now() + SESSION_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyAffiliateToken(token: string): AffiliateTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AffiliateTokenPayload;
    if (payload.type !== "affiliate") return null;
    if (!payload.affiliateId || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
