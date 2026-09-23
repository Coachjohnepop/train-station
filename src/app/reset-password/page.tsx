import { Suspense } from "react";
import Link from "next/link";
import { normalizeAccountEmail } from "@/lib/account-email";
import { lookupPasswordResetToken } from "@/lib/password-reset-store";
import ResetPasswordRequestForm from "@/components/ResetPasswordRequestForm";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token: rawToken, email: rawEmail } = await searchParams;
  const token = rawToken?.trim() || "";
  const tokenEntry = token ? await lookupPasswordResetToken(token) : null;
  const accountEmail =
    tokenEntry?.email ?? (rawEmail ? normalizeAccountEmail(rawEmail) || null : null);
  const requesting = !token;

  return (
    <div className="app-shell-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-tight text-[var(--accent)]">The Train Station</p>
          <h1 className="mt-4 text-2xl font-bold">
            {requesting ? "Reset password" : "Set a new password"}
          </h1>
          {accountEmail && !requesting ? (
            <p className="mt-2 text-sm text-[var(--text)]">
              For <span className="font-medium text-accent">{accountEmail}</span>
            </p>
          ) : null}
          <p className="mt-2 text-sm text-[var(--muted)]">
            {requesting
              ? "Enter your email and we’ll send a link to set a new password."
              : "Choose a password you’ll use to sign in from now on."}
          </p>
        </div>

        <Suspense fallback={<div className="card text-sm text-[var(--muted)]">Loading…</div>}>
          {requesting ? (
            <ResetPasswordRequestForm initialEmail={accountEmail || ""} />
          ) : tokenEntry ? (
            <ResetPasswordForm token={token} accountEmail={accountEmail} />
          ) : (
            <div className="card space-y-3 text-sm text-[var(--muted)]">
              <p>This reset link is invalid or has expired.</p>
              <p>If you still have the first email and it is less than an hour old, use the Reset password button in it. Asking again does not replace that link.</p>
              <Link href="/reset-password" className="text-accent hover:underline">
                Request a reset link
              </Link>
            </div>
          )}
        </Suspense>

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}