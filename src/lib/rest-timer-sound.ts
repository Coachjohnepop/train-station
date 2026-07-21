/**
 * End-of-rest alert sounds. Coach picks one per workout;
 * members hear it when the rest countdown hits zero.
 */

export const REST_TIMER_SOUND_IDS = [
  "whistle",
  "bell",
  "buzzer",
  "cybertruck",
] as const;

export type RestTimerSoundId = (typeof REST_TIMER_SOUND_IDS)[number];

/** Default: loud train whistle when rest ends. */
export const DEFAULT_REST_TIMER_SOUND: RestTimerSoundId = "whistle";

export type RestTimerSoundOption = {
  id: RestTimerSoundId;
  label: string;
  /** Short coach-facing hint */
  hint: string;
  src: string;
};

export const REST_TIMER_SOUND_OPTIONS: RestTimerSoundOption[] = [
  {
    id: "whistle",
    label: "Train whistle",
    hint: "Loud station blast (default)",
    src: "/audio/train-whistle.mp3",
  },
  {
    id: "bell",
    label: "Bell",
    hint: "Two-tone ding",
    src: "/audio/rest-bell.mp3",
  },
  {
    id: "buzzer",
    label: "Buzzer",
    hint: "Game-show buzz",
    src: "/audio/rest-buzzer.mp3",
  },
  {
    id: "cybertruck",
    label: "Cybertruck honk",
    hint: "Tesla-style horn",
    src: "/audio/cybertruck-horn.mp3",
  },
];

const SRC_BY_ID: Record<RestTimerSoundId, string> = Object.fromEntries(
  REST_TIMER_SOUND_OPTIONS.map((o) => [o.id, o.src]),
) as Record<RestTimerSoundId, string>;

export function isRestTimerSoundId(value: unknown): value is RestTimerSoundId {
  return (
    typeof value === "string" &&
    (REST_TIMER_SOUND_IDS as readonly string[]).includes(value)
  );
}

export function normalizeRestTimerSound(value: unknown): RestTimerSoundId {
  if (isRestTimerSoundId(value)) return value;
  return DEFAULT_REST_TIMER_SOUND;
}

export function restTimerSoundSrc(id: RestTimerSoundId | string | null | undefined): string {
  const sound = normalizeRestTimerSound(id);
  return SRC_BY_ID[sound] || SRC_BY_ID[DEFAULT_REST_TIMER_SOUND];
}

export function restTimerSoundLabel(id: RestTimerSoundId | string | null | undefined): string {
  const sound = normalizeRestTimerSound(id);
  return REST_TIMER_SOUND_OPTIONS.find((o) => o.id === sound)?.label ?? "Train whistle";
}
