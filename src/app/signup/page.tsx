"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const prefillEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(prefillEmail);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remember previously entered values across visits (cached in localStorage),
  // so a returning visitor doesn't have to retype. A ?email= URL param wins.
  useEffect(() => {
    try {
      if (!prefillEmail) {
        const savedEmail = localStorage.getItem("ts-signup-email");
        if (savedEmail) setEmail(savedEmail);
      }
      const savedFirst = localStorage.getItem("ts-signup-first");
      if (savedFirst) setFirstName(savedFirst);
      const savedLast = localStorage.getItem("ts-signup-last");
      if (savedLast) setLastName(savedLast);
      const savedPhone = localStorage.getItem("ts-signup-phone");
      if (savedPhone) setPhone(savedPhone);
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, [prefillEmail]);

  useEffect(() => {
    try {
      localStorage.setItem("ts-signup-email", email);
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
      const res = await fetch("/api/signup/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
          plan: plan || undefined,
          source: "signup-page",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong — try again.");
        return;
      }

      if (data.invited && data.redirectTo) {
        router.push(data.redirectTo);
        return;
      }

      router.push(data.redirectTo || "/coming-soon");
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
            Already have access? Sign in
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="uppercase tracking-[3px] text-xs font-semibold text-[#7c3aed] mb-3">
              Early access
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Join the waitlist</h1>
            <p className="mt-3 text-[#9d8ab8] text-sm leading-relaxed">
              We&apos;re putting the finishing touches on the member app. Drop your email and we&apos;ll let you know the moment it&apos;s ready.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-3xl border border-[#3d2660] bg-[#140a22] p-8 space-y-4">
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
            )}

            <div>
              <label className="block text-xs text-[#9d8ab8] mb-1">Email</label>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-full border border-[#3d2660] bg-[#0a0612] px-4 py-3 text-sm text-white placeholder:text-[#9d8ab8]"
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

            <div>
              <label className="block text-xs text-[#9d8ab8] mb-1">
                Phone <span className="text-[#6b5b86]">(optional)</span>
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

            {plan && (
              <p className="text-xs text-[#7c3aed]">
                Interested in: <span className="font-semibold">{plan}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex h-12 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d2dd6] transition-all disabled:opacity-60"
            >
              {loading ? "Joining waitlist…" : "Notify me when it launches"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[#9d8ab8]">
            Coaches and invited beta members can{" "}
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