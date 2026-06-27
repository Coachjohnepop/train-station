import "server-only";

import type { UserRole } from "@/lib/auth-session";
import { normalizeAccountEmail } from "@/lib/account-email";
import { isDemoMode } from "@/lib/demo-enrollments";
import { isInvitedAccountEmail } from "@/lib/invited-accounts";
import { getAllSignInAccounts, upsertSignInAccount } from "@/lib/member-accounts-store";
import { hashPassword } from "@/lib/password";
import { appBaseUrl } from "@/lib/sms";
import { BRAND_NAME } from "@/lib/brand";
import { sendResendEmail, transactionalSubject } from "@/lib/resend-mail";
import {
  issuePasswordResetToken,
  lookupPasswordResetToken,
  revokePasswordResetToken,
} from "@/lib/password-reset-store";

export const RESET_SUCCESS_MESSAGE =
  "If that email is on file, we sent a link to set your password. Check your inbox (and spam folder).";

const RESET_SEND_FAILED_MESSAGE =
  "We found your account but couldn't send the reset email right now. Please try again in a few minutes.";

type SignInAccountRef = {
  userId: string;
  role: UserRole;
  name?: string;
  phone?: string | null;
  passwordHash?: string | null;
};

async function resolveSignInAccount(email: string): Promise<SignInAccountRef | null> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return null;

  const accounts = await getAllSignInAccounts();
  const stored = accounts[normalized];
  if (stored) {
    return {
      userId: stored.userId,
      role: stored.role,
      name: stored.name,
      phone: stored.phone ?? null,
      passwordHash: stored.passwordHash ?? null,
    };
  }

  if (isDemoMode()) return null;

  try {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user || user.hidden) return null;
    return {
      userId: user.id,
      role: user.role as UserRole,
      name: user.name || normalized.split("@")[0],
      phone: user.phone,
      passwordHash: user.passwordHash,
    };
  } catch {
    return null;
  }
}

async function sendResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const text =
    `Hello,\n\n` +
    `We received a request to reset the password for ${to} on ${BRAND_NAME}.\n\n` +
    `Open this link to choose a new password (expires in 1 hour):\n` +
    `${resetUrl}\n\n` +
    `If you did not request a password reset, you can safely ignore this email. Your password will not change.\n\n` +
    `— ${BRAND_NAME}\n` +
    `https://www.thetrainstation.co`;

  return sendResendEmail({
    to,
    subject: transactionalSubject("password-reset"),
    text,
    ctaUrl: resetUrl,
    ctaLabel: "Reset password",
    replyTo: process.env.RESEND_REPLY_TO?.trim() || "jeremy@thetrainstation.co",
    tags: [{ name: "category", value: "password-reset" }],
    headers: {
      "X-Auto-Response-Suppress": "All",
      "Auto-Submitted": "auto-generated",
    },
  });
}

export async function setAccountPassword(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return { ok: false, detail: "Invalid email." };

  const account = await resolveSignInAccount(normalized);
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

  const account = await resolveSignInAccount(normalized);
  if (!account) {
    return { message: RESET_SUCCESS_MESSAGE, emailed: false };
  }

  await upsertSignInAccount({
    email: normalized,
    userId: account.userId,
    role: account.role,
    name: account.name || normalized.split("@")[0],
    phone: account.phone,
    passwordHash: account.passwordHash ?? null,
  });

  const token = await issuePasswordResetToken(normalized);
  const resetUrl = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(normalized)}`;
  const emailed = await sendResetEmail(normalized, resetUrl);

  return {
    message: emailed ? RESET_SUCCESS_MESSAGE : RESET_SEND_FAILED_MESSAGE,
    emailed,
  };
}

export async function completePasswordReset(
  token: string,
  password: string,
): Promise<{ ok: true; email: string } | { ok: false; detail: string }> {
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
  return { ok: true, email: entry.email };
}