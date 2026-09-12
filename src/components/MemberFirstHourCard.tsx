import Link from "next/link";

export default function MemberFirstHourCard({
  bookedIntro,
}: {
  bookedIntro: boolean;
}) {
  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--ramp-gold)_40%,var(--border))] bg-[color-mix(in_srgb,var(--ramp-gold)_8%,var(--surface))] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ramp-gold-light)]">
        Your first hour
      </p>
      <p className="mt-1 text-sm text-[var(--text)]">
        {bookedIntro
          ? "You're on Jeremy's calendar. Start today's workout or say hi."
          : "Meet Jeremy for 15 minutes — then start today's workout. Working out is personal."}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {bookedIntro ? (
          <>
            <a href="#member-today-workout" className="btn-primary text-center text-sm">
              Start workout
            </a>
            <Link href="/member/chat" className="btn-secondary text-center text-sm">
              Message Jeremy
            </Link>
            <Link href="/member/book" className="btn-ghost text-center text-sm">
              Intro booked
            </Link>
          </>
        ) : (
          <>
            <a
              href="#member-book-intro"
              className="btn-primary text-center text-sm"
              data-analytics-action="book-jeremy-first-hour"
            >
              Book 15 min with Jeremy
            </a>
            <a href="#member-today-workout" className="btn-secondary text-center text-sm">
              Start workout
            </a>
            <Link href="/member/chat" className="btn-ghost text-center text-sm">
              Message Jeremy
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
