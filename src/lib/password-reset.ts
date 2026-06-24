import "server-only";

import { normalizeAccountEmail } from "@/lib/account-email";
import { isInvitedAccountEmail } from "@/lib/invited-accounts";
import { getAllSignInAccounts, upsertSignInAccount } from "@/lib/member-accounts-store";
import { hashPassword } from "@/lib/password";
import { isDemoMode } from "@/lib/demo-enrollments";
import { appBaseUrl } from "@/lib/sms";
import { BRAND_NAME } from "@/lib/brand";
import {
  issuePasswordResetToken,
  lookupPasswordResetToken,
  revokePasswordResetToken,
} from "@/lib/password-reset-store";

const FROM =
  process.env.PASSWORD_RESET_FROM ||
  process.env.MEMBER_WELCOME_FROM ||
  process.env.LEAD_NOTIFY_FROM ||
  `${BRAND_NAME} <onboarding@resend.dev>`;

export const RESET_SUCCESS_MESSAGE =
  "If that email is on file, we sent a link to reset your password. Check your inbox (and spam).";

async function sendResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const subject = `${BRAND_NAME} — reset your password`;
  const text =
    `Hi,\n\n` +
    `Someone requested a password reset for your ${BRAND_NAME} account.\n\n` +
    `Set a new password here (link expires in 1 hour):\n${resetUrl}\n\n` +
    `If you didn't request this, you can ignore this email.\n\n` +
    `— ${BRAND_NAME}`;

  if (!apiKey) {
    console.log(`[PASSWORD RESET — not configured] To: ${to}\n${text}\n`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[PASSWORD RESET] Resend failed:", res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[PASSWORD RESET] send failed", err);
    return false;
  }
}

export async function setAccountPassword(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return { ok: false, detail: "Invalid email." };

  const accounts = await getAllSignInAccounts();
  const account = accounts[normalized];
  if (!account) return { ok: false, detail: "Account not found." };

  const passwordHash = hashPassword(password);

  await upsertSignInAccount({
    email: normalized,
    userId: account.userId,
    role: account.role,
    name: account.name || normalized.split("@")[0],
    phone: account.phone,
    passwordHash,
  });

  if (!isDemoMode()) {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.user.update({
        where: { email: normalized },
        data: { passwordHash },
      });
    } catch {
      /* sign-in mirror is enough for demo-style deploys */
    }
  }

  return { ok: true };
}

export async function requestPasswordReset(rawEmail: string): Promise<{
  message: string;
  emailed: boolean;
}> {
  const normalized = normalizeAccountEmail(rawEmail);
  if (!normalized) {
    return { message: RESET_SUCCESS_MESSAGE, emailed: false };
  }

  const invited = await isInvitedAccountEmail(normalized);
  if (!invited) {
    return { message: RESET_SUCCESS_MESSAGE, emailed: false };
  }

  const token = await issuePasswordResetToken(normalized);
  const resetUrl = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const emailed = await sendResetEmail(normalized, resetUrl);

  return { message: RESET_SUCCESS_MESSAGE, emailed };
}

export async function completePasswordReset(
  token: string,
  password: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  if (password.length < 8) {
    return { ok: false, detail: "Password must be at least 8 characters." };
  }

  const entry = await lookupPasswordResetToken(token);
  if (!entry) {
    return { ok: false, detail: "This reset link is invalid or has expired." };
  }

  const result = await setAccountPassword(entry.email, password);
  if (!result.ok) return result;

  await revokePasswordResetToken(token);
  return { ok: true };
}