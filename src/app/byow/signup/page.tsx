"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import EmailInput, { rememberEmail } from "@/components/EmailInput";
import PasswordInput from "@/components/PasswordInput";
import { offerSavePasswordFromForm } from "@/lib/browser-credentials";
import { generateSignupPassword } from "@/lib/signup-password";
import { NextStepButton } from "@/components/NextStepButton";

function ByowSignupForm() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordRevealToken, setPasswordRevealToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function autoGeneratePassword() {
    const generated = generateSignupPassword();
    setPassword(generated);
    setConfirmPassword(generated);
    setPasswordRevealToken((n) => n + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      const res = await fetch("/api/signup/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
          channel: "byow",
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError(data.error || "Account exists — sign in instead.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Something went wrong — try again.");
        return;
      }
      rememberEmail(email);
      await offerSavePasswordFromForm(formRef.current);
      window.location.href = data.redirectTo || "/byow";
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} autoComplete="on" className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}{" "}
          {(error.includes("exists") || error.includes("sign-in")) && (
            <Link href="/login?redirect=/byow" className="underline">
              Sign in
            </Link>
          )}
        </p>
      ) : null}
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Email</label>
        <EmailInput
          id="byow-email"
          name="username"
          autoComplete="username"
          variant="signup"
          required
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Password</label>
        <PasswordInput
          id="byow-password"
          variant="signup"
          name="password"
          purpose="new"
          required
          minLength={8}
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          revealToken={passwordRevealToken}
        />
        <button
          type="button"
          onClick={() => void autoGeneratePassword()}
          className="mt-2 rounded-full border border-[#7c3aed]/50 bg-[#7c3aed]/15 px-4 py-2 text-xs font-semibold text-[#c4b5fd]"
        >
          Auto Generate
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Confirm password</label>
        <PasswordInput
          id="byow-password-confirm"
          variant="signup"
          name="password-confirm"
          purpose="confirm"
          required
          minLength={8}
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
          revealToken={passwordRevealToken}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-[var(--muted)]">First name</label>
          <input
            required
            name="given-name"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-[var(--muted)]">Last name</label>
          <input
            required
            name="family-name"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm"
          />
        </div>
      </div>
      <NextStepButton type="submit" disabled={loading}>
        {loading ? "Creating account…" : "Create free account"}
      </NextStepButton>
    </form>
  );
}

export default function ByowSignupPage() {
  return (
    <div className="space-y-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
        Hidden · BYOW · free
      </p>
      <h1 className="font-serif text-3xl">Create your notes account</h1>
      <p className="text-sm text-[var(--muted)]">
        Same signup as the main site — no ticket, no card. Upload notes and run them in the
        console.
      </p>
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
        <ByowSignupForm />
      </Suspense>
      <p className="text-xs text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login?redirect=/byow" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
