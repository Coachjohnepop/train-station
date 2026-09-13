"use client";

import { useEffect, useMemo, useState } from "react";

const DEMO_SCRIPT = [
  { text: "Upper body\n", tip: "First line is the workout name." },
  { text: "\n", tip: "Blank lines are fine." },
  { text: "Warm up 5 min\n\n", tip: "Warm-up in your own words." },
  { text: "Flat bench press\n", tip: "One move per line." },
  { text: "10,10,10\n\n", tip: "Reps under it. Commas = sets. This is 3 sets of 10." },
  { text: "Rows\n", tip: "Next move." },
  { text: "12,12,12\n", tip: "Same pattern. Then tap Build & open workout." },
];

function liveCoachTip(raw: string): string {
  const lines = raw.split("\n");
  const nonempty = lines.filter((l) => l.trim());
  const last = (nonempty[nonempty.length - 1] || "").trim();
  if (!raw.trim()) {
    return "Start with a title, like Upper body. Watch the example type itself, then paste yours the same way.";
  }
  if (nonempty.length === 1) {
    return "That’s the name. Next line: a move — one exercise, then reps under it.";
  }
  if (/^\d/.test(last.replace(/\s/g, "")) || /^\d+(,\d+)+$/.test(last.replace(/\s/g, ""))) {
    return "Those numbers are sets. Add another exercise name when you’re ready.";
  }
  if (/warm/i.test(last)) {
    return "Warm-up noted. Now the first lift on its own line.";
  }
  return "If that’s a move, put reps on the next line: 10,10,10";
}

export default function ByowFormatGuide({ rawText }: { rawText: string }) {
  const [typed, setTyped] = useState("");
  const [tipIndex, setTipIndex] = useState(0);

  const fullDemo = useMemo(() => DEMO_SCRIPT.map((s) => s.text).join(""), []);

  useEffect(() => {
    let i = 0;
    let char = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const chunk = DEMO_SCRIPT[i];
      if (!chunk) return;
      if (char < chunk.text.length) {
        char += 1;
        const shown = DEMO_SCRIPT.slice(0, i).map((s) => s.text).join("") + chunk.text.slice(0, char);
        setTyped(shown);
        setTipIndex(i);
        window.setTimeout(tick, chunk.text[char - 1] === "\n" ? 280 : 38);
        return;
      }
      i += 1;
      char = 0;
      if (i < DEMO_SCRIPT.length) window.setTimeout(tick, 420);
    };
    const start = window.setTimeout(tick, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, []);

  const userTip = liveCoachTip(rawText);
  const demoTip = DEMO_SCRIPT[Math.min(tipIndex, DEMO_SCRIPT.length - 1)]?.tip || "";

  return (
    <div className="space-y-3 rounded-xl border border-[var(--ramp-gold)]/35 bg-[color-mix(in_srgb,var(--ramp-gold)_8%,var(--surface))] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ramp-gold-light)]">
        How to write it
      </p>
      <p className="text-sm text-[var(--text)]">
        Title first. Then each <strong>move</strong> on its own line, with <strong>reps</strong>{" "}
        under it. Commas are sets — <span className="font-mono text-xs">10,10,10</span> means 3
        sets of 10.
      </p>
      <pre className="min-h-[7.5rem] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[13px] leading-relaxed text-[var(--ramp-gold-light)]">
        {typed || " "}
        {typed.length < fullDemo.length ? (
          <span className="animate-pulse text-[var(--text)]">▍</span>
        ) : null}
      </pre>
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        {rawText.trim() ? userTip : demoTip}
      </p>
    </div>
  );
}
