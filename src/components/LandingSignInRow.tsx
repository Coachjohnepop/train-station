"use client";

import Link from "next/link";
import OAuthButtons from "@/components/OAuthButtons";

type Props = {
  className?: string;
  hideMemberSignIn?: boolean;
};

/** Hero / landing sign-in: Google OAuth + optional member sign-in link. */
export default function LandingSignInRow({
  className = "",
  hideMemberSignIn = false,
}: Props) {
  return (
    <div className={`w-full max-w-sm space-y-3 ${className}`}>
      <OAuthButtons mode="login" className="[&_a]:rounded-full [&_a]:border-white/25 [&_a]:bg-white/95 [&_a]:text-[#1a1028] [&_a]:shadow-lg [&_a]:backdrop-blur" />
      {!hideMemberSignIn ? (
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/35 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
        >
          Member sign in
        </Link>
      ) : null}
      <p className="text-center text-[10px] text-white/45">
        Google once, then use Face ID or Touch ID on this device next time.
      </p>
    </div>
  );
}