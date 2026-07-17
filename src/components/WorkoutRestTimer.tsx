"use client";

import { formatRestCountdown } from "@/lib/rest-timer";

type Props = {
  secondsLeft: number;
  totalSeconds: number;
  onSkip: () => void;
  compact?: boolean;
  /** Sticky floating banner so coach + member always see it while scrolling. */
  sticky?: boolean;
  exerciseName?: string | null;
  completedSetNum?: number | null;
  muted?: boolean;
  onToggleMute?: () => void;
};

export default function WorkoutRestTimer({
  secondsLeft,
  totalSeconds,
  onSkip,
  compact = false,
  sticky = false,
  exerciseName,
  completedSetNum,
  muted,
  onToggleMute,
}: Props) {
  const progress =
    totalSeconds > 0 ? Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100) : 100;
  const urgent = secondsLeft > 0 && secondsLeft <= 5;

  const body = (
    <div
      className={`workout-rest-timer ${compact ? "workout-rest-timer--compact" : ""} ${
        sticky ? "workout-rest-timer--sticky" : ""
      } ${urgent ? "workout-rest-timer--urgent" : ""}`}
      role="timer"
      aria-live="polite"
      aria-label={`Rest ${formatRestCountdown(secondsLeft)} remaining`}
    >
      <div className="workout-rest-timer__bar" aria-hidden>
        <div className="workout-rest-timer__bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="workout-rest-timer__body">
        <div className="min-w-0">
          <p className="workout-rest-timer__label">
            Rest
            {completedSetNum != null ? ` · after set ${completedSetNum}` : ""}
          </p>
          {exerciseName ? (
            <p className="workout-rest-timer__exercise">{exerciseName}</p>
          ) : null}
          <p className="workout-rest-timer__time">{formatRestCountdown(secondsLeft)}</p>
        </div>
        <div className="workout-rest-timer__actions">
          {onToggleMute ? (
            <button
              type="button"
              className="workout-rest-timer__mute"
              onClick={onToggleMute}
              aria-pressed={Boolean(muted)}
            >
              {muted ? "Unmute" : "Mute"}
            </button>
          ) : null}
          <button type="button" className="workout-rest-timer__skip" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );

  if (!sticky) return body;

  return (
    <div className="workout-rest-timer-sticky-shell" aria-hidden={false}>
      {body}
    </div>
  );
}
