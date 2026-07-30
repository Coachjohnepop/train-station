import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

/** Shared public footer — Powered by Lemonvoice + legal/nav links. */
export default function LandingSiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_96%,transparent)] py-8 text-center text-xs text-[var(--muted)]">
      <p className="font-medium text-[var(--text)]/90">
        {BRAND_NAME} ·{" "}
        <Link href="/powered-by" className="text-[var(--accent)] hover:underline">
          Powered by Lemonvoice.com
        </Link>
      </p>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link href="/join" className="hover:text-[var(--accent)]">
          Memberships
        </Link>
        <span aria-hidden>·</span>
        <Link href="/login" className="hover:text-[var(--accent)]">
          Sign in
        </Link>
        <span aria-hidden>·</span>
        <Link href="/powered-by" className="hover:text-[var(--accent)]">
          Platform
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="hover:text-[var(--accent)]">
          Privacy
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:text-[var(--accent)]">
          Terms
        </Link>
        <span aria-hidden>·</span>
        <a
          href="https://www.lemonvoice.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--accent)]"
        >
          Lemonvoice
        </a>
      </p>
    </footer>
  );
}
