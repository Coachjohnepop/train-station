/**
 * End-of-rest alert sounds. Coach picks one per workout (system default or uploaded).
 * members hear it when the rest countdown hits zero.
 *
 * restTimerSound storage values:
 * - built-in id: cybertruck | whistle | bell | buzzer
 * - custom upload: full https:// or /uploads/… URL (best for live sync)
 */

export const REST_TIMER_SOUND_IDS = [
  "whistle",
  "bell",
  "buzzer",
  "cybertruck",
] as const;

export type RestTimerSoundId = (typeof REST_TIMER_SOUND_IDS)[number];

/** Built-in id or custom audio URL. */
export type RestTimerSoundKey = string;

/** Default: Cybertruck honk when rest ends. */
export const DEFAULT_REST_TIMER_SOUND: RestTimerSoundId = "cybertruck";

/**
 * Bell / buzzer stay a bit quieter.
 * Cybertruck + train whistle stay hot so they cut through the gym floor.
 */
export const REST_COMPLETE_VOLUME_SCALE = 0.5;
export const REST_CYBERTRUCK_VOLUME_SCALE = 0.85;
/** Full level for the robust station whistle sample. */
export const REST_WHISTLE_VOLUME_SCALE = 1;
/** Uploaded coach clips at full level (they control length/loudness). */
export const REST_CUSTOM_VOLUME_SCALE = 1;

export type RestTimerSoundOption = {
  id: RestTimerSoundKey;
  label: string;
  /** Short coach-facing hint */
  hint: string;
  src: string;
  /** Playback volume 0–1 before scale (default 1). */
  volume?: number;
  /** Built-in vs coach upload */
  kind?: "system" | "custom";
};

/**
 * All system clips are pure instrument / effect synthesis — no speech or vocal samples.
 */
/** Bump when replacing files so browsers drop stale (quiet/broken) cache entries. */
const AUDIO_CACHE_BUST = "20260729b";

export const REST_TIMER_SOUND_OPTIONS: RestTimerSoundOption[] = [
  {
    id: "cybertruck",
    label: "Cybertruck honk",
    hint: "Real Cybertruck horn (default)",
    src: `/audio/rest-cybertruck-horn-v2.mp3?v=${AUDIO_CACHE_BUST}`,
    volume: 1,
    kind: "system",
  },
  {
    id: "whistle",
    label: "Train whistle",
    hint: "Loud station dual-tone blast",
    src: `/audio/rest-train-whistle.mp3?v=${AUDIO_CACHE_BUST}`,
    volume: 1,
    kind: "system",
  },
  {
    id: "bell",
    label: "Bell",
    hint: "Bright ding + ring",
    src: `/audio/rest-bell.mp3?v=${AUDIO_CACHE_BUST}`,
    kind: "system",
  },
  {
    id: "buzzer",
    label: "Buzzer",
    hint: "Harsh game-show buzz",
    src: `/audio/rest-buzzer.mp3?v=${AUDIO_CACHE_BUST}`,
    kind: "system",
  },
];

const SRC_BY_ID: Record<RestTimerSoundId, string> = Object.fromEntries(
  REST_TIMER_SOUND_OPTIONS.map((o) => [o.id, o.src]),
) as Record<RestTimerSoundId, string>;

export function isBuiltinRestTimerSound(value: unknown): value is RestTimerSoundId {
  return (
    typeof value === "string" &&
    (REST_TIMER_SOUND_IDS as readonly string[]).includes(value)
  );
}

/** @deprecated use isBuiltinRestTimerSound */
export function isRestTimerSoundId(value: unknown): value is RestTimerSoundId {
  return isBuiltinRestTimerSound(value);
}

export function isCustomRestSoundUrl(value: string): boolean {
  const v = value.trim();
  return (
    v.startsWith("https://") ||
    v.startsWith("http://") ||
    v.startsWith("/uploads/") ||
    v.startsWith("/audio/")
  );
}

/**
 * Preserve built-in ids and custom URLs. Unknown junk → default.
 */
export function normalizeRestTimerSound(value: unknown): RestTimerSoundKey {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_REST_TIMER_SOUND;
  const v = value.trim();
  if (isBuiltinRestTimerSound(v)) return v;
  if (isCustomRestSoundUrl(v)) return v;
  // legacy custom:uuid — still pass through if library can resolve
  if (v.startsWith("custom:")) return v;
  return DEFAULT_REST_TIMER_SOUND;
}

export function restTimerSoundSrc(
  id: RestTimerSoundKey | null | undefined,
  libraryItems?: Array<{ id: string; url: string }>,
): string {
  const key = normalizeRestTimerSound(id);
  if (isBuiltinRestTimerSound(key)) {
    return SRC_BY_ID[key] || SRC_BY_ID[DEFAULT_REST_TIMER_SOUND];
  }
  if (isCustomRestSoundUrl(key)) return key;
  if (key.startsWith("custom:") && libraryItems?.length) {
    const customId = key.slice("custom:".length);
    const hit = libraryItems.find((i) => i.id === customId);
    if (hit?.url) return hit.url;
  }
  return SRC_BY_ID[DEFAULT_REST_TIMER_SOUND];
}

export function restTimerSoundLabel(
  id: RestTimerSoundKey | null | undefined,
  libraryItems?: Array<{ id: string; title: string; url: string }>,
): string {
  const key = normalizeRestTimerSound(id);
  if (isBuiltinRestTimerSound(key)) {
    return REST_TIMER_SOUND_OPTIONS.find((o) => o.id === key)?.label ?? "Cybertruck honk";
  }
  if (libraryItems?.length) {
    const byUrl = libraryItems.find((i) => i.url === key);
    if (byUrl) return byUrl.title;
    if (key.startsWith("custom:")) {
      const byId = libraryItems.find((i) => i.id === key.slice(7));
      if (byId) return byId.title;
    }
  }
  if (isCustomRestSoundUrl(key)) return "Custom rest sound";
  return "Cybertruck honk";
}

export function restTimerSoundVolume(id: RestTimerSoundKey | null | undefined): number {
  const key = normalizeRestTimerSound(id);
  if (isBuiltinRestTimerSound(key)) {
    const v = REST_TIMER_SOUND_OPTIONS.find((o) => o.id === key)?.volume;
    const base =
      typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
    let scale = REST_COMPLETE_VOLUME_SCALE;
    if (key === "cybertruck") scale = REST_CYBERTRUCK_VOLUME_SCALE;
    if (key === "whistle") scale = REST_WHISTLE_VOLUME_SCALE;
    return Math.min(1, Math.max(0, base * scale));
  }
  // Coach-uploaded clips play at full level
  return REST_CUSTOM_VOLUME_SCALE;
}

/** Alternate paths if primary sample fails to decode. */
export function restTimerSoundFallbackSrc(
  id: RestTimerSoundKey | null | undefined,
): string | null {
  const key = normalizeRestTimerSound(id);
  if (key === "cybertruck") {
    return `/audio/rest-cybertruck-horn.mp3?v=${AUDIO_CACHE_BUST}`;
  }
  if (key === "whistle") {
    return `/audio/train-whistle.mp3?v=${AUDIO_CACHE_BUST}`;
  }
  return null;
}

/** Merge system defaults + coach library for picker UIs. */
export function buildRestTimerSoundOptions(
  libraryItems?: Array<{ id: string; title: string; url: string }>,
): RestTimerSoundOption[] {
  const custom = (libraryItems || []).map((item) => ({
    id: item.url, // store URL for live sync without library on member
    label: item.title,
    hint: "Coach upload",
    src: item.url,
    volume: 1,
    kind: "custom" as const,
  }));
  return [...REST_TIMER_SOUND_OPTIONS, ...custom];
}
