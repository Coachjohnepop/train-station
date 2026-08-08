import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — The Train Station",
  description: "Terms of use for The Train Station training platform.",
};

export default function TermsPage() {
  return (
    <div className="app-shell-bg min-h-screen px-6 py-12 text-[var(--text)]">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-[var(--accent-fg)] hover:text-[var(--text)]">
          ← The Train Station
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Terms of use</h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          The Train Station is a coaching and workout platform operated for
          members of Coach Jeremy’s programs. By creating an account or purchasing
          a membership, you agree to use the service lawfully, keep login
          credentials private, and follow coach guidance at your own risk.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          Training involves physical risk. Consult a physician before starting a
          program. Memberships, Free Explorer access, and paid classes are
          described at checkout; billing is handled by Stripe. Cancel or change
          plans in Member → Account / Settings when available.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          Questions:{" "}
          <a
            href="mailto:jeremy@thetrainstation.co"
            className="text-[var(--accent-fg)] underline"
          >
            jeremy@thetrainstation.co
          </a>
          .
        </p>
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/join" className="text-[var(--accent-fg)] hover:text-[var(--text)]">
            Memberships
          </Link>
          <Link href="/privacy" className="text-[var(--accent-fg)] hover:text-[var(--text)]">
            Privacy
          </Link>
          <Link href="/login" className="text-[var(--accent-fg)] hover:text-[var(--text)]">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
