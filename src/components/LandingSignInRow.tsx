"use client";

import Link from "next/link";
import OAuthButtons from "@/components/OAuthButtons";

type Props = {
  coachRedirect?: string;
  className?: string;
};

/** Hero / landing sign-in: Google first, then PIN/Face ID via login page. */
export default function LandingSignInRow({
  coachRedirect = "/admin/day",
  className = "",
}: Props) {
  return (
    <div className={`w-full max-w-sm space-y-3 ${className}`}>
      <OAuthButtons mode="login" className="[&_a]:rounded-full [&_a]:border-white/25 [&_a]:bg-white/95 [&_a]:text-[#1a1028] [&_a]:shadow-lg [&_a]:backdrop-blur" />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-full border border-white/35 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
        >
          PIN / Face ID sign in
        </Link>
        <Link
          href={`/login?redirect=${encodeURIComponent(coachRedirect)}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white/85 backdrop-blur transition hover:bg-white/10"
        >
          Coach email sign in
        </Link>
      </div>
      <p className="text-center text-[10px] text-white/45">
        Google once, then use PIN or Face ID on this device next time.
      </p>
    </div>
  );
}