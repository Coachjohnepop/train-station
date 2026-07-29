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

/** Default: station train whistle (the real sample in /audio/train-whistle.mp3). */
export const DEFAULT_REST_TIMER_SOUND: RestTimerSoundId = "whistle";

/**
 * Whistle / bell / buzzer play at half prior gym-floor level.
 * Cybertruck (default) stays hotter so the honk still cuts through.
 */
export const REST_COMPLETE_VOLUME_SCALE = 0.5;
export const REST_CYBERTRUCK_VOLUME_SCALE = 0.85;

export type RestTimerSoundOption = {
  id: RestTimerSoundId;
  label: string;
  /** Short coach-facing hint */
  hint: string;
  src: string;
  /** Playback volume 0–1 before scale (default 1). */
  volume?: number;
};

/**
 * All clips are pure instrument / effect synthesis — no speech or vocal samples.
 * Filenames are rest-*-v SFX so clients don't keep an old talking clip cached.
 */
/** Bump when replacing files so browsers drop stale (quiet/broken) cache entries. */
const AUDIO_CACHE_BUST = "20260729a";

export const REST_TIMER_SOUND_OPTIONS: RestTimerSoundOption[] = [
  {
    id: "cybertruck",
    label: "Cybertruck honk",
    hint: "Real Cybertruck horn",
    // Prefer v2 path; playRestComplete will fall back if load fails.
    src: `/audio/rest-cybertruck-horn-v2.mp3?v=${AUDIO_CACHE_BUST}`,
    volume: 1,
  },
  {
    id: "whistle",
    label: "Train whistle",
    hint: "Station train whistle (the one we added)",
    // Use the real train-whistle.mp3 (not the alternate rest-train-whistle sample).
    src: `/audio/train-whistle.mp3?v=${AUDIO_CACHE_BUST}`,
    volume: 1,
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
  const base =
    typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  const scale =
    sound === "cybertruck" || sound === "whistle"
      ? REST_CYBERTRUCK_VOLUME_SCALE
      : REST_COMPLETE_VOLUME_SCALE;
  return Math.min(1, Math.max(0, base * scale));
}

/** Alternate paths if primary sample fails to decode. */
export function restTimerSoundFallbackSrc(
  id: RestTimerSoundId | string | null | undefined,
): string | null {
  const sound = normalizeRestTimerSound(id);
  if (sound === "cybertruck") {
    return `/audio/rest-cybertruck-horn.mp3?v=${AUDIO_CACHE_BUST}`;
  }
  if (sound === "whistle") {
    // Older rest-train-whistle path if the primary train-whistle.mp3 fails.
    return `/audio/rest-train-whistle.mp3?v=${AUDIO_CACHE_BUST}`;
  }
  return null;
}
