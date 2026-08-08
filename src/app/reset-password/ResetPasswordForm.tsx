"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import { offerUpdateSavedPassword } from "@/lib/browser-credentials";
import { useFormAutofillSync } from "@/hooks/useFormAutofillSync";

export default function ResetPasswordForm({
  token,
  accountEmail,
}: {
  token: string;
  accountEmail: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [credentialPrompted, setCredentialPrompted] = useState(false);

  useFormAutofillSync(formRef, ["username", "password", "password-confirm"], (values) => {
    if (values.password) setPassword(values.password);
    if (values["password-confirm"]) setConfirmPassword(values["password-confirm"]);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is missing or invalid. Request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed — try again or request a new link.");
        return;
      }

      const email =
        typeof data.email === "string" ? data.email : accountEmail?.trim().toLowerCase() || "";
      setSavedEmail(email || null);

      const prompted = await offerUpdateSavedPassword({
        email,
        password,
        form: formRef.current,
      });
      setCredentialPrompted(prompted);
      setDone(true);
    } catch {
      setError("Reset failed — try again.");
    } finally {
      setLoading(false);
    }
  }

  function continueToSignIn() {
    const email = savedEmail || accountEmail || "";
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    params.set("passwordUpdated", "1");
    router.push(`/login?${params.toString()}`);
  }

  if (!token) {
    return (
      <div className="card space-y-4 text-sm text-[var(--muted)]">
        <p>This reset link is invalid. Request a new one from the forgot password page.</p>
        <Link href="/forgot-password" className="text-accent hover:underline">
          Request reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card space-y-4 text-sm">
        <p className="text-[var(--success)]">Password updated for {savedEmail || accountEmail}.</p>
        <p className="text-[var(--muted)]">
          {credentialPrompted
            ? "If your browser or keychain showed a save prompt, choose Update or Save so future sign-ins use this password."
            : "On the next screen, sign in once with your new password — your browser or keychain should offer to update the saved login."}
        </p>
        <button type="button" onClick={continueToSignIn} className="btn-primary w-full">
          Continue to sign in
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      id="reset-password-form"
      onSubmit={handleSubmit}
      autoComplete="on"
      className="card space-y-4"
    >
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-[var(--danger)] space-y-2">
          <p>{error}</p>
          {error.includes("invalid or has expired") && (
            <p>
              <Link href="/forgot-password" className="text-accent hover:underline">
                Request a fresh reset link
              </Link>
            </p>
          )}
        </div>
      )}

      {accountEmail ? (
        <div>
          <label htmlFor="reset-username" className="block text-xs text-[var(--muted)] mb-1">
            Account email
          </label>
          <input
            id="reset-username"
            name="username"
            type="email"
            autoComplete="username"
            value={accountEmail}
            readOnly
            className="input w-full text-[var(--muted)]"
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="reset-password" className="block text-xs text-[var(--muted)] mb-1">
          New password
        </label>
        <PasswordInput
          id="reset-password"
          name="password"
          purpose="new"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          minLength={8}
          required
        />
      </div>

      <div>
        <label htmlFor="reset-password-confirm" className="block text-xs text-[var(--muted)] mb-1">
          Confirm password
        </label>
        <PasswordInput
          id="reset-password-confirm"
          name="password-confirm"
          purpose="confirm"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Repeat password"
          minLength={8}
          required
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}