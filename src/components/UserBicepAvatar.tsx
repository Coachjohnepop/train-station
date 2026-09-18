/**
 * Universal user modicon — flexed bicep in a circle.
 * Optional iPhone-style purple badge (count or a dot) for alerts / check-ins.
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
  /** Check-in / alert count. Overlay badge only — never replaces 💪. 0 is hidden. */
  count?: number | null;
};

const TONE_CLASS = {
  accent:
    "border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_18%,var(--surface-2))] text-[var(--accent-fg)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_20%,transparent)]",
  gold:
    "border-[color-mix(in_srgb,var(--ramp-gold)_55%,var(--border))] bg-[color-mix(in_srgb,var(--ramp-gold)_18%,var(--surface-2))] text-[var(--ramp-gold-light)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ramp-gold)_28%,transparent)]",
} as const;

export function bicepBadgeValue(
  count: number | null | undefined,
  flagged = false,
): number | "dot" | null {
  if (typeof count === "number" && count > 0) return count;
  if (flagged) return "dot";
  return null;
}

export default function UserBicepAvatar({
  size = 36,
  className = "",
  title = "Account",
  tone = "accent",
  flagged = false,
  count = null,
}: Props) {
  const badge = bicepBadgeValue(count, flagged);
  const fontSize = Math.round(size * 0.52);
  const badgeLabel =
    badge === "dot" ? null : badge != null ? (badge > 99 ? "99+" : String(badge)) : null;

  return (
    <span className={`relative inline-flex shrink-0 ${className}`.trim()}>
      <span
        className={`inline-flex items-center justify-center rounded-full border font-bold ${TONE_CLASS[tone]} ${
          flagged ? "ring-2 ring-[var(--ramp-gold)]" : ""
        }`}
        style={{ width: size, height: size }}
        title={title}
        role="img"
        aria-label={title}
      >
        <span className="select-none leading-none" style={{ fontSize }} aria-hidden>
          💪
        </span>
      </span>
      {badge ? (
        <span
          className={
            badge === "dot"
              ? "absolute -right-0.5 -top-0.5 z-10 h-2.5 w-2.5 rounded-full bg-[#7c3aed] ring-2 ring-[var(--bg)]"
              : "absolute -right-1 -top-1 z-10 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#7c3aed] px-0.5 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-[var(--bg)]"
          }
          aria-hidden={badge === "dot"}
          aria-label={
            badge === "dot"
              ? "Needs attention"
              : `${badgeLabel} ${title.toLowerCase()}`
          }
        >
          {badgeLabel}
        </span>
      ) : null}
    </span>
  );
}
