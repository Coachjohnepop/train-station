"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";
import EmailInput, { rememberEmail } from "@/components/EmailInput";
import PasswordInput from "@/components/PasswordInput";
import PhoneInput from "@/components/PhoneInput";
import { formatPhoneInputValue } from "@/lib/sms-phone";
import { offerSavePassword, offerSavePasswordFromForm } from "@/lib/browser-credentials";
import { useFormAutofillSync } from "@/hooks/useFormAutofillSync";
import OAuthButtons from "@/components/OAuthButtons";
import MembershipSeatArt from "@/components/MembershipSeatArt";
import { JOIN_WEEK_HOOK_KEY } from "@/lib/landing-return-visit";
import { buzzScoreCelebrate, fireWorkoutConfetti } from "@/lib/workout-confetti";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const interest = searchParams.get("interest") || "";
  const prefillEmail = searchParams.get("email") || "";
  const referralCode = searchParams.get("ref") || searchParams.get("referral") || "";
  const weekTrial = searchParams.get("week") === "1";
  const isWaitlistOnly = Boolean(interest && !plan);
  /** No plan in URL = user did not pick a ticket yet — do not default to Free. */
  const hasExplicitPlan = Boolean(plan.trim());

  const [email, setEmail] = useState(prefillEmail);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const ticketPlan = hasExplicitPlan ? normalizeSignupPlan(plan) : null;

  // Membership signup always starts from a ticket pick (Free is intentional).
  useEffect(() => {
    if (isWaitlistOnly || hasExplicitPlan) return;
    router.replace("/join#tickets");
  }, [isWaitlistOnly, hasExplicitPlan, router]);

  useEffect(() => {
    if (!weekTrial) return;
    try {
      if (sessionStorage.getItem(JOIN_WEEK_HOOK_KEY) !== "1") return;
      sessionStorage.removeItem(JOIN_WEEK_HOOK_KEY);
    } catch {
      return;
    }
    const t = window.setTimeout(() => {
      buzzScoreCelebrate("standard");
      fireWorkoutConfetti(undefined, 1600);
    }, 180);
    return () => window.clearTimeout(t);
  }, [weekTrial]);

  useFormAutofillSync(formRef, ["username", "password", "password-confirm"], (values) => {
    if (values.username) setEmail(values.username);
    if (values.password) setPassword(values.password);
    if (values["password-confirm"]) setConfirmPassword(values["password-confirm"]);
  });

  useEffect(() => {
    try {
      const savedFirst = localStorage.getItem("ts-signup-first");
      if (savedFirst) setFirstName(savedFirst);
      const savedLast = localStorage.getItem("ts-signup-last");
      if (savedLast) setLastName(savedLast);
      const savedPhone = localStorage.getItem("ts-signup-phone");
      if (savedPhone) setPhone(formatPhoneInputValue(savedPhone));
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

      if (!ticketPlan) {
        setError("Pick a ticket first — Free, Coach Class, or higher.");
        setLoading(false);
        router.push("/join#tickets");
        return;
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
          referralCode: referralCode.trim() || undefined,
          week: weekTrial || undefined,
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setError(data.error || "Account exists — sign in instead.");
        return;
      }

      if (!res.ok) {
        const msg = data.error || "Something went wrong — try again.";
        if (msg.includes("sign-in failed")) {
          setError(`${msg} Try signing in — your account may already exist.`);
          return;
        }
        setError(msg);
        return;
      }

      rememberEmail(email);
      if (weekTrial) {
        buzzScoreCelebrate("workout-complete");
        fireWorkoutConfetti(undefined, 1800);
      }
      if (!isWaitlistOnly && password) {
        await offerSavePasswordFromForm(formRef.current);
        await offerSavePassword({
          email: email.trim(),
          password,
          name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
        });
      }
      window.location.href =
        data.redirectTo || `/member/onboard?plan=${encodeURIComponent(ticketPlan)}`;
      return;
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isWaitlistOnly && !ticketPlan) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center gap-3 px-6 text-center text-[var(--muted)] text-sm">
        <p className="text-base font-semibold text-[var(--text)]">Grab a seat first.</p>
        <Link href="/join#tickets" className="text-[var(--accent-fg)] underline">
          Free · Coach Class · 1st
        </Link>
      </div>
    );
  }

  return (
    <div className="app-shell-bg min-h-screen text-[var(--text)] flex flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight text-lg hover:text-[var(--accent)]">
            The Train Station
          </Link>
          <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--text)] transition">
            Already have an account? Sign in
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="uppercase tracking-[3px] text-xs font-semibold text-[#7c3aed] mb-3">
              {isWaitlistOnly ? "Coming soon" : weekTrial ? "Free week" : "Get started"}
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">
              {isWaitlistOnly
                ? "Join the waitlist"
                : weekTrial
                  ? "See the app for 7 days"
                  : "Create your account"}
            </h1>
            <p className="mt-3 text-[var(--muted)] text-sm leading-relaxed">
              {isWaitlistOnly
                ? "We'll notify you when this program track launches."
                : weekTrial
                  ? "Coach Class access for a week. After that, pick a ticket if you want to stay."
                  : "Next you'll set up texts, book your coach, and open your training dashboard."}
            </p>
          </div>

          {/* Ticket image for the plan they picked — skip on free-week Join */}
          {!isWaitlistOnly && ticketPlan && !weekTrial && (
            <div className="mb-6 flex flex-col items-center">
              <div className="w-full max-w-[220px] overflow-hidden rounded-2xl border border-[var(--border)] shadow-[0_12px_40px_rgba(124,58,237,0.35)]">
                <MembershipSeatArt
                  plan={ticketPlan}
                  priority
                  className="w-full"
                  alt={`${signupPlanLabel(ticketPlan)} membership`}
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--accent-fg)]">
                {signupPlanLabel(ticketPlan)}
              </p>
            </div>
          )}

          {!isWaitlistOnly && ticketPlan && (
            <>
              <OAuthButtons mode="signup" plan={ticketPlan} className="mb-4" />
              <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                or create with email
              </p>
            </>
          )}

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            autoComplete="on"
            className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 space-y-4"
          >
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-[var(--danger)]">
                {error}{" "}
                {(error.includes("exists") || error.includes("sign-in failed")) && (
                  <Link href={`/login?email=${encodeURIComponent(email)}`} className="underline">
                    Sign in
                  </Link>
                )}
              </p>
            )}

            <div>
              <label htmlFor="signup-username" className="block text-xs text-[var(--muted)] mb-1">
                Email
              </label>
              <EmailInput
                id="signup-username"
                name="username"
                autoComplete="username"
                variant="signup"
                required
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                prefillFromHistory={!prefillEmail}
              />
            </div>

            {!isWaitlistOnly && (
              <>
                <div>
                  <label htmlFor="signup-password" className="block text-xs text-[var(--muted)] mb-1">
                    Password{" "}
                    <span className="text-[#6b5b86]">(required in production — min 8 characters)</span>
                  </label>
                  <PasswordInput
                    id="signup-password"
                    variant="signup"
                    name="password"
                    purpose="new"
                    required
                    minLength={8}
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label htmlFor="signup-password-confirm" className="block text-xs text-[var(--muted)] mb-1">
                    Confirm password
                  </label>
                  <PasswordInput
                    id="signup-password-confirm"
                    variant="signup"
                    name="password-confirm"
                    purpose="confirm"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="••••••••"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-[var(--muted)] mb-1">First name</label>
                <input
                  type="text"
                  name="given-name"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  className="w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[var(--muted)] mb-1">Last name</label>
                <input
                  type="text"
                  name="family-name"
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  className="w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">
                Phone <span className="text-[#6b5b86]">(optional — used for workout texts)</span>
              </label>
              <PhoneInput
                name="tel"
                value={phone}
                onChange={setPhone}
                placeholder="916.284.1994"
                className="w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
              />
            </div>

            {isWaitlistOnly && (
              <p className="text-xs text-[#7c3aed]">
                Program interest:{" "}
                <span className="font-semibold capitalize">{interest.replace(/-/g, " ")}</span>
              </p>
            )}

            {!isWaitlistOnly && ticketPlan && (
              <p className="text-xs text-[#7c3aed]">
                Ticket: <span className="font-semibold">{signupPlanLabel(ticketPlan)}</span>
              </p>
            )}

            {!isWaitlistOnly && referralCode.trim() && (
              <p className="text-xs text-emerald-300">
                Referral code: <span className="font-semibold">{referralCode.trim().toUpperCase()}</span>
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

          <p className="mt-6 text-center text-xs text-[var(--muted)]">
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
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--muted)] text-sm">
          Loading…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}