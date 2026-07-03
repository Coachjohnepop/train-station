"use client";

import { formatRestCountdown } from "@/lib/rest-timer";

type Props = {
  secondsLeft: number;
  totalSeconds: number;
  onSkip: () => void;
  compact?: boolean;
};

export default function WorkoutRestTimer({
  secondsLeft,
  totalSeconds,
  onSkip,
  compact = false,
}: Props) {
  const progress =
    totalSeconds > 0 ? Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100) : 100;

  return (
    <div
      className={`workout-rest-timer ${compact ? "workout-rest-timer--compact" : ""}`}
      role="timer"
      aria-live="polite"
      aria-label={`Rest ${formatRestCountdown(secondsLeft)} remaining`}
    >
      <div className="workout-rest-timer__bar" aria-hidden>
        <div className="workout-rest-timer__bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="workout-rest-timer__body">
        <div>
          <p className="workout-rest-timer__label">Rest</p>
          <p className="workout-rest-timer__time">{formatRestCountdown(secondsLeft)}</p>
        </div>
        <button type="button" className="workout-rest-timer__skip" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}