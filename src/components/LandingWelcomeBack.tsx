"use client";

import Link from "next/link";
import type { ReactNode } from "react";

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
    window.location.href = "/api/auth/logout";
  }

  const programHref = isCoach ? "/admin" : "/member";

  return (
    <div className="min-h-screen bg-[#0a0612] text-[#f2ecf9] flex flex-col">
      <header className="border-b border-[#3d2660]/60 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="text-sm text-[#9d8ab8] hover:text-white transition">
            The Train Station
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
            <Link href="/login" className="text-[#9d8ab8] hover:text-white transition">
              Sign in
            </Link>
            <Link href="/forgot-password" className="text-[#9d8ab8] hover:text-white transition">
              Forgot password
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="text-[#7c3aed] hover:text-[#a78bfa] font-medium transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-xl text-center">
          <div className="mx-auto mb-8">
            <img src="/images/logo.png" alt="The Train Station" className="h-20 w-auto mx-auto drop-shadow-2xl" />
          </div>

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
              className="inline-flex h-12 items-center justify-center rounded-full border border-[#3d2660] px-8 text-sm font-semibold text-[#9d8ab8] hover:text-white hover:border-[#7c3aed]/50 transition"
            >
              Sign out
            </button>
          </div>

          {email && (
            <p className="mt-6 text-xs text-[#9d8ab8]/80">
              Signed in as <span className="text-[#f2ecf9]">{email}</span>
            </p>
          )}

          <div className="mt-8 text-xs text-[#9d8ab8]/70 tracking-widest">
            THE TRAIN STATION — YOUR TRAINING HUB
          </div>
        </div>
      </div>

      <footer className="border-t border-[#3d2660] py-6 text-center text-xs text-[#9d8ab8]">
        <Link href="/login" className="hover:text-white transition mx-3">
          Sign in as someone else
        </Link>
        <span className="mx-1">·</span>
        <Link href="/forgot-password" className="hover:text-white transition mx-3">
          Forgot password
        </Link>
        <span className="mx-1">·</span>
        <Link href="/signup" className="hover:text-white transition mx-3">
          Join waitlist
        </Link>
      </footer>
    </div>
  );
}