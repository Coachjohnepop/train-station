import { preferAmbientAudioSession, preferTransientAudioSession } from "@/lib/audio-session";

const BURSTS = 3;
const ON_SEC = 0.15;
const GAP_SEC = 0.09;

let audioCtx: AudioContext | null = null;
let playing = false;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Call in the same turn as the tap, before the save request, so the horn can play after. */
export function armCalorieHorn(): void {
  const ctx = audioContext();
  if (!ctx) return;
  preferTransientAudioSession();
  if (ctx.state !== "running") void ctx.resume().catch(() => {});
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + 0.02);
  } catch {
    /* ignore */
  }
}

function scheduleBrrt(ctx: AudioContext, time: number, duration: number): void {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, time);
  master.gain.exponentialRampToValueAtTime(0.85, time + 0.012);
  master.gain.setValueAtTime(0.85, time + duration - 0.03);
  master.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  const tremolo = ctx.createGain();
  tremolo.gain.setValueAtTime(0.72, time);
  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(34, time);
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.48;
  lfo.connect(lfoDepth);
  lfoDepth.connect(tremolo.gain);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1600, time);
  filter.Q.value = 0.6;
  filter.connect(tremolo);
  tremolo.connect(master);
  master.connect(ctx.destination);

  const voices: Array<{ type: OscillatorType; freq: number; gain: number }> = [
    { type: "sawtooth", freq: 185, gain: 0.42 },
    { type: "square", freq: 92, gain: 0.22 },
    { type: "sawtooth", freq: 370, gain: 0.16 },
  ];
  for (const voice of voices) {
    const osc = ctx.createOscillator();
    osc.type = voice.type;
    osc.frequency.setValueAtTime(voice.freq, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, voice.freq * 0.88), time + duration);
    const gain = ctx.createGain();
    gain.gain.value = voice.gain;
    osc.connect(gain);
    gain.connect(filter);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }
  lfo.start(time);
  lfo.stop(time + duration + 0.02);
}

const SKULL = `<svg class="calorie-red-flash__mark" viewBox="0 0 200 250" aria-hidden="true">
  <defs>
    <mask id="calorie-red-skull">
      <rect width="200" height="250" fill="black" />
      <g fill="white">
        <g transform="translate(100 176) rotate(-38)">
          <rect x="-78" y="-8" width="156" height="16" rx="8" />
          <circle cx="-78" cy="0" r="14" />
          <circle cx="78" cy="0" r="14" />
        </g>
        <g transform="translate(100 176) rotate(38)">
          <rect x="-78" y="-8" width="156" height="16" rx="8" />
          <circle cx="-78" cy="0" r="14" />
          <circle cx="78" cy="0" r="14" />
        </g>
        <ellipse cx="100" cy="86" rx="54" ry="60" />
        <rect x="78" y="132" width="44" height="22" rx="6" />
      </g>
      <g fill="black">
        <ellipse cx="80" cy="80" rx="14" ry="18" />
        <ellipse cx="120" cy="80" rx="14" ry="18" />
        <path d="M100 98 L92 116 L108 116 Z" />
        <rect x="86" y="136" width="6" height="14" />
        <rect x="97" y="136" width="6" height="14" />
        <rect x="108" y="136" width="6" height="14" />
      </g>
    </mask>
  </defs>
  <rect width="200" height="250" fill="currentColor" mask="url(#calorie-red-skull)" />
</svg>`;

function flashScreen(bursts: number): void {
  const overlay = document.createElement("div");
  overlay.className = "calorie-red-flash";
  overlay.setAttribute("role", "alert");
  const label = document.createElement("span");
  label.className = "calorie-red-flash__label";
  label.textContent = "Over the hard calorie total";
  overlay.appendChild(label);
  overlay.insertAdjacentHTML("beforeend", SKULL);
  document.body.appendChild(overlay);

  const periodMs = (ON_SEC + GAP_SEC) * 1000;
  const onMs = ON_SEC * 1000;
  for (let i = 0; i < bursts; i += 1) {
    window.setTimeout(() => {
      overlay.dataset.on = "1";
    }, i * periodMs);
    window.setTimeout(() => {
      overlay.dataset.on = "0";
    }, i * periodMs + onMs);
  }
  window.setTimeout(() => {
    overlay.remove();
    playing = false;
    preferAmbientAudioSession();
  }, bursts * periodMs + 80);
}

/** Three full-screen red flashes, each with a short horn burst. */
export function playCalorieRedAlert(): void {
  if (typeof document === "undefined" || playing) return;
  playing = true;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bursts = reduce ? 1 : BURSTS;
  preferTransientAudioSession();
  const ctx = audioContext();
  if (ctx) {
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    const start = ctx.currentTime + 0.02;
    for (let i = 0; i < bursts; i += 1) {
      scheduleBrrt(ctx, start + i * (ON_SEC + GAP_SEC), ON_SEC);
    }
  }
  flashScreen(bursts);
}
