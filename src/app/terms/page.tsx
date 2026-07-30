import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — The Train Station",
  description: "Terms of use for The Train Station training platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0612] px-6 py-12 text-[#f2ecf9]">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-[#a78bfa] hover:text-white">
          ← The Train Station
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Terms of use</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#9d8ab8]">
          The Train Station is a coaching and workout platform operated for
          members of Coach Jeremy’s programs. By creating an account or purchasing
          a membership, you agree to use the service lawfully, keep login
          credentials private, and follow coach guidance at your own risk.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[#9d8ab8]">
          Training involves physical risk. Consult a physician before starting a
          program. Memberships, Free Explorer access, and paid classes are
          described at checkout; billing is handled by Stripe. Cancel or change
          plans in Member → Account / Settings when available.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[#9d8ab8]">
          Questions:{" "}
          <a
            href="mailto:jeremy@thetrainstation.co"
            className="text-[#c4b5fd] underline"
          >
            jeremy@thetrainstation.co
          </a>
          .
        </p>
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/join" className="text-[#a78bfa] hover:text-white">
            Memberships
          </Link>
          <Link href="/privacy" className="text-[#a78bfa] hover:text-white">
            Privacy
          </Link>
          <Link href="/login" className="text-[#a78bfa] hover:text-white">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
