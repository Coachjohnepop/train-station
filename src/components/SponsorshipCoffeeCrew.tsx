import Link from "next/link";

export const COFFEE_CREW_INSTAGRAM = "thecoffeecrew";
export const COFFEE_CREW_INSTAGRAM_URL = `https://www.instagram.com/${COFFEE_CREW_INSTAGRAM}/`;

export default function SponsorshipCoffeeCrew() {
  return (
    <section className="card overflow-hidden border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-[var(--surface)] to-[var(--surface)]">
      <div className="border-b border-amber-500/20 px-4 py-3 sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90">
          Sponsorship · The Coffee Crew
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--text)] sm:text-xl">
          Coffee for the station
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Jeremy&apos;s partner for now is The Coffee Crew. Follow along on Instagram — shop links
          and member codes come later.
        </p>
      </div>
      <div className="p-4 sm:p-5">
        <a
          href={COFFEE_CREW_INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold"
        >
          Instagram @{COFFEE_CREW_INSTAGRAM} →
        </a>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Only the Instagram is live. Tell us if the handle should be different.
        </p>
      </div>
    </section>
  );
}
