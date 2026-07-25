"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { formatRestCountdown } from "@/lib/rest-timer";

export type WorkoutTimerPhase = "exercise" | "rest";

type Props = {
  secondsLeft: number;
  totalSeconds: number;
  onSkip: () => void;
  compact?: boolean;
  /** Centered modal (default). When false, inline card only. */
  sticky?: boolean;
  exerciseName?: string | null;
  completedSetNum?: number | null;
  muted?: boolean;
  onToggleMute?: () => void;
  /** True for the brief 0:00 / buzz window before auto-close. */
  completing?: boolean;
  /**
   * exercise = green "Time of Exercise" hold countdown
   * rest = amber rest between sets (default)
   */
  phase?: WorkoutTimerPhase;
};

export default function WorkoutRestTimer({
  secondsLeft,
  totalSeconds,
  onSkip,
  compact = false,
  sticky = true,
  exerciseName,
  completedSetNum,
  muted,
  onToggleMute,
  completing = false,
  phase = "rest",
}: Props) {
  const isExercise = phase === "exercise";
  const progress =
    totalSeconds > 0
      ? Math.min(100, ((totalSeconds - Math.max(0, secondsLeft)) / totalSeconds) * 100)
      : 100;
  const urgent = !completing && secondsLeft > 0 && secondsLeft <= 5;
  const done = completing || secondsLeft <= 0;

  useEffect(() => {
    if (!sticky || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onSkip();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sticky, onSkip]);

  const eyebrow = done
    ? isExercise
      ? "Hold complete"
      : "Rest complete"
    : isExercise
      ? "Time of Exercise"
      : "Rest timer";

  const ariaLabel = done
    ? isExercise
      ? "Hold complete"
      : "Rest complete"
    : isExercise
      ? `Time of exercise ${formatRestCountdown(secondsLeft)} remaining`
      : `Rest ${formatRestCountdown(secondsLeft)} remaining`;

  const hint = done
    ? isExercise
      ? "Alert — rest next…"
      : "Alert — closing…"
    : urgent
      ? isExercise
        ? "Almost done…"
        : "Get ready…"
      : isExercise
        ? "Hold / timed set · cybertruck when done · then rest"
        : "After each set (including last) · closes on rest-end sound";

  const skipLabel = done
    ? "Close"
    : isExercise
      ? "Skip hold"
      : "Skip rest";

  const player = (
    <div
      className={`workout-rest-player ${compact ? "workout-rest-player--compact" : ""} ${
        urgent ? "workout-rest-player--urgent" : ""
      } ${done ? "workout-rest-player--done" : ""} ${
        isExercise ? "workout-rest-player--exercise" : ""
      }`}
      role="timer"
      aria-live="polite"
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="workout-rest-player__chrome">
        <p className="workout-rest-player__eyebrow">
          {eyebrow}
          {!isExercise && completedSetNum != null && !done
            ? ` · after set ${completedSetNum}`
            : ""}
          {isExercise && completedSetNum != null && !done
            ? ` · set ${completedSetNum}`
            : ""}
        </p>
        <button
          type="button"
          className="workout-rest-player__close"
          onClick={onSkip}
          aria-label={isExercise ? "Skip hold timer" : "Close rest timer"}
          title="Close"
        >
          ✕
        </button>
      </div>

      {exerciseName ? <p className="workout-rest-player__exercise">{exerciseName}</p> : null}

      <p className="workout-rest-player__time">
        {done ? "0:00" : formatRestCountdown(Math.max(0, secondsLeft))}
      </p>
      <p className="workout-rest-player__hint">{hint}</p>

      <div className="workout-rest-player__track" aria-hidden>
        <div
          className="workout-rest-player__track-fill"
          style={{ width: `${done ? 100 : progress}%` }}
        />
      </div>

      <div className="workout-rest-player__actions">
        {onToggleMute ? (
          <button
            type="button"
            className="workout-rest-player__btn"
            onClick={onToggleMute}
            aria-pressed={Boolean(muted)}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
        ) : null}
        <button
          type="button"
          className="workout-rest-player__btn workout-rest-player__btn--primary"
          onClick={onSkip}
        >
          {skipLabel}
        </button>
      </div>
    </div>
  );

  if (!sticky) {
    return <div className="workout-rest-player-inline">{player}</div>;
  }

  const overlay = (
    <div
      className="workout-rest-player-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isExercise ? "Time of exercise" : "Rest timer"}
    >
      <button
        type="button"
        className="workout-rest-player-backdrop"
        aria-label={isExercise ? "Skip hold timer" : "Close rest timer"}
        onClick={onSkip}
      />
      <div className="workout-rest-player-stage">{player}</div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
