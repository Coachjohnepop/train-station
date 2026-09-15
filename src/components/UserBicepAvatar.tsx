/**
 * Universal user modicon — flexed bicep in a circle, or a number for Measurements.
 * Gold tone is the member Measurements mark; accent is coach/account identity.
 */

type Props = {
  /** Visual size in px (circle diameter). */
  size?: number;
  className?: string;
  title?: string;
  /** Gold = measurements / body. Accent = purple identity (coach, account). */
  tone?: "accent" | "gold";
  /** Gold ring — measurements due / never logged. */
  flagged?: boolean;
  /** Check-in count. When set, the circle shows this number instead of 💪. */
  count?: number | null;
};

const TONE_CLASS = {
  accent:
    "border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_18%,var(--surface-2))] text-[var(--accent-fg)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_20%,transparent)]",
  gold:
    "border-[color-mix(in_srgb,var(--ramp-gold)_55%,var(--border))] bg-[color-mix(in_srgb,var(--ramp-gold)_18%,var(--surface-2))] text-[var(--ramp-gold-light)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ramp-gold)_28%,transparent)]",
} as const;

export default function UserBicepAvatar({
  size = 36,
  className = "",
  title = "Account",
  tone = "accent",
  flagged = false,
  count = null,
}: Props) {
  const showCount = typeof count === "number";
  const label = showCount ? (count > 99 ? "99+" : String(count)) : "💪";
  const fontSize = showCount
    ? Math.round(size * (label.length > 1 ? 0.38 : 0.48))
    : Math.round(size * 0.52);

  return (
    <span className={`relative inline-flex shrink-0 ${className}`.trim()}>
      <span
        className={`inline-flex items-center justify-center rounded-full border font-bold tabular-nums ${TONE_CLASS[tone]} ${
          flagged ? "ring-2 ring-[var(--ramp-gold)]" : ""
        }`}
        style={{ width: size, height: size }}
        title={title}
        role="img"
        aria-label={title}
      >
        <span className="select-none leading-none" style={{ fontSize }} aria-hidden>
          {label}
        </span>
      </span>
    </span>
  );
}
