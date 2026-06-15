"use client";

type Props = {
  week: number;
  day: number;
  fullScheduleId: string;
  weekDetailsId: string;
  label?: string;
};

export default function ScheduleJumpLink({
  week,
  day,
  fullScheduleId,
  weekDetailsId,
  label,
}: Props) {
  const handleClick = () => {
    const full = document.getElementById(fullScheduleId) as HTMLDetailsElement | null;
    if (full && !full.open) full.open = true;

    const weekEl = document.getElementById(weekDetailsId) as HTMLDetailsElement | null;
    if (weekEl && !weekEl.open) weekEl.open = true;

    requestAnimationFrame(() => {
      document.getElementById(`w${week}-d${day}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs text-accent hover:underline whitespace-nowrap"
    >
      {label ?? `Jump to Day ${day}`}
    </button>
  );
}