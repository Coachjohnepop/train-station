/**
 * Uploaded content volume relative to native (0 dB).
 * Steps of 3 dB; linear gain = 10^(dB/20).
 * HTMLMediaElement.volume is capped at 1.0 — boosts above 0 dB use Web Audio GainNode.
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

/**
 * Apply relative volume to an HTML video/audio element.
 * For gain > 1, uses Web Audio GainNode (browser volume property max is 1).
 */
export function applyMediaVolumeDb(el: HTMLMediaElement, db: number): void {
  const offset = clampVolumeDb(db, 0);
  const linear = volumeDbToLinear(offset);

  // Prefer simple path when not boosting past 1.0
  if (linear <= 1) {
    // Disconnect prior graph if any — leave element on media element volume
    const prev = wired.get(el);
    if (prev) {
      try {
        prev.source.disconnect();
        prev.gain.disconnect();
      } catch {
        /* ignore */
      }
      wired.delete(el);
    }
    el.volume = Math.max(0, Math.min(1, linear));
    el.muted = false;
    return;
  }

  // Boost above native: Web Audio
  el.volume = 1;
  el.muted = false;
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
      // Already wired elsewhere or createMediaElementSource once-only violation
      el.volume = 1;
      return;
    }
  }
  graph.gain.gain.value = linear;
  if (graph.ctx.state === "suspended") {
    void graph.ctx.resume().catch(() => {});
  }
}
