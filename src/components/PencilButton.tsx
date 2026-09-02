"use client";

type Props = {
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
};

export function PencilIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Small edit-pencil next to a name (coach rename affordance). */
export default function PencilButton({
  label,
  onClick,
  className = "",
  disabled,
}: Props) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-accent disabled:opacity-40 ${className}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      <PencilIcon />
    </button>
  );
}
