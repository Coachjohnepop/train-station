/**
 * Landing mix: Theme Song + per-slide hero audio.
 * Volumes are linear HTMLMediaElement.volume (0–1). No Web Audio GainNode —
 * that path stuttered on iPhone intros.
 */

export const THEME_SONG_SRC = "/background-music.mp3";
export const THEME_SONG_DEFAULT_VOLUME = 0.55;
export const THEME_SONG_DEFAULT_ENABLED = true;
export const THEME_SONG_CLICK_STARTS_DEFAULT = 1;
export const THEME_SONG_CLICK_STARTS_MIN = 1;
export const THEME_SONG_CLICK_STARTS_MAX = 9;
export const HERO_AUDIO_DEFAULT_VOLUME = 0.8;
export const HERO_AUDIO_MAX_BYTES = 20 * 1024 * 1024;

export const HERO_AUDIO_ATTR = "data-ts-hero-audio";
export const MIX_AUDIO_ATTR = "data-ts-mix-audio";
export const LANDING_MIX_UNLOCK_EVENT = "ts-landing-mix-unlock";

const AUDIO_EXT_RE = /\.(mp3|m4a|aac|wav|ogg|oga|weba)(?:$|\?)/i;

export const HERO_AUDIO_CLIENT_ACCEPT =
  "audio/*,.mp3,.m4a,.aac,.wav,.ogg,audio/mpeg,audio/mp4,audio/x-m4a";

export const HERO_AUDIO_UPLOAD_CONTENT_TYPES = [
  "audio/*",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "application/octet-stream",
];

export function isHeroAudioSrc(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return AUDIO_EXT_RE.test(url.trim());
}

export function isAllowedHeroAudioUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const t = url.trim();
  if (t.startsWith("/uploads/") || t.startsWith("/audio/") || t.startsWith("/background-music")) {
    return true;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (/\.public\.blob\.vercel-storage\.com$/i.test(u.hostname)) return true;
    if (AUDIO_EXT_RE.test(u.pathname)) return true;
    return false;
  } catch {
    return t.startsWith("/");
  }
}

export function heroAudioExtFromMime(mime: string, fileName = ""): string {
  const m = mime.toLowerCase();
  const n = fileName.toLowerCase();
  if (m.includes("wav") || n.endsWith(".wav")) return "wav";
  if (m.includes("ogg") || n.endsWith(".ogg") || n.endsWith(".oga")) return "ogg";
  if (m.includes("aac") || n.endsWith(".aac")) return "aac";
  if (m.includes("m4a") || m === "audio/mp4" || n.endsWith(".m4a")) return "m4a";
  if (m.includes("webm") || n.endsWith(".weba")) return "weba";
  return "mp3";
}

export function clientHeroAudioMime(file: File): string {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("audio/") && t !== "application/octet-stream") return t;
  const n = file.name.toLowerCase();
  if (n.endsWith(".m4a")) return "audio/mp4";
  if (n.endsWith(".wav")) return "audio/wav";
  if (n.endsWith(".ogg") || n.endsWith(".oga")) return "audio/ogg";
  if (n.endsWith(".aac")) return "audio/aac";
  return "audio/mpeg";
}

export function validateHeroAudioFile(file: { size: number; mimeType: string; name?: string }) {
  if (file.size <= 0) throw new Error("Empty audio file.");
  if (file.size > HERO_AUDIO_MAX_BYTES) {
    throw new Error(
      `Audio too large (max ${Math.round(HERO_AUDIO_MAX_BYTES / (1024 * 1024))} MB).`,
    );
  }
  const mime = (file.mimeType || "").toLowerCase();
  const name = file.name || "";
  if (
    !mime.startsWith("audio/") &&
    mime !== "application/octet-stream" &&
    mime !== "" &&
    !isHeroAudioSrc(name)
  ) {
    throw new Error("Use MP3, M4A, AAC, WAV, or OGG.");
  }
}

/** Accept 0–1 or 0–100. */
export function clampMixVolume(raw: unknown, fallback = THEME_SONG_DEFAULT_VOLUME): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const linear = n > 1.0001 ? n / 100 : n;
  return Math.max(0, Math.min(1, linear));
}

export function mixVolumePercent(volume: number): number {
  return Math.round(clampMixVolume(volume, 0) * 100);
}

export function clampThemeSongClickStarts(
  raw: unknown,
  fallback = THEME_SONG_CLICK_STARTS_DEFAULT,
): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(
    THEME_SONG_CLICK_STARTS_MIN,
    Math.min(THEME_SONG_CLICK_STARTS_MAX, Math.round(n)),
  );
}

export function canStartThemeSongFromSilence(unlockCount: number, maxStarts: number): boolean {
  return unlockCount < clampThemeSongClickStarts(maxStarts);
}

let mixUnlocked = false;

export function isLandingMixUnlocked(): boolean {
  return mixUnlocked;
}

export function unlockLandingMix(): void {
  if (typeof window === "undefined") return;
  if (mixUnlocked) {
    window.dispatchEvent(new Event(LANDING_MIX_UNLOCK_EVENT));
    return;
  }
  mixUnlocked = true;
  window.dispatchEvent(new Event(LANDING_MIX_UNLOCK_EVENT));
}

export function onLandingMixUnlock(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(LANDING_MIX_UNLOCK_EVENT, handler);
  if (mixUnlocked) cb();
  return () => window.removeEventListener(LANDING_MIX_UNLOCK_EVENT, handler);
}

export function isMixAudioElement(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLMediaElement &&
    (el.getAttribute(HERO_AUDIO_ATTR) === "true" || el.getAttribute(MIX_AUDIO_ATTR) === "true")
  );
}

export function applyMixVolume(el: HTMLMediaElement, volume: number): void {
  el.volume = clampMixVolume(volume, 0);
}

export function mediaHasSrc(el: HTMLMediaElement, url: string): boolean {
  if (!url) return false;
  const attr = el.getAttribute("src") || "";
  if (attr === url) return true;
  try {
    return el.src === new URL(url, window.location.href).href;
  } catch {
    return el.src === url;
  }
}
