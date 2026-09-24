import "server-only";

import { createHash, randomBytes } from "crypto";
import { BRAND_NAME } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend-mail";
import { appBaseUrl } from "@/lib/sms";

const INVITE_DAYS = 14;

/** The only people who can send an affiliate invite. */
export const AFFILIATE_INVITER_EMAILS = new Set([
  "john@thetrainstation.co",
  "john@lemonvoice.com",
  "jeremy@thetrainstation.co",
]);

export function canSendAffiliateInvite(email: string | null | undefined): boolean {
  return AFFILIATE_INVITER_EMAILS.has((email || "").trim().toLowerCase());
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendAffiliateInvite(input: {
  name: string;
  email: string;
  invitedByEmail: string;
}): Promise<{ ok: true; link: string; emailed: boolean } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name || !email.includes("@")) return { ok: false, error: "Name and email are required." };
  const existing = await prisma.affiliate.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "That person already has an affiliate account." };

  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.affiliateInvite.deleteMany({
    where: { email, acceptedAt: null },
  });
  await prisma.affiliateInvite.create({
    data: {
      email,
      name,
      tokenHash: hashToken(raw),
      invitedByEmail: input.invitedByEmail.trim().toLowerCase(),
      expiresAt,
    },
  });

  const link = `${appBaseUrl().replace(/\/$/, "")}/affiliate/invite?token=${encodeURIComponent(raw)}`;
  const sent = await sendResendEmail({
    to: email,
    subject: `You’re invited to the ${BRAND_NAME} affiliate program`,
    text: `${name},\n\n${BRAND_NAME} invited you to share a membership link and earn when someone joins.\n\nOpen this page to create your account. The link is good for ${INVITE_DAYS} days.\n\n${link}\n`,
    html: `<p>${name},</p><p>${BRAND_NAME} invited you to share a membership link and earn when someone joins.</p><p><a href="${link}">Create your affiliate account</a></p><p>This link is good for ${INVITE_DAYS} days.</p>`,
    ctaUrl: link,
    ctaLabel: "Create your affiliate account",
  });
  return { ok: true, link, emailed: sent };
}

export async function readAffiliateInvite(rawToken: string): Promise<
  { ok: true; name: string; email: string } | { ok: false; error: string }
> {
  if (!rawToken || rawToken.length < 20) return { ok: false, error: "This invite link is not valid." };
  const row = await prisma.affiliateInvite.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!row || row.acceptedAt || row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, error: "This invite has expired. Ask John or Jeremy for a new one." };
  }
  return { ok: true, name: row.name, email: row.email };
}

export async function acceptAffiliateInvite(rawToken: string): Promise<
  { ok: true; name: string; email: string } | { ok: false; error: string }
> {
  const invite = await readAffiliateInvite(rawToken);
  if (!invite.ok) return invite;
  await prisma.affiliateInvite.update({
    where: { tokenHash: hashToken(rawToken) },
    data: { acceptedAt: new Date() },
  });
  return invite;
}
