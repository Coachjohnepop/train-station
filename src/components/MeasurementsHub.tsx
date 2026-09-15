import Link from "next/link";

export default function MeasurementsHub({
  firstOnboard = false,
  hasVideo = false,
  checkInCount = 0,
}: {
  firstOnboard?: boolean;
  hasVideo?: boolean;
  checkInCount?: number;
}) {
  return (
    <div className="space-y-4">
      {firstOnboard ? (
        <div className="card border-accent/40 bg-accent/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            After your intro
          </p>
          <h1 className="mt-1 text-xl font-bold">First measurement session</h1>
          <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--text)_82%,var(--muted))]">
            Watch how to take tape, then enter starting weight, goal, today&apos;s check-in, and
            photos.
          </p>
        </div>
      ) : (
        <div>
          <h1 className="text-xl font-bold">Body measurements</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {checkInCount > 0
              ? `${checkInCount} check-in${checkInCount === 1 ? "" : "s"} on file.`
              : "No check-ins yet — watch the how-to, then enter your first sheet."}
          </p>
        </div>
      )}

      <Link
        href="/member/measurements/how-to"
        className="card block border-accent/35 p-4 transition hover:border-accent/60"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Video</p>
        <h2 className="mt-1 text-lg font-bold">How to do Measurements</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {hasVideo
            ? "Watch Jeremy’s tape how-to — marks, tension, and what to write down."
            : "How-to video isn’t posted yet. You can still enter measurements."}
        </p>
      </Link>

      <Link href="/member/measurements/enter" className="card block border-[var(--ramp-gold)]/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ramp-gold-light)]">
          Sheet
        </p>
        <h2 className="mt-1 text-lg font-bold">Enter Measurements</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Weight, tape, and photos. The how-to video is on that page too if you want it while you
          log.
        </p>
      </Link>
    </div>
  );
}
