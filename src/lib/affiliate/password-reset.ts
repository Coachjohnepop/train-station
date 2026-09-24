import "server-only";

import { createHash, randomBytes } from "crypto";
import { BRAND_NAME } from "@/lib/brand";
import { isDemoMode } from "@/lib/demo-enrollments";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend-mail";
import { appBaseUrl } from "@/lib/sms";
import { hashAffiliatePassword } from "@/lib/affiliate/auth";

const TTL_MS = 60 * 60 * 1000;

export const AFFILIATE_RESET_SENT =
  "If that email is an affiliate account, we sent a link. Check your inbox and spam folder.";

export const AFFILIATE_RESET_REUSED =
  "That reset link is still good. We did not send another. Open the email you already have.";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestAffiliatePasswordReset(email: string): Promise<{
  ok: boolean;
  message: string;
}> {
  if (isDemoMode()) {
    return { ok: false, message: "Affiliate reset needs the live database." };
  }
  const normalized = email.trim().toLowerCase();
  const affiliate = await prisma.affiliate.findUnique({ where: { email: normalized } });
  if (!affiliate || affiliate.status === "TERMINATED") {
    return { ok: true, message: AFFILIATE_RESET_SENT };
  }

  const now = new Date();
  const live = await prisma.affiliateResetToken.findFirst({
    where: { affiliateId: affiliate.id, expiresAt: { gt: now }, rawToken: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (live?.rawToken) {
    return { ok: true, message: AFFILIATE_RESET_REUSED };
  }

  const raw = randomBytes(32).toString("base64url");
  await prisma.affiliateResetToken.create({
    data: {
      tokenHash: hashToken(raw),
      affiliateId: affiliate.id,
      rawToken: raw,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  const link = `${appBaseUrl().replace(/\/$/, "")}/affiliate?view=reset&token=${encodeURIComponent(raw)}`;
  const sent = await sendResendEmail({
    to: affiliate.email,
    subject: `Reset your ${BRAND_NAME} affiliate password`,
    text: `Use this link within one hour to set a new affiliate password:\n\n${link}\n\nIf you did not ask for this, you can ignore the email.`,
    html: `<p>Use this link within one hour to set a new affiliate password.</p><p><a href="${link}">Reset password</a></p>`,
    ctaUrl: link,
    ctaLabel: "Reset password",
  });
  if (!sent) {
    return { ok: false, message: "We could not send the reset email. Try again in a few minutes." };
  }
  return { ok: true, message: AFFILIATE_RESET_SENT };
}

export async function resetAffiliatePassword(rawToken: string, password: string): Promise<{
  ok: boolean;
  message: string;
}> {
  if (isDemoMode()) return { ok: false, message: "Affiliate reset needs the live database." };
  if (password.length < 8) {
    return { ok: false, message: "Choose a password with at least 8 characters." };
  }
  const row = await prisma.affiliateResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, message: "That reset link has expired. Request a new one." };
  }
  await prisma.affiliate.update({
    where: { id: row.affiliateId },
    data: { passwordHash: hashAffiliatePassword(password) },
  });
  await prisma.affiliateResetToken.deleteMany({ where: { affiliateId: row.affiliateId } });
  return { ok: true, message: "Password updated. Sign in with the new one." };
}
