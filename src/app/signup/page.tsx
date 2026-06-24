"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";
import EmailInput, { rememberEmail } from "@/components/EmailInput";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const interest = searchParams.get("interest") || "";
  const prefillEmail = searchParams.get("email") || "";
  const isWaitlistOnly = Boolean(interest && !plan);

  const [email, setEmail] = useState(prefillEmail);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ticketPlan = normalizeSignupPlan(plan || "explorer");

  useEffect(() => {
    try {
      const savedFirst = localStorage.getItem("ts-signup-first");
      if (savedFirst) setFirstName(savedFirst);
      const savedLast = localStorage.getItem("ts-signup-last");
      if (savedLast) setLastName(savedLast);
      const savedPhone = localStorage.getItem("ts-signup-phone");
      if (savedPhone) setPhone(savedPhone);
    } catch {
      /* ignore */
    }
  }, [prefillEmail]);

  useEffect(() => {
    try {
      localStorage.setItem("ts-signup-first", firstName);
      localStorage.setItem("ts-signup-last", lastName);
      localStorage.setItem("ts-signup-phone", phone);
    } catch {
      /* ignore */
    }
  }, [email, firstName, lastName, phone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isWaitlistOnly) {
        const res = await fetch("/api/signup/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            phone: phone.trim() || undefined,
            plan: interest || undefined,
            source: `interest:${interest}`,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Something went wrong — try again.");
          return;
        }
        rememberEmail(email);
        if (data.invited && data.redirectTo) {
          router.push(data.redirectTo);
          return;
        }
        router.push(data.redirectTo || "/coming-soon");
        return;
      }

      if (password || confirmPassword) {
        if (password.length < 8) {
          setError("Password must be at least 8 characters.");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }
      }

      const res = await fetch("/api/signup/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          plan: ticketPlan,
          password: password || undefined,
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
      router.push(data.redirectTo || `/member/onboard?plan=${ticketPlan}`);
      router.refresh();
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0612] text-[#f2ecf9] flex flex-col">
      <div className="border-b border-[#3d2660] bg-[#140a22]">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight text-lg hover:text-[var(--accent)]">
            The Train Station
          </Link>
          <Link href="/login" className="text-sm text-[#9d8ab8] hover:text-white transition">
            Already have an account? Sign in
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="uppercase tracking-[3px] text-xs font-semibold text-[#7c3aed] mb-3">
              {isWaitlistOnly ? "Coming soon" : "Get started"}
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">
              {isWaitlistOnly ? "Join the waitlist" : "Create your account"}
            </h1>
            <p className="mt-3 text-[#9d8ab8] text-sm leading-relaxed">
              {isWaitlistOnly
                ? "We'll notify you when this program track launches."
                : "Next you'll set up texts, book your coach, and open your training dashboard."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-3xl border border-[#3d2660] bg-[#140a22] p-8 space-y-4">
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}{" "}
                {error.includes("exists") && (
                  <Link href={`/login?email=${encodeURIComponent(email)}`} className="underline">
                    Sign in
                  </Link>
                )}
              </p>
            )}

            <div>
              <label className="block text-xs text-[#9d8ab8] mb-1">Email</label>
              <EmailInput
                variant="signup"
                required
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                prefillFromHistory={!prefillEmail}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-[#9d8ab8] mb-1">First name</label>
                <input
                  type="text"
                  name="given-name"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  className="w-full rounded-full border border-[#3d2660] bg-[#0a0612] px-4 py-3 text-sm text-white placeholder:text-[#9d8ab8]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[#9d8ab8] mb-1">Last name</label>
                <input
                  type="text"
                  name="family-name"
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  className="w-full rounded-full border border-[#3d2660] bg-[#0a0612] px-4 py-3 text-sm text-white placeholder:text-[#9d8ab8]"
                />
              </div>
            </div>

            {!isWaitlistOnly && (
              <>
                <div>
                  <label className="block text-xs text-[#9d8ab8] mb-1">
                    Password{" "}
                    <span className="text-[#6b5b86]">(required in production — min 8 characters)</span>
                  </label>
                  <input
                    type="password"
                    name="new-password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-full border border-[#3d2660] bg-[#0a0612] px-4 py-3 text-sm text-white placeholder:text-[#9d8ab8]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9d8ab8] mb-1">Confirm password</label>
                  <input
                    type="password"
                    name="confirm-password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-full border border-[#3d2660] bg-[#0a0612] px-4 py-3 text-sm text-white placeholder:text-[#9d8ab8]"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-[#9d8ab8] mb-1">
                Phone <span className="text-[#6b5b86]">(optional — used for workout texts)</span>
              </label>
              <input
                type="tel"
                name="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full rounded-full border border-[#3d2660] bg-[#0a0612] px-4 py-3 text-sm text-white placeholder:text-[#9d8ab8]"
              />
            </div>

            {isWaitlistOnly && (
              <p className="text-xs text-[#7c3aed]">
                Program interest:{" "}
                <span className="font-semibold capitalize">{interest.replace(/-/g, " ")}</span>
              </p>
            )}

            {!isWaitlistOnly && (plan || ticketPlan) && (
              <p className="text-xs text-[#7c3aed]">
                Ticket: <span className="font-semibold">{signupPlanLabel(ticketPlan)}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex h-12 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d2dd6] transition-all disabled:opacity-60"
            >
              {loading
                ? isWaitlistOnly
                  ? "Joining waitlist…"
                  : "Creating account…"
                : isWaitlistOnly
                  ? "Notify me when it launches"
                  : "Continue to setup →"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[#9d8ab8]">
            Coaches can{" "}
            <Link href="/login" className="text-[#7c3aed] hover:underline">
              sign in here
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0612] flex items-center justify-center text-[#9d8ab8] text-sm">
          Loading…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}