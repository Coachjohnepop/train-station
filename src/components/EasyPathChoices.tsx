import type { ReactNode } from "react";

/**
 * Decision screens: put the easy door first, at the top, before art/copy.
 * Free / skip / trial belong here — not as a muted link under a video.
 */
export default function EasyPathChoices({
  kicker = "Easy path",
  hint,
  children,
}: {
  kicker?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="choice-stack w-full space-y-2">
      {kicker ? (
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent-fg)]">
          {kicker}
        </p>
      ) : null}
      <div className="flex w-full flex-col gap-2">{children}</div>
      {hint ? (
        <p className="text-center text-xs font-medium text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
