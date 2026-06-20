"use client";

import Link from "next/link";
import { COMING_SOON_PROGRAMS } from "@/lib/landing-tickets";

export default function ComingSoonPrograms({ compact = false }: { compact?: boolean }) {
  return (
    <section
      id="coming-soon-programs"
      className={`border-t border-[#3d2660]/60 bg-[#140a22] ${compact ? "py-8 px-4" : "px-4 py-12 sm:px-6 sm:py-16"}`}
    >
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7c3aed]">On the manifest</p>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">Programs coming soon</h2>
          {!compact && (
            <p className="mx-auto mt-2 max-w-lg text-sm text-[#9d8ab8]">
              Jeremy&apos;s still writing these — get on the waitlist and we&apos;ll notify you when each track drops.
            </p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {COMING_SOON_PROGRAMS.map((prog) => (
            <Link
              key={prog.slug}
              href={`/signup?interest=${encodeURIComponent(prog.slug)}`}
              className="group relative overflow-hidden rounded-2xl border border-[#3d2660] bg-[#0a0612]/80 p-4 transition hover:border-[#7c3aed]/50 hover:bg-[#1a1428]"
            >
              <span className="absolute right-3 top-3 rounded-full bg-[#7c3aed]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#a78bfa]">
                Soon
              </span>
              <span className="text-2xl" aria-hidden>
                {prog.emoji}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-white group-hover:text-[#c4b5fd]">{prog.name}</h3>
              <p className="mt-1 text-[11px] leading-snug text-[#9d8ab8]">{prog.blurb}</p>
              <span className="mt-3 inline-block text-[10px] font-medium text-[#7c3aed] group-hover:underline">
                Notify me →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}