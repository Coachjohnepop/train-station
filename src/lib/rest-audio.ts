"use client";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Quiet rest click — soft short pulse so it can play every second without being harsh.
 * `urgent` slightly raises pitch/volume in the last few seconds.
 */
export function playRestTick(urgent = false): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = urgent ? 720 : 520;
    // Soft, short click
    const peak = urgent ? 0.055 : 0.028;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  } catch {
    /* ignore */
  }
}

/** Soft start chirp when rest begins (after a set is checked). */
export function playRestStart(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch {
    /* ignore */
  }
}

/**
 * Smooth end-of-rest buzzer — warm dual-tone swell, no harsh horn.
 * ~0.7s, easy on gym speakers and phones.
 */
export function playRestComplete(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.14, now + 0.08);
    master.gain.setValueAtTime(0.14, now + 0.35);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
    master.connect(ctx.destination);

    const tones: Array<{ freq: number; type: OscillatorType; gain: number }> = [
      { freq: 440, type: "sine", gain: 0.7 },
      { freq: 554.37, type: "sine", gain: 0.45 }, // C#5 — smooth fifth-ish color
      { freq: 220, type: "triangle", gain: 0.25 },
    ];

    for (const t of tones) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = t.type;
      osc.frequency.setValueAtTime(t.freq, now);
      osc.frequency.exponentialRampToValueAtTime(t.freq * 1.03, now + 0.55);
      g.gain.value = t.gain;
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 0.75);
    }
  } catch {
    /* ignore */
  }
}
