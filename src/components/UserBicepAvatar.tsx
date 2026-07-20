/**
 * Universal user modicon — flexed bicep in a circle.
 * Used for all members and coaches (same mark for everyone).
 */

type Props = {
  /** Visual size in px (circle diameter). */
  size?: number;
  className?: string;
  title?: string;
};

export default function UserBicepAvatar({
  size = 36,
  className = "",
  title = "Account",
}: Props) {
  const fontSize = Math.round(size * 0.52);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_18%,var(--surface-2))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_20%,transparent)] ${className}`.trim()}
      style={{ width: size, height: size }}
      title={title}
      role="img"
      aria-label={title}
    >
      <span
        className="select-none leading-none"
        style={{ fontSize }}
        aria-hidden
      >
        💪
      </span>
    </span>
  );
}
