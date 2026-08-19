/** Angled “Top Secret”-style stamp for maintain when the day is already trained. */
export default function DayCompleteStamp({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-[inherit] ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--surface)_55%,transparent)]" />
      <span
        className="relative rotate-[-22deg] select-none border-[2.5px] border-[var(--ramp-gold)] px-3 py-1.5 text-center text-sm font-black uppercase tracking-[0.18em] text-[var(--ramp-gold-light)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--ramp-gold)_35%,transparent)] sm:px-4 sm:text-base"
        style={{
          textShadow: "0 1px 0 color-mix(in srgb, var(--ramp-gold) 40%, transparent)",
        }}
      >
        Day Complete
      </span>
    </div>
  );
}
