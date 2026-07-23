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
  /** Playback volume 0–1 (default 1). */
  volume?: number;
};

/**
 * All clips are pure instrument / effect synthesis — no speech or vocal samples.
 * Filenames are rest-*-v SFX so clients don't keep an old talking clip cached.
 */
/** Bump when replacing files so browsers drop stale (quiet/broken) cache entries. */
const AUDIO_CACHE_BUST = "20260722";

export const REST_TIMER_SOUND_OPTIONS: RestTimerSoundOption[] = [
  {
    id: "whistle",
    label: "Train whistle",
    hint: "Dual-tone station blast (default)",
    src: `/audio/rest-train-whistle.mp3?v=${AUDIO_CACHE_BUST}`,
  },
  {
    id: "bell",
    label: "Bell",
    hint: "Bright ding + ring",
    src: `/audio/rest-bell.mp3?v=${AUDIO_CACHE_BUST}`,
  },
  {
    id: "buzzer",
    label: "Buzzer",
    hint: "Harsh game-show buzz",
    src: `/audio/rest-buzzer.mp3?v=${AUDIO_CACHE_BUST}`,
  },
  {
    id: "cybertruck",
    label: "Cybertruck honk",
    hint: "Real Cybertruck horn sample",
    src: `/audio/rest-cybertruck-horn-v2.mp3?v=${AUDIO_CACHE_BUST}`,
    /** ~15% quieter — real sample is hotter than the synth SFX. */
    volume: 0.85,
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

export function restTimerSoundVolume(id: RestTimerSoundId | string | null | undefined): number {
  const sound = normalizeRestTimerSound(id);
  const v = REST_TIMER_SOUND_OPTIONS.find((o) => o.id === sound)?.volume;
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(1, Math.max(0, v));
  }
  return 1;
}
