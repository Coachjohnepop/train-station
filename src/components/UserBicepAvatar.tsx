/**
 * Universal user modicon — flexed bicep in a circle.
 * Emerald tone is the member Measurements mark; accent is coach/account identity.
 */

type Props = {
  /** Visual size in px (circle diameter). */
  size?: number;
  className?: string;
  title?: string;
  /** Emerald = measurements / body. Accent = purple identity (coach, account). */
  tone?: "accent" | "emerald";
};

const TONE_CLASS = {
  accent:
    "border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_18%,var(--surface-2))] text-[var(--accent-fg)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_20%,transparent)]",
  emerald:
    "border-[color-mix(in_srgb,var(--ramp-gold)_55%,var(--border))] bg-[color-mix(in_srgb,var(--ramp-gold)_18%,var(--surface-2))] text-[var(--ramp-gold-light)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ramp-gold)_28%,transparent)]",
} as const;

function FlexedArmIcon({ size }: { size: number }) {
  const px = Math.round(size * 0.58);
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M7 11.2c-.9-1.7-.6-3.7.8-5 .9-.8 2.2-1.1 3.4-.7" />
      <path d="M13.2 7c1-1.9 3.2-2.9 5.3-2.4 1.9.5 3.2 2.2 3.2 4.2 0 1.3-.6 2.5-1.6 3.3" />
      <path d="M9.2 10.8c1.4 1.1 3.6 1.8 5.8 1.3" />
      <path d="M5 15.4c.7 3.1 3.5 5.3 6.8 5.3h2c3.6 0 6.5-2.5 7.1-5.6" />
    </svg>
  );
}

export default function UserBicepAvatar({
  size = 36,
  className = "",
  title = "Account",
  tone = "accent",
}: Props) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${TONE_CLASS[tone]} ${className}`.trim()}
      style={{ width: size, height: size }}
      title={title}
      role="img"
      aria-label={title}
    >
      <FlexedArmIcon size={size} />
    </span>
  );
}
