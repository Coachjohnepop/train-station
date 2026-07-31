/**
 * Uploaded content volume relative to native (0 dB).
 * Steps of 3 dB; linear gain = 10^(dB/20).
 *
 * HTMLMediaElement.volume is capped at 1.0. Boosts above 0 dB only use Web Audio
 * GainNode for **same-origin** media. Cross-origin Blob/CDN videos MUST NOT use
 * createMediaElementSource — without CORS that path is silent.
 */

export const VOLUME_DB_STEP = 3;
/** Inclusive range: -24 … +24 dB (±8 steps of 3) */
export const VOLUME_DB_MIN = -24;
export const VOLUME_DB_MAX = 24;
/** Bump intros a bit by default (one step up) */
export const DEFAULT_UPLOADED_CONTENT_VOLUME_DB = 6;

export function clampVolumeDb(raw: unknown, fallback = DEFAULT_UPLOADED_CONTENT_VOLUME_DB): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const stepped = Math.round(n / VOLUME_DB_STEP) * VOLUME_DB_STEP;
  return Math.max(VOLUME_DB_MIN, Math.min(VOLUME_DB_MAX, stepped));
}

export function volumeDbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/** dB offset for a linear gain multiplier (e.g. 3× → ~+9.5 dB). */
export function linearMultiplierToDb(mult: number): number {
  if (!(mult > 0) || !Number.isFinite(mult)) return 0;
  return 20 * Math.log10(mult);
}

/**
 * YouTube iframe API setVolume is 0–100 (native ≈ 100).
 * Boost above 0 dB cannot exceed 100 on YouTube embeds.
 */
export function volumeDbToYoutubePercent(db: number): number {
  if (db >= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(100 * volumeDbToLinear(db))));
}

export function formatVolumeDbLabel(db: number): string {
  if (db === 0) return "Native (0 dB)";
  const sign = db > 0 ? "+" : "";
  return `${sign}${db} dB`;
}

type Wired = {
  ctx: AudioContext;
  gain: GainNode;
  source: MediaElementAudioSourceNode;
};

const wired = new WeakMap<HTMLMediaElement, Wired>();

function isSameOriginMedia(el: HTMLMediaElement): boolean {
  if (typeof window === "undefined") return false;
  try {
    const src = el.currentSrc || el.src || el.getAttribute("src") || "";
    if (!src) return true; // not loaded yet — allow later retry
    if (src.startsWith("blob:") || src.startsWith("data:")) return true;
    const u = new URL(src, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

function tearDownGraph(el: HTMLMediaElement): void {
  const prev = wired.get(el);
  if (!prev) return;
  try {
    prev.source.disconnect();
    prev.gain.disconnect();
  } catch {
    /* ignore */
  }
  try {
    void prev.ctx.close();
  } catch {
    /* ignore */
  }
  wired.delete(el);
}

/**
 * Apply relative volume to an HTML video/audio element.
 * Always unmutes. Cross-origin (e.g. Vercel Blob) stays on element.volume ≤ 1
 * so we never silence the stream via a CORS-blocked Web Audio graph.
 */
export function applyMediaVolumeDb(el: HTMLMediaElement, db: number): void {
  const offset = clampVolumeDb(db, 0);
  const linear = volumeDbToLinear(offset);

  el.muted = false;

  // Attenuate or native: simple element volume (and drop any old graph)
  if (linear <= 1 || !isSameOriginMedia(el)) {
    tearDownGraph(el);
    el.volume = Math.max(0, Math.min(1, linear > 1 ? 1 : linear));
    return;
  }

  // Same-origin boost above 1.0 via Web Audio
  el.volume = 1;
  let graph = wired.get(el);
  if (!graph) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) {
      el.volume = 1;
      return;
    }
    try {
      const ctx = new AC();
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      graph = { ctx, gain, source };
      wired.set(el, graph);
    } catch {
      // createMediaElementSource is once-per-element; never leave muted
      el.volume = 1;
      el.muted = false;
      return;
    }
  }
  graph.gain.gain.value = linear;
  if (graph.ctx.state === "suspended") {
    void graph.ctx.resume().catch(() => {});
  }
}
