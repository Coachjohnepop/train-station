"use client";

import { useCallback, useEffect, useState } from "react";
import MemberScoreProgressPanel from "@/components/MemberScoreProgress";
import { GAMIFICATION_POINTS, type LeaderboardPayload, type LeaderboardScope } from "@/lib/gamification-types";
import type { MemberScoreProgress } from "@/lib/gamification-types";

function rankLabel(rank: number): string {
  if (rank === 1) return "1ST";
  if (rank === 2) return "2ND";
  if (rank === 3) return "3RD";
  return `${rank}`.padStart(2, "0");
}

function rankTone(rank: number): string {
  if (rank === 1) return "text-amber-300";
  if (rank === 2) return "text-slate-200";
  if (rank === 3) return "text-orange-300/90";
  return "text-[var(--muted)]";
}

function LeaderboardRowView({
  row,
  highlight,
}: {
  row: LeaderboardPayload["rows"][number];
  highlight?: "self" | "podium";
}) {
  const podium = row.rank <= 3;
  return (
    <div
      className={`grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 rounded-lg border px-3 py-2.5 sm:grid-cols-[4rem_1fr_1fr_auto] ${
        highlight === "self"
          ? "border-[var(--accent)] bg-[var(--accent)]/12 shadow-[0_0_24px_rgba(139,92,246,0.15)]"
          : podium
            ? "border-amber-500/25 bg-amber-500/5"
            : "border-[var(--border)] bg-[var(--surface)]/70"
      }`}
    >
      <span className={`font-mono text-sm font-black tracking-wider ${rankTone(row.rank)}`}>
        {rankLabel(row.rank)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {row.displayName}
          {row.isSelf ? (
            <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-accent">
              You
            </span>
          ) : null}
        </p>
        {row.bestMove ? (
          <p className="truncate text-[10px] text-[var(--muted)] sm:hidden">{row.bestMove}</p>
        ) : null}
      </div>
      {row.bestMove ? (
        <p className="hidden truncate text-xs text-[var(--muted)] sm:block">{row.bestMove}</p>
      ) : (
        <span className="hidden sm:block" />
      )}
      <span className="font-mono text-lg font-black tabular-nums text-accent">
        {row.points.toLocaleString()}
      </span>
    </div>
  );
}

export default function MemberLeaderboard() {
  const [scope, setScope] = useState<LeaderboardScope>("program");
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [progress, setProgress] = useState<MemberScoreProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/member/gamification", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.progress) setProgress(json.progress);
      if (typeof json.totalPoints === "number" && data?.viewer) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                viewer: { ...prev.viewer, points: json.totalPoints },
              }
            : prev,
        );
      }
    } catch {
      /* ignore */
    }
  }, [data?.viewer]);

  const load = useCallback(async (nextScope: LeaderboardScope) => {
    setLoading(true);
    setError("");
    const [boardRes, scoreRes] = await Promise.all([
      fetch(`/api/member/leaderboard?scope=${nextScope}`, { cache: "no-store" }),
      fetch("/api/member/gamification", { cache: "no-store" }),
    ]);
    const json = await boardRes.json().catch(() => ({}));
    const scoreJson = await scoreRes.json().catch(() => ({}));
    if (!boardRes.ok) {
      setError(json.error || "Could not load leaderboard.");
      setData(null);
    } else {
      const totalPoints =
        typeof scoreJson.totalPoints === "number" ? scoreJson.totalPoints : json.viewer?.points;
      setData(
        totalPoints != null && json.viewer
          ? { ...json, viewer: { ...json.viewer, points: totalPoints } }
          : json,
      );
    }
    if (scoreJson.progress) setProgress(scoreJson.progress);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(scope);
  }, [scope, load]);

  useEffect(() => {
    function onScoreUpdated() {
      void loadProgress();
    }
    window.addEventListener("member-score-updated", onScoreUpdated);
    return () => window.removeEventListener("member-score-updated", onScoreUpdated);
  }, [loadProgress]);

  return (
    <div className="space-y-5">
      <div className="leaderboard-arcade-header relative overflow-hidden rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--surface-2)] via-[var(--surface)] to-[#1a1030] p-5 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-12deg, transparent, transparent 12px, rgba(139,92,246,0.08) 12px, rgba(139,92,246,0.08) 24px)",
          }}
        />
        <p className="relative text-[10px] font-bold uppercase tracking-[0.35em] text-accent">
          The Train Station
        </p>
        <h1 className="relative mt-1 font-mono text-3xl font-black uppercase tracking-[0.2em] text-white sm:text-4xl">
          High Scores
        </h1>
        <p className="relative mt-2 text-xs text-[var(--muted)]">
          K1-style standings — earn points for warm-ups, bookings, and logged workouts.
        </p>
      </div>

      {progress ? <MemberScoreProgressPanel progress={progress} /> : null}

      {data?.viewer ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Your rank
          </p>
          <LeaderboardRowView row={data.viewer} highlight="self" />
        </div>
      ) : null}

      <div className="flex rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1">
        <button
          type="button"
          onClick={() => setScope("program")}
          className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
            scope === "program" ? "nav-tab-active text-accent" : "text-[var(--muted)]"
          }`}
        >
          My program
        </button>
        <button
          type="button"
          onClick={() => setScope("site")}
          className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
            scope === "site" ? "nav-tab-active text-accent" : "text-[var(--muted)]"
          }`}
        >
          All station
        </button>
      </div>

      {scope === "program" && data?.programName ? (
        <p className="text-center text-xs text-[var(--muted)]">
          Racers in <span className="font-medium text-[var(--text)]">{data.programName}</span>
        </p>
      ) : null}

      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : data?.rows.length ? (
        <div className="space-y-2">
          <div className="hidden grid-cols-[4rem_1fr_1fr_auto] gap-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] sm:grid">
            <span>Rank</span>
            <span>Racer</span>
            <span>Best move</span>
            <span className="text-right">Pts</span>
          </div>
          {data.rows.map((row) => (
            <LeaderboardRowView key={row.userId} row={row} highlight={row.rank <= 3 ? "podium" : undefined} />
          ))}
        </div>
      ) : (
        <div className="card py-12 text-center text-sm text-[var(--muted)]">
          No scores yet — log a workout or finish your warm-ups to get on the board.
        </div>
      )}

      <details className="card p-3 text-xs text-[var(--muted)]">
        <summary className="cursor-pointer font-semibold text-accent">How to earn points</summary>
        <ul className="mt-2 space-y-1">
          <li>Warm-ups before live — {GAMIFICATION_POINTS.warmup_before_live} pts (once per day)</li>
          <li>Book intro call — {GAMIFICATION_POINTS.intake_scheduled} pts</li>
          <li>Log a workout — {GAMIFICATION_POINTS.workout_logged} pts</li>
          <li>Coach intake complete — {GAMIFICATION_POINTS.intake_complete} pts</li>
          <li>Finish account setup — {GAMIFICATION_POINTS.onboarding_complete} pts</li>
        </ul>
      </details>
    </div>
  );
}