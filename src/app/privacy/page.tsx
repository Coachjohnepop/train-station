import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — The Train Station",
  description: "How The Train Station handles your information.",
};

export default function PrivacyPage() {
  return (
    <div className="app-shell-bg min-h-screen px-6 py-12 text-[var(--text)]">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-[var(--accent-fg)] hover:text-[var(--text)]">
          ← The Train Station
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          We collect account details (name, email), training logs, and payment
          information processed by Stripe so Coach Jeremy can coach you. We do not
          sell your personal data. Contact{" "}
          <a
            href="mailto:jeremy@thetrainstation.co"
            className="text-[var(--accent-fg)] underline"
          >
            jeremy@thetrainstation.co
          </a>{" "}
          for privacy requests (access, correction, or deletion).
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          Session cookies keep you signed in. Analytics help us improve the
          product. Full policy details can be expanded as we formalize legal copy
          — this page exists so members and app stores always have a live
          privacy destination.
        </p>
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/join" className="text-[var(--accent-fg)] hover:text-[var(--text)]">
            Memberships
          </Link>
          <Link href="/terms" className="text-[var(--accent-fg)] hover:text-[var(--text)]">
            Terms
          </Link>
          <Link href="/login" className="text-[var(--accent-fg)] hover:text-[var(--text)]">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
