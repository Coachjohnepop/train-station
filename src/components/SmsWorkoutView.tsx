"use client";

import { useState } from "react";
import { linkifyText } from "@/lib/linkify-text";

export default function SmsWorkoutView({
  title,
  body,
  programSlug,
  replacesLiveSession,
}: {
  title: string;
  body: string;
  programSlug: string;
  replacesLiveSession?: boolean;
}) {
  const [done, setDone] = useState(false);

  return (
    <div className="mt-4 space-y-4">
      <div className="card border-accent/40 bg-accent/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-accent font-semibold">Coach SMS workout</p>
            <h1 className="mt-1 text-xl font-bold">{title}</h1>
            {replacesLiveSession && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Today&apos;s live session is replaced by this coach-prescribed workout.
              </p>
            )}
          </div>
          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] text-accent">SMS override</span>
        </div>
      </div>

      <div className="card">
        <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--foreground)] break-words">
          {linkifyText(body)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setDone((v) => !v)}
          className={`btn-primary text-sm px-4 py-2 ${done ? "bg-[var(--success)]" : ""}`}
        >
          {done ? "✓ Marked complete" : "Mark workout complete"}
        </button>
        <a href="/member/today" className="text-xs text-accent hover:underline">
          Back to program schedule →
        </a>
      </div>

      {done && (
        <p className="text-sm text-[var(--success)]">
          Nice work — you followed today&apos;s coach SMS workout. Reply DONE via text if your coach asked for it.
        </p>
      )}
    </div>
  );
}