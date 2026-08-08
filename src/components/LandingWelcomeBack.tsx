"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import LandingNav from "@/components/LandingNav";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import { logoutUrl } from "@/lib/logout-url";

export default function LandingWelcomeBack({
  email,
  isCoach,
  children,
}: {
  email?: string;
  isCoach?: boolean;
  children: ReactNode;
}) {
  function signOut() {
    window.location.href = logoutUrl();
  }

  const programHref = isCoach ? "/admin" : "/member";

  return (
    <div className="min-h-screen app-shell-bg text-[var(--text)] flex flex-col">
      <ThemeAttributesSync membershipTier="explorer" />
      <LandingNav variant="welcome" />

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-xl text-center">
          {children}

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={programHref}
              className="inline-flex h-14 items-center justify-center rounded-full bg-white px-12 text-base font-semibold transition-all hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.985]"
            >
              <span style={{ color: "#7c3aed" }}>
                {isCoach ? "Back to Coach Admin" : "Back to the Program"}
              </span>
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--border)] px-8 text-sm font-semibold text-[var(--muted)] hover:text-[var(--text)] hover:border-[#7c3aed]/50 transition"
            >
              Sign out
            </button>
          </div>

          {email && (
            <p className="mt-6 text-xs text-[var(--muted)]/80">
              Signed in as <span className="text-[var(--text)]">{email}</span>
            </p>
          )}

          <div className="mt-8 text-xs text-[var(--muted)]/70 tracking-widest">
            THE TRAIN STATION — YOUR TRAINING HUB
          </div>
        </div>
      </div>

      <footer className="border-t border-[var(--border)] py-6 text-center text-xs text-[var(--muted)]">
        <Link href="/login" className="hover:text-[var(--text)] transition mx-3">
          Sign in as someone else
        </Link>
        <span className="mx-1">·</span>
        <Link href="/forgot-password" className="hover:text-[var(--text)] transition mx-3">
          Forgot password
        </Link>
        <span className="mx-1">·</span>
        <Link href="/signup" className="hover:text-[var(--text)] transition mx-3">
          Join waitlist
        </Link>
      </footer>
    </div>
  );
}