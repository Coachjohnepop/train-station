import { Suspense } from "react";
import Link from "next/link";
import { lookupPasswordResetToken } from "@/lib/password-reset-store";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = rawToken?.trim() || "";
  const accountEmail = token ? (await lookupPasswordResetToken(token))?.email ?? null : null;

  return (
    <div className="app-shell-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-tight text-[var(--accent)]">The Train Station</p>
          <h1 className="mt-4 text-2xl font-bold">Set a new password</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Choose a password you&apos;ll use to sign in from now on.
          </p>
        </div>

        <Suspense fallback={<div className="card text-sm text-[var(--muted)]">Loading…</div>}>
          <ResetPasswordForm token={token} accountEmail={accountEmail} />
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