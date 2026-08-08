"use client";

import Link from "next/link";
import { COMING_SOON_PROGRAMS } from "@/lib/landing-tickets";
import { resolveProgramImage } from "@/lib/program-constants";
import { TOP_LEVEL_PROGRAMS } from "@/lib/programs";

/**
 * Landing / join “Programs” section.
 * Live catalog first (Adult, Athletes, Military, Mom & Dads…), then waitlist tracks.
 * Top nav Programs → #programs (also accepts legacy #coming-soon-programs).
 */
export default function ComingSoonPrograms({ compact = false }: { compact?: boolean }) {
  const live = TOP_LEVEL_PROGRAMS.filter(
    (p) => p.catalogStatus === "live" || p.catalogStatus === "coming_soon",
  );

  return (
    <section
      id="programs"
      className={`scroll-mt-20 border-t border-[var(--border)] bg-[var(--surface)] ${compact ? "py-8 px-4" : "px-4 py-12 sm:px-6 sm:py-16"}`}
    >
      {/* Legacy anchor so old #coming-soon-programs links still land here */}
      <div id="coming-soon-programs" className="h-0 scroll-mt-20" aria-hidden tabIndex={-1} />

      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7c3aed]">
            On the platform
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text)] sm:text-2xl">Programs</h2>
          {!compact && (
            <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--muted)]">
              Live tracks you can board now — plus waitlist programs Jeremy is still writing.
            </p>
          )}
        </div>

        {/* Live / catalog programs — Adult first */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {live.map((prog) => {
            const img = resolveProgramImage(prog.slug);
            const isSoon = prog.catalogStatus === "coming_soon";
            const isSpeaking = prog.slug === "speaking";
            const href = isSoon
              ? `/signup?interest=${encodeURIComponent(prog.slug)}`
              : isSpeaking
                ? `/signup?plan=speaking_fee&quote=1` // after account → /member/speaking intake
                : `/join#programs`;
            const cta = isSoon
              ? "Notify me →"
              : isSpeaking
                ? "Book speaking →"
                : "Board this track →";
            const badge = isSoon ? "Soon" : isSpeaking ? "Available" : "Live";
            return (
              <Link
                key={prog.slug}
                href={href}
                className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]/80 transition hover:border-[#7c3aed]/50 hover:bg-[#1a1428]"
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt={isSpeaking ? "Coach Jeremy speaking at a seminar" : ""}
                    className="aspect-[5/3] w-full object-cover opacity-90 transition group-hover:opacity-100"
                  />
                ) : (
                  <div className="aspect-[5/3] w-full bg-gradient-to-br from-[#1a0b2e] to-[#0a0612]" />
                )}
                {isSoon ? (
                  <span className="absolute right-3 top-3 rounded-full bg-[#7c3aed]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--accent-fg)]">
                    {badge}
                  </span>
                ) : (
                  <span className="absolute right-3 top-3 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                    {badge}
                  </span>
                )}
                <div className="p-3 sm:p-4">
                  <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent-fg)]">
                    {prog.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--muted)]">
                    {prog.description}
                  </p>
                  <span className="mt-3 inline-block text-[10px] font-medium text-[#7c3aed] group-hover:underline">
                    {cta}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Waitlist-only tracks */}
        <div className="mt-10 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7c3aed]/80">
            Coming soon
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white/90">More on the manifest</h3>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {COMING_SOON_PROGRAMS.map((prog) => (
            <Link
              key={prog.slug}
              href={`/signup?interest=${encodeURIComponent(prog.slug)}`}
              className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]/80 p-4 transition hover:border-[#7c3aed]/50 hover:bg-[#1a1428]"
            >
              <span className="absolute right-3 top-3 rounded-full bg-[#7c3aed]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--accent-fg)]">
                Soon
              </span>
              <span className="text-2xl" aria-hidden>
                {prog.emoji}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent-fg)]">
                {prog.name}
              </h3>
              <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{prog.blurb}</p>
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
