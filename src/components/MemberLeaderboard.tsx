"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import MemberScoreProgressPanel from "@/components/MemberScoreProgress";
import {
  DEFAULT_GAMIFICATION_POINTS,
  type GamificationPointsMap,
  type LeaderboardPayload,
  type LeaderboardScope,
} from "@/lib/gamification-types";
import type { MemberScoreProgress } from "@/lib/gamification-types";
import { signupPlanLabel, type SignupPlan } from "@/lib/signup-plans";
import { formatApiErrorDetail } from "@/lib/api-errors";

type ScoresTab = "mine" | "high";
type BoardMode = "division" | "legacy";

type DivisionBoard = {
  division: string;
  divisionLabel: string;
  seasonKey: string;
  seasonDays: number;
  viewer: LeaderboardPayload["viewer"] & {
    percentile: number;
    topPercent: boolean;
    eligible: boolean;
    seasonPoints: number;
  };
  rows: Array<
    LeaderboardPayload["rows"][number] & {
      percentile: number;
      topPercent: boolean;
      eligible: boolean;
    }
  >;
  peek: {
    enabled: boolean;
    divisions: Array<{
      division: string;
      label: string;
      rows: Array<{ rank: number; displayName: string; points: number }>;
    }>;
  } | null;
  openPromo: { id: string; toPlan: string; claimBy: string | null } | null;
  activeTrial: { plan: string; trialEndsAt: string } | null;
  updatedAt: string;
};

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

function ScoresTabBar({
  active,
  onChange,
}: {
  active: ScoresTab;
  onChange: (tab: ScoresTab) => void;
}) {
  return (
    <div className="flex rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1">
      <button
        type="button"
        onClick={() => onChange("mine")}
        className={`flex-1 rounded-full px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
          active === "mine" ? "nav-tab-active text-accent" : "text-[var(--muted)]"
        }`}
      >
        My scores
      </button>
      <button
        type="button"
        onClick={() => onChange("high")}
        className={`flex-1 rounded-full px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
          active === "high" ? "nav-tab-active text-accent" : "text-[var(--muted)]"
        }`}
      >
        High scores
      </button>
    </div>
  );
}

export default function MemberLeaderboard() {
  const [scoresTab, setScoresTab] = useState<ScoresTab>("mine");
  const [boardMode, setBoardMode] = useState<BoardMode>("division");
  const [scope, setScope] = useState<LeaderboardScope>("program");
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [division, setDivision] = useState<DivisionBoard | null>(null);
  const [progress, setProgress] = useState<MemberScoreProgress | null>(null);
  const [pointValues, setPointValues] = useState<GamificationPointsMap>(DEFAULT_GAMIFICATION_POINTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [hall, setHall] = useState<
    Array<{ id: string; userId: string; label: string; freeDays: number | null; awardedAt: string }>
  >([]);

  const loadProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/member/gamification", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.progress) setProgress(json.progress);
      if (json.pointValues) setPointValues(json.pointValues);
    } catch {
      /* ignore */
    }
  }, []);

  const loadDivision = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError("");
    }
    const [boardRes, scoreRes, prizeRes] = await Promise.all([
      fetch("/api/member/gamification/division", { cache: "no-store" }),
      fetch("/api/member/gamification", { cache: "no-store" }),
      fetch("/api/member/gamification/prizes", { cache: "no-store" }),
    ]);
    const json = await boardRes.json().catch(() => ({}));
    const scoreJson = await scoreRes.json().catch(() => ({}));
    const prizeJson = await prizeRes.json().catch(() => ({}));
    if (!boardRes.ok) {
      if (!opts?.silent) {
        setError(
          typeof json.error === "string"
            ? json.error
            : formatApiErrorDetail(json.detail) || "Could not load division board.",
        );
      }
      setDivision(null);
    } else {
      setDivision(json as DivisionBoard);
    }
    if (scoreJson.progress) setProgress(scoreJson.progress);
    if (scoreJson.pointValues) setPointValues(scoreJson.pointValues);
    if (Array.isArray(prizeJson.hall)) setHall(prizeJson.hall);
    if (!opts?.silent) setLoading(false);
  }, []);

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
    if (scoreJson.pointValues) setPointValues(scoreJson.pointValues);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (scoresTab === "high" && boardMode === "division") {
      void loadDivision();
    } else if (scoresTab === "high") {
      void load(scope);
    } else {
      // My scores: progress + promo/rank strip without full-board loading spinner
      void loadProgress();
      void loadDivision({ silent: true });
    }
  }, [scoresTab, boardMode, scope, load, loadDivision, loadProgress]);

  useEffect(() => {
    function onScoreUpdated() {
      void loadProgress();
      if (boardMode === "division" || scoresTab === "mine") {
        void loadDivision({ silent: true });
      }
    }
    window.addEventListener("member-score-updated", onScoreUpdated);
    return () => window.removeEventListener("member-score-updated", onScoreUpdated);
  }, [loadProgress, loadDivision, boardMode, scoresTab]);

  async function claimPromo(id: string) {
    setClaimBusy(true);
    setError("");
    setClaimMsg(null);
    try {
      const res = await fetch(`/api/member/gamification/promos/${encodeURIComponent(id)}/claim`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          formatApiErrorDetail(json.detail) ||
            (typeof json.error === "string" ? json.error : "Could not claim"),
        );
      }
      const plan = json.promo?.toPlan
        ? signupPlanLabel(json.promo.toPlan as SignupPlan)
        : "the next class";
      setClaimMsg(`Free week of ${plan} unlocked. Enjoy — then keep it at checkout.`);
      await loadDivision({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaimBusy(false);
    }
  }

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
          {scoresTab === "mine" ? "My Scores" : "High Scores"}
        </h1>
        <p className="relative mt-2 text-xs text-[var(--muted)]">
          {scoresTab === "mine"
            ? "Your points, milestones, and what’s still on your ramp."
            : "K1-style standings — see how you stack up against other racers."}
        </p>
      </div>

      <ScoresTabBar active={scoresTab} onChange={setScoresTab} />

      {claimMsg ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {claimMsg}
        </p>
      ) : null}

      {scoresTab === "mine" ? (
        <div className="space-y-5">
          {progress ? (
            <MemberScoreProgressPanel progress={progress} />
          ) : (
            <div className="card h-32 animate-pulse" />
          )}

          {division?.viewer ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                Your {division.divisionLabel} rank · {division.seasonDays}d season
              </p>
              <LeaderboardRowView
                row={{
                  rank: division.viewer.rank,
                  userId: division.viewer.userId,
                  displayName: division.viewer.displayName,
                  points: division.viewer.seasonPoints,
                  bestMove: division.viewer.bestMove,
                  isSelf: true,
                }}
                highlight="self"
              />
              {division.viewer.topPercent ? (
                <p className="text-xs font-semibold text-amber-300">
                  Top band — you&apos;re in the free-week / upstairs zone.
                </p>
              ) : null}
            </div>
          ) : data?.viewer ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                Your rank
              </p>
              <LeaderboardRowView row={data.viewer} highlight="self" />
            </div>
          ) : null}

          {division?.openPromo ? (
            <div className="card space-y-2 border-amber-500/40 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-100">
                Free week of {signupPlanLabel(division.openPromo.toPlan as SignupPlan)} unlocked
              </p>
              <p className="text-xs text-[var(--muted)]">
                You&apos;re crushing your division. Claim a sample of the next class
                {division.openPromo.claimBy
                  ? ` before ${new Date(division.openPromo.claimBy).toLocaleString()}`
                  : ""}
                .
              </p>
              <button
                type="button"
                className="btn-primary"
                disabled={claimBusy}
                onClick={() => void claimPromo(division.openPromo!.id)}
              >
                Claim free week
              </button>
            </div>
          ) : null}

          {division?.activeTrial ? (
            <div className="card border-accent/40 bg-accent/10 p-3 text-sm">
              Trial:{" "}
              <span className="font-semibold">
                {signupPlanLabel(division.activeTrial.plan as SignupPlan)}
              </span>{" "}
              until {new Date(division.activeTrial.trialEndsAt).toLocaleString()}.{" "}
              <Link href="/member/account" className="font-semibold text-accent underline">
                Keep it → checkout
              </Link>
            </div>
          ) : null}

          <details className="card p-3 text-xs text-[var(--muted)]">
            <summary className="cursor-pointer font-semibold text-accent">How to earn points</summary>
            <ul className="mt-2 space-y-1">
              <li>Warm-ups before live — {pointValues.warmup_before_live} pts (once per day)</li>
              <li>Book intro call — {pointValues.intake_scheduled} pts</li>
              <li>Log a workout — {pointValues.workout_logged} pts</li>
              <li>Coach intake complete — {pointValues.intake_complete} pts</li>
              <li>Finish account setup — {pointValues.onboarding_complete} pts</li>
            </ul>
          </details>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1">
            <button
              type="button"
              onClick={() => setBoardMode("division")}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                boardMode === "division" ? "nav-tab-active text-accent" : "text-[var(--muted)]"
              }`}
            >
              My division
            </button>
            <button
              type="button"
              onClick={() => setBoardMode("legacy")}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                boardMode === "legacy" ? "nav-tab-active text-accent" : "text-[var(--muted)]"
              }`}
            >
              Program / station
            </button>
          </div>

          {boardMode === "legacy" ? (
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
          ) : null}

          {boardMode === "division" && division ? (
            <p className="text-center text-xs text-[var(--muted)]">
              <span className="font-medium text-[var(--text)]">{division.divisionLabel}</span>
              {" · "}
              {division.seasonDays}-day season ({division.seasonKey})
            </p>
          ) : null}

          {boardMode === "legacy" && scope === "program" && data?.programName ? (
            <p className="text-center text-xs text-[var(--muted)]">
              Racers in <span className="font-medium text-[var(--text)]">{data.programName}</span>
            </p>
          ) : null}

          {boardMode === "division" && division?.viewer ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                You on the board
                {division.viewer.topPercent ? " · TOP BAND" : ""}
              </p>
              <LeaderboardRowView
                row={{
                  rank: division.viewer.rank,
                  userId: division.viewer.userId,
                  displayName: division.viewer.displayName,
                  points: division.viewer.seasonPoints,
                  bestMove: division.viewer.bestMove,
                  isSelf: true,
                }}
                highlight="self"
              />
            </div>
          ) : null}

          {boardMode === "legacy" && data?.viewer ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                You on the board
              </p>
              <LeaderboardRowView row={data.viewer} highlight="self" />
            </div>
          ) : null}

          {boardMode === "division" && division?.openPromo ? (
            <div className="card space-y-2 border-amber-500/40 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-100">
                Free week of {signupPlanLabel(division.openPromo.toPlan as SignupPlan)}
              </p>
              <button
                type="button"
                className="btn-primary"
                disabled={claimBusy}
                onClick={() => void claimPromo(division.openPromo!.id)}
              >
                Claim free week
              </button>
            </div>
          ) : null}

          {hall.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
                Hall of Fame
              </p>
              <ul className="space-y-1 text-sm">
                {hall.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="font-semibold text-amber-100">{p.label}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {p.freeDays ? `${p.freeDays}d free · ` : ""}
                      {new Date(p.awardedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {boardMode === "division" && division?.peek?.enabled ? (
            <div className="space-y-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-300">
                Upstairs peek — how Business & 1st Class stack
              </p>
              {division.peek.divisions.map((d) => (
                <div key={d.division} className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--text)]">{d.label}</p>
                  {d.rows.slice(0, 5).map((r) => (
                    <div
                      key={`${d.division}-${r.rank}`}
                      className="flex justify-between text-xs text-[var(--muted)]"
                    >
                      <span>
                        #{r.rank} {r.displayName}
                      </span>
                      <span className="font-mono text-accent">{r.points.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {error ? <p className="text-sm text-amber-300">{error}</p> : null}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--surface-2)]" />
              ))}
            </div>
          ) : boardMode === "division" && division?.rows.length ? (
            <div className="space-y-2">
              {division.rows.map((row) => (
                <LeaderboardRowView
                  key={row.userId}
                  row={row}
                  highlight={row.isSelf ? "self" : row.rank <= 3 ? "podium" : undefined}
                />
              ))}
            </div>
          ) : boardMode === "legacy" && data?.rows.length ? (
            <div className="space-y-2">
              <div className="hidden grid-cols-[4rem_1fr_1fr_auto] gap-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] sm:grid">
                <span>Rank</span>
                <span>Racer</span>
                <span>Best move</span>
                <span className="text-right">Pts</span>
              </div>
              {data.rows.map((row) => (
                <LeaderboardRowView
                  key={row.userId}
                  row={row}
                  highlight={row.rank <= 3 ? "podium" : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="card py-12 text-center text-sm text-[var(--muted)]">
              No scores yet — log a workout or finish your warm-ups to get on the board.
            </div>
          )}
        </div>
      )}
    </div>
  );
}