"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { PROGRAM_IMAGES } from "@/lib/program-constants";
import type { HowItWorksStepId } from "@/lib/how-it-works";

const DEMO_EQUIPMENT = [
  { id: "dumbbells", name: "Dumbbells", img: "/images/equipment/dumbbells.jpg" },
  { id: "kettlebell", name: "Kettlebell", img: "/images/equipment/kettlebell.jpg" },
  { id: "bands", name: "Resistance bands", img: "/images/equipment/resistance-bands.jpg" },
  { id: "bench", name: "Bench", img: "/images/equipment/bench.jpg" },
  { id: "mat", name: "Yoga mat", img: "/images/equipment/yoga-mat.jpg" },
  { id: "jump-rope", name: "Jump rope", img: "/images/equipment/jump-rope.jpg" },
  { id: "bosu", name: "Bosu", img: "/images/equipment/bosu.jpg" },
  { id: "foam-roller", name: "Foam roller", img: "/images/equipment/foam-roller.jpg" },
  { id: "medicine-ball", name: "Med ball", img: "/images/equipment/medicine-ball.jpg" },
  { id: "power-tower", name: "Power tower", img: "/images/equipment/power-tower.jpg" },
  { id: "pullup", name: "Pull-up", img: "/images/equipment/pullup.jpg" },
  { id: "stability-ball", name: "Stability", img: "/images/equipment/stability-ball.jpg" },
];

const SELECTED_GEAR = new Set([
  "dumbbells",
  "kettlebell",
  "bands",
  "bench",
  "mat",
  "jump-rope",
]);

const TICKETS = [
  { id: "free", name: "Free", price: "$0", img: "/images/tickets/free.jpg" },
  { id: "coach", name: "Coach Class", price: "$25/mo", img: "/images/tickets/coach-class.jpg" },
  { id: "business", name: "Business Class", price: "$50/mo", img: "/images/tickets/business-class.jpg" },
  { id: "first", name: "1st Class", price: "$100/mo", img: "/images/tickets/first-class.jpg" },
];

const PROGRAMS = [
  { id: "adult", name: "Adult Strength & Conditioning", img: PROGRAM_IMAGES.adult },
  { id: "athletes", name: "Athletes", img: PROGRAM_IMAGES["strength-training"] },
  { id: "military", name: "Military Preparation", img: PROGRAM_IMAGES["boot-camp-preparation"] },
  { id: "parents", name: "Mom & Dads with Little Time", img: PROGRAM_IMAGES["mom-dads-little-time"] },
];

const CAL_DAYS = [
  { n: 7, label: "Sun" },
  { n: 8, label: "Mon" },
  { n: 9, label: "Tue", pick: true },
  { n: 10, label: "Wed" },
  { n: 11, label: "Thu" },
  { n: 12, label: "Fri" },
  { n: 13, label: "Sat" },
];

const CAL_TIMES = ["11:00am", "1:00pm", "2:45pm"];

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

type GuideStop = { x: number; y: number; at: number };

/** Coach finger: circle the lesson, spiral to the tap, press and hold. */
function GuideFinger({
  playKey,
  stops,
  duration,
  label = "Like this",
}: {
  playKey: string | number;
  stops: readonly GuideStop[];
  duration: number;
  label?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fingerRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const stopsRef = useRef(stops);
  stopsRef.current = stops;

  useEffect(() => {
    const host = hostRef.current;
    const finger = fingerRef.current;
    const chip = chipRef.current;
    const path = stopsRef.current;
    if (!host || !finger || path.length === 0) return;
    const started = performance.now();
    let raf = 0;

    const posAt = (ms: number) => {
      const first = path[0]!;
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (ms <= first.at) {
        const t = Math.max(0, Math.min(1, ms / Math.max(1, first.at)));
        const e = 1 - Math.pow(1 - t, 1.12);
        const orbitX = 0.5 + (first.x - 0.5) * e;
        const orbitY = 0.46 + (first.y - 0.46) * e;
        const r = Math.min(w, h) * 0.42 * (1 - e);
        const angle = e * Math.PI * 2 * 1.7 - Math.PI / 2;
        const press = t > 0.86 ? 1 - Math.min(1, (t - 0.86) / 0.14) * 0.26 : 1;
        return {
          x: orbitX * w + Math.cos(angle) * r,
          y: orbitY * h + Math.sin(angle) * r,
          press,
          rot: -14 + Math.sin(angle) * 16,
        };
      }
      let prev = first;
      for (let i = 1; i < path.length; i += 1) {
        const next = path[i]!;
        if (ms <= next.at) {
          const span = Math.max(1, next.at - prev.at);
          const t = (ms - prev.at) / span;
          const e = t * t * (3 - 2 * t);
          const arc = Math.sin(e * Math.PI) * Math.min(w, h) * 0.07;
          const press = t > 0.76 ? 1 - Math.min(1, (t - 0.76) / 0.24) * 0.24 : 1;
          return {
            x: (prev.x + (next.x - prev.x) * e) * w,
            y: (prev.y + (next.y - prev.y) * e) * h - arc,
            press,
            rot: -10,
          };
        }
        prev = next;
      }
      const last = path[path.length - 1]!;
      return { x: last.x * w, y: last.y * h, press: 0.84, rot: -8 };
    };

    const frame = (now: number) => {
      const ms = now - started;
      const p = posAt(Math.min(ms, duration));
      finger.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -12%) rotate(${p.rot}deg) scale(${1.42 * p.press})`;
      if (chip) {
        chip.style.transform = `translate(${p.x}px, ${p.y}px) translate(-20%, -230%)`;
        chip.style.opacity = ms < 160 ? "0" : "1";
      }
      if (ms < duration) raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(raf);
  }, [playKey, duration]);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      <div
        ref={chipRef}
        className="absolute left-0 top-0 rounded-full bg-[#fde68a] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#3b2a08] shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
      >
        {label}
      </div>
      <div
        ref={fingerRef}
        className="absolute left-0 top-0 origin-center text-[3.6rem] leading-none drop-shadow-[0_10px_22px_rgba(0,0,0,0.55)] sm:text-[4.6rem]"
        aria-hidden
      >
        {"\u{1F447}\u{1F3FD}"}
      </div>
    </div>
  );
}

function useSceneClock(
  motion: "animate" | "still",
  playKey: string | number,
  steps: readonly number[],
  onReady?: () => void,
) {
  const [tick, setTick] = useState(motion === "still" ? 99 : 0);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (motion === "still") {
      setTick(99);
      onReadyRef.current?.();
      return;
    }
    setTick(0);
    const timers = stepsRef.current.map((ms, i, all) =>
      window.setTimeout(() => {
        setTick(i + 1);
        if (i === all.length - 1) onReadyRef.current?.();
      }, ms),
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [motion, playKey]);

  return tick;
}

/** Same picture guests see on How it Works — used in the tour and in Admin. */
export default function HowItWorksScreen({
  stepId,
  lastSetRef,
  motion = "still",
  playKey = 0,
  onReady,
}: {
  stepId: HowItWorksStepId;
  lastSetRef?: Ref<HTMLDivElement>;
  /** animate = guest tour playback. still = admin finished frame. */
  motion?: "animate" | "still";
  playKey?: string | number;
  onReady?: () => void;
}) {
  if (stepId === "workout") {
    return (
      <WorkoutScene
        lastSetRef={lastSetRef}
        motion={motion}
        playKey={playKey}
        onReady={onReady}
      />
    );
  }
  if (stepId === "ticket") {
    return <TicketScene motion={motion} playKey={playKey} onReady={onReady} />;
  }
  if (stepId === "program") {
    return <ProgramScene motion={motion} playKey={playKey} onReady={onReady} />;
  }
  if (stepId === "gear") {
    return <GearScene motion={motion} playKey={playKey} onReady={onReady} />;
  }
  return <BookScene motion={motion} playKey={playKey} onReady={onReady} />;
}

function WorkoutScene({
  lastSetRef,
  motion,
  playKey,
  onReady,
}: {
  lastSetRef?: Ref<HTMLDivElement>;
  motion: "animate" | "still";
  playKey: string | number;
  onReady?: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  // Weight edits first (~1s), then each set 1s apart.
  const tick = useSceneClock(motion, playKey, [350, 700, 1000, 2000, 3000, 4000], onReady);
  const weight = tick >= 3 || tick === 99 ? 135 : tick === 2 ? 115 : tick === 1 ? 95 : 0;
  const doneSets = tick === 99 ? [1, 2, 3] : tick >= 6 ? [1, 2, 3] : tick >= 5 ? [1, 2] : tick >= 4 ? [1] : [];
  const editing = tick < 3 && tick !== 99;
  const showFinger = motion === "animate" && !reduce;

  return (
    <div className="relative w-full overflow-visible rounded-2xl border border-white/15 bg-[#12081f] shadow-[0_16px_48px_rgba(0,0,0,0.65)]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent-fg)]">
            Live session
          </p>
          <p className="text-base font-semibold leading-tight text-[var(--text)]">
            Today · Lower day
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
          LIVE
        </span>
      </div>
      <div className="p-2.5">
        <div className="rounded-lg border border-[#7c3aed]/35 bg-[#1a0b2e]/90 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase text-[var(--accent-fg)]/80">Now</p>
              <h3 className="text-lg font-semibold leading-tight text-[var(--text)]">Goblet squat</h3>
              <p className="text-xs text-white/70">3 × 8 · Medium</p>
            </div>
            <span className="text-xs font-bold tabular-nums text-[#fde68a]">
              {weight || "—"}
              <span className="ml-0.5 text-[9px] text-white/45">lbs</span>
            </span>
          </div>
          <div className="relative mt-2 flex items-end gap-1.5">
            {showFinger ? (
              <GuideFinger
                playKey={playKey}
                duration={4200}
                label="Like this"
                stops={[
                  { x: 0.12, y: 0.55, at: 900 },
                  { x: 0.4, y: 0.55, at: 2000 },
                  { x: 0.64, y: 0.55, at: 3000 },
                  { x: 0.88, y: 0.55, at: 4000 },
                ]}
              />
            ) : null}
            <label
              className={`flex min-w-[3.75rem] flex-col rounded-md border px-1.5 py-1 ${
                editing
                  ? "border-[#fde68a] bg-[#fde68a]/10 ring-2 ring-[#fde68a]/40"
                  : "border-white/15 bg-black/30"
              }`}
            >
              <span className="text-[7px] font-bold uppercase text-white/40">Weight</span>
              <span className="text-base font-bold tabular-nums leading-none text-[#fde68a]">
                {weight || ""}
                {editing ? <span className="ml-0.5 animate-pulse">|</span> : null}
              </span>
            </label>
            {[1, 2, 3].map((n) => {
              const done = doneSets.includes(n);
              const just = done && doneSets[doneSets.length - 1] === n && tick !== 99;
              return (
                <div
                  key={n}
                  ref={n === 3 ? lastSetRef : undefined}
                  className={`flex h-12 flex-1 flex-col items-center justify-center rounded-md border text-sm font-bold transition-colors duration-300 ${
                    done
                      ? just
                        ? "scale-105 border-[#d4af37]/70 bg-[#d4af37]/30 text-[#fde68a]"
                        : "border-[#d4af37]/55 bg-[#d4af37]/20 text-[#fde68a]"
                      : "border-white/15 bg-white/5 text-white/80"
                  }`}
                >
                  <span className="text-sm leading-none">{done ? "✓" : n}</span>
                  <span className="text-[7px] uppercase opacity-70">Set</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketScene({
  motion,
  playKey,
  onReady,
}: {
  motion: "animate" | "still";
  playKey: string | number;
  onReady?: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  const tick = useSceneClock(motion, playKey, reduce ? [240] : [2400], onReady);
  const selected = tick >= 1 ? "business" : null;
  const showFinger = motion === "animate" && !reduce;

  return (
    <div className="relative w-full overflow-visible rounded-2xl border border-[#7c3aed]/40 bg-[var(--surface)] p-4">
      <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--accent-fg)]">
        How to access
      </p>
      <h3 className="mt-0.5 text-center text-lg font-semibold leading-tight text-[var(--text)]">
        Pick a Ticket Class
      </h3>
      <div className="relative mt-3 grid grid-cols-2 gap-2">
        {TICKETS.map((t) => {
          const on = selected === t.id;
          return (
            <div
              key={t.id}
              className={`overflow-hidden rounded-xl border transition duration-500 ${
                on
                  ? "border-[#a78bfa] ring-2 ring-[#7c3aed]/60 scale-[1.02]"
                  : selected
                    ? "border-white/10 opacity-50"
                    : "border-white/15"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.img} alt={t.name} className="aspect-[4/3] w-full object-cover" />
              <div className="bg-[#1a0b2e] px-2 py-1.5">
                <p className="text-[11px] font-semibold text-[var(--text)]">{t.name}</p>
                <p className="text-[10px] text-white/60">{t.price}</p>
                {on ? <p className="text-[10px] font-bold text-emerald-300">Selected ✓</p> : null}
              </div>
            </div>
          );
        })}
        {showFinger ? (
          <GuideFinger
            playKey={playKey}
            duration={2800}
            label="Like this"
            stops={[{ x: 0.25, y: 0.74, at: 2400 }]}
          />
        ) : null}
      </div>
    </div>
  );
}

function ProgramScene({
  motion,
  playKey,
  onReady,
}: {
  motion: "animate" | "still";
  playKey: string | number;
  onReady?: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  const tick = useSceneClock(motion, playKey, reduce ? [240] : [2200], onReady);
  const selected = tick >= 1 ? "adult" : null;
  const showFinger = motion === "animate" && !reduce;

  return (
    <div className="relative w-full overflow-visible rounded-2xl border border-white/15 bg-[#12081f] p-4">
      <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--accent-fg)]">
        Program
      </p>
      <h3 className="mt-0.5 text-center text-lg font-semibold leading-tight text-[var(--text)]">
        Pick a Program
      </h3>
      <div className="relative mt-3 grid grid-cols-2 gap-2">
        {showFinger ? (
          <GuideFinger
            playKey={playKey}
            duration={2600}
            label="Like this"
            stops={[{ x: 0.25, y: 0.48, at: 2200 }]}
          />
        ) : null}
        {PROGRAMS.map((p) => {
          const on = selected === p.id;
          return (
            <div
              key={p.id}
              className={`overflow-hidden rounded-xl border transition duration-500 ${
                on
                  ? "border-[#7c3aed] ring-2 ring-[#7c3aed]/50"
                  : selected
                    ? "border-white/10 opacity-50"
                    : "border-white/15"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.img} alt={p.name} className="h-20 w-full object-cover" />
              <div className="bg-[#1a0b2e] px-2 py-1.5">
                <p className="text-[11px] font-semibold leading-snug text-[var(--text)]">{p.name}</p>
                {on ? <p className="text-[10px] font-bold text-emerald-300">Selected ✓</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GearScene({
  motion,
  playKey,
  onReady,
}: {
  motion: "animate" | "still";
  playKey: string | number;
  onReady?: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  const delays = [400, 650, 900, 1150, 1400, 1650];
  const tick = useSceneClock(motion, playKey, delays, onReady);
  const selectedCount = tick === 99 ? 6 : Math.min(6, tick);
  const selectedIds = [...SELECTED_GEAR].slice(0, selectedCount);
  const showFinger = motion === "animate" && !reduce;

  return (
    <div className="relative w-full overflow-visible rounded-2xl border border-white/15 bg-[#12081f] p-4">
      <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--accent-fg)]">
        Gear at home
      </p>
      <h3 className="mt-0.5 text-center text-base font-semibold leading-tight text-[var(--text)]">
        {selectedCount ? `${selectedCount} items selected` : "Your equipment list"}
      </h3>
      <div className="relative mt-2 grid grid-cols-6 gap-1">
        {showFinger ? (
          <GuideFinger
            playKey={playKey}
            duration={1900}
            label="Tap yours"
            stops={[0, 1, 2, 3, 4, 5].map((i) => ({
              x: (i + 0.5) / 6,
              y: 0.48,
              at: delays[i] ?? 1650,
            }))}
          />
        ) : null}
        {DEMO_EQUIPMENT.map((eq) => {
          const on = selectedIds.includes(eq.id);
          return (
            <div
              key={eq.id}
              className={`overflow-hidden rounded-lg border transition duration-300 ${
                on ? "border-emerald-400/70 ring-1 ring-emerald-400/40" : "border-white/10 opacity-45"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={eq.img} alt={eq.name} className="aspect-square w-full object-cover" />
              <p
                className={`text-center text-[8px] font-bold ${
                  on ? "bg-emerald-500/20 text-emerald-300" : "bg-black/40 text-white/40"
                }`}
              >
                {on ? "✓" : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookScene({
  motion,
  playKey,
  onReady,
}: {
  motion: "animate" | "still";
  playKey: string | number;
  onReady?: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  const tick = useSceneClock(motion, playKey, [800, 1600, 2400, 3200], onReady);
  const dayPicked = tick >= 1;
  const timesOpen = tick >= 2;
  const timePicked = tick >= 3;
  const booked = tick >= 4;
  const showFinger = motion === "animate" && !reduce;

  return (
    <div className="relative w-full overflow-visible rounded-2xl border border-emerald-500/30 bg-[#0c1a14] p-4">
      <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-300/90">
        Calendly
      </p>
      <h3 className="mt-0.5 text-center text-base font-semibold leading-tight text-[var(--text)]">
        Coach Jeremy Byrd
      </h3>
      <p className="text-center text-[10px] text-emerald-300/80">15-min intro</p>
      {showFinger ? (
        <GuideFinger
          playKey={playKey}
          duration={3400}
          label="Like this"
          stops={[
            { x: 0.36, y: 0.42, at: 800 },
            { x: 0.5, y: 0.68, at: 2400 },
            { x: 0.5, y: 0.92, at: 3200 },
          ]}
        />
      ) : null}
      <div className="relative mt-2 overflow-hidden rounded-xl border border-white/12 bg-[var(--bg)]/90">
        <div className="flex items-center justify-between border-b border-white/10 px-2.5 py-2">
          <span className="text-xs font-semibold text-[var(--text)]">September 2026</span>
          <span className="text-[10px] text-white/45">Pacific</span>
        </div>
        <div className="grid grid-cols-7 gap-1 px-2 py-2">
          {CAL_DAYS.map((d) => {
            const on = dayPicked && d.pick;
            return (
              <div key={d.n} className="text-center">
                <p className="text-[8px] font-bold uppercase text-white/40">{d.label}</p>
                <div
                  className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition duration-400 ${
                    on
                      ? "bg-emerald-400 text-[#042f1a] ring-2 ring-emerald-200"
                      : "text-white/80"
                  }`}
                >
                  {d.n}
                </div>
              </div>
            );
          })}
        </div>
        {timesOpen ? (
          <div className="space-y-1 border-t border-white/10 px-2.5 py-2">
            {CAL_TIMES.map((slot, i) => {
              const on = timePicked && i === 0;
              return (
                <div
                  key={slot}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] transition duration-300 ${
                    on
                      ? "border border-emerald-400/50 bg-emerald-500/20 text-white"
                      : "border border-white/8 bg-white/[0.04] text-white/70"
                  }`}
                >
                  <span className="font-medium">{slot}</span>
                  <span className="text-[9px] font-bold uppercase text-emerald-300">
                    {on ? (booked ? "Booked ✓" : "Pick →") : "Open"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="border-t border-white/10 px-2.5 py-3 text-center text-[11px] text-white/45">
            Choose a day
          </p>
        )}
        <div className="border-t border-white/10 px-2.5 py-2">
          <div
            className={`flex h-9 items-center justify-center rounded-full text-xs font-bold transition ${
              booked ? "bg-emerald-400 text-[#042f1a]" : "bg-emerald-500/40 text-white/70"
            }`}
          >
            {booked ? "Appointment booked ✓" : "Confirm"}
          </div>
        </div>
      </div>
    </div>
  );
}
