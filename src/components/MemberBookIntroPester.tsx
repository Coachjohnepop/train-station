"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SNOOZE_KEY = "ts_intro_pester_snooze";

function snoozedNow(): boolean {
  try {
    const raw = sessionStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

export default function MemberBookIntroPester() {
  const pathname = usePathname() || "";
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(snoozedNow());
  }, [pathname]);

  const onBookPage =
    pathname === "/member/book" || pathname.startsWith("/member/book?");
  const onOnboard = pathname.startsWith("/member/onboard");
  const onCheckout = pathname.startsWith("/member/checkout");

  if (hidden || onBookPage || onOnboard || onCheckout) return null;

  return (
    <div className="border-b border-[#7c3aed]/35 bg-[#7c3aed]/15 px-3 py-2">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 md:max-w-3xl lg:max-w-6xl xl:max-w-7xl md:px-3 lg:px-4">
        <p className="min-w-0 text-[12px] leading-snug text-[var(--text)]">
          <span className="font-semibold">Book 15 min with Jeremy.</span>{" "}
          Every seat meets the coach — we&apos;ll keep this up until it&apos;s on the calendar.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/member/book"
            className="rounded-full bg-[#7c3aed] px-3 py-1 text-[11px] font-bold text-white"
            data-analytics-action="book-jeremy-pester"
          >
            Book now
          </Link>
          <button
            type="button"
            className="text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--text)]"
            data-analytics-action="book-jeremy-pester-snooze"
            onClick={() => {
              try {
                sessionStorage.setItem(SNOOZE_KEY, String(Date.now() + 60 * 60 * 1000));
              } catch {
                /* ignore */
              }
              setHidden(true);
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
