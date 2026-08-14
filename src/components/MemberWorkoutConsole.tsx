"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  approachLabel,
  formatPastPerformance,
  formatPrescriptionSummary,
  isTimedApproach,
  normalizePrescription,
  weightTierLabel,
} from "@/lib/workout-schemes";
import MemberExerciseVideoModal from "@/components/MemberExerciseVideoModal";
import { GAMIFICATION_POINTS } from "@/lib/gamification-types";
import { dispatchMemberScoreCelebrate } from "@/lib/member-score-celebrate";
import WorkoutRestTimer from "@/components/WorkoutRestTimer";
import {
  playRestComplete,
  playRestStart,
  playRestTick,
  playSetCheckPop,
  preloadRestCompleteSound,
  unlockRestAudio,
} from "@/lib/rest-audio";
import {
  DEFAULT_REST_TIMER_SECONDS,
  REST_TIMER_PRESETS,
  normalizeRestTimerSeconds,
} from "@/lib/rest-timer";
import {
  DEFAULT_REST_TIMER_SOUND,
  normalizeRestTimerSound,
  type RestTimerSoundKey,
} from "@/lib/rest-timer-sound";
import CoachRestSoundLibrary from "@/components/CoachRestSoundLibrary";
import { confettiOriginFromElement, fireWorkoutConfetti } from "@/lib/workout-confetti";
import type { LiveRestActive } from "@/lib/live-workout-session";
import {
  clearMaintainResume,
  writeMaintainResume,
} from "@/lib/member-maintain-resume";
import FreeUpgradeTease from "@/components/FreeUpgradeTease";
import FreePostWorkoutTicketShelf from "@/components/FreePostWorkoutTicketShelf";
import {
  FREE_PREVIEW_EXERCISES,
  freePreviewOpenCount,
  isFreeExplorerPlan,
  isFreePreviewExerciseLocked,
} from "@/lib/free-tier-product";
import {
  progressCacheHasWork,
  readMemberWorkoutProgressCache,
  writeMemberWorkoutProgressCache,
} from "@/lib/member-workout-progress-cache";

export type MemberExerciseBlock = {
  id: string;
  exerciseId: string;
  name: string;
  description: string | null;
  /** Coach note on this workout line only (today's cue). */
  coachNotes?: string | null;
  /** Global library description for the exercise. */
  libraryDescription?: string | null;
  videoUrl: string | null;
  setScheme: string;
  repPattern: string | null;
  reps: string | null;
  setCount: number;
  weightTier: string;
  /** Rest between sets (seconds) from coach prescription — drives v1 rest clock. */
  restSec?: number | null;
  past: {
    setScheme: string;
    repPattern: string | null;
    reps: string | null;
    sets: number | null;
    setsCompleted?: number | null;
    weightTier: string;
    startingWeightLbs: number | null;
    performedAt: string;
  } | null;
};

export type MemberWorkoutView = {
  workoutId: string;
  workoutName: string;
  memberName: string;
  exercises: MemberExerciseBlock[];
  /** Legacy workout-level rest timer (fallback if exercise has no restSec). */
  restTimerEnabled?: boolean;
  restTimerSeconds?: number;
  /** End-of-rest sample: whistle | bell | buzzer | cybertruck */
  restTimerSound?: string;
};

const REST_MUTE_KEY = "ts-rest-timer-mute";

type ActiveRestTimer = {
  blockId: string;
  completedSetNum: number;
  endsAt: number;
  totalSeconds: number;
  /** exercise = green hold; rest = between-sets rest */
  phase: "exercise" | "rest";
};

/** Parse hold duration from prescription text: "45s", "90 sec", "2 min", "1:30". */
function parseDurationSecondsFromReps(reps: string | null | undefined): number | null {
  if (!reps?.trim()) return null;
  const raw = reps.trim().toLowerCase();
  const mmss = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (mmss) {
    const total = Number(mmss[1]) * 60 + Number(mmss[2]);
    if (Number.isFinite(total) && total >= 5 && total <= 1800) return total;
  }
  const min = raw.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)\b/);
  if (min) {
    const n = Number(min[1]);
    if (Number.isFinite(n) && n > 0 && n <= 30) return Math.round(n * 60);
  }
  // Explicit seconds only — bare "10" stays as rep count, not a hold.
  const sec = raw.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds)\b/);
  if (sec) {
    const n = Number(sec[1]);
    if (Number.isFinite(n) && n >= 5 && n <= 1800) return Math.round(n);
  }
  return null;
}

/**
 * Green "Time of Exercise" duration:
 * 1) reps like "45s" / "2 min" (maintain holds, timed cues)
 * 2) timed approach setCount as minutes (1–4)
 */
function exerciseHoldDurationSec(block: MemberExerciseBlock): number | null {
  const fromReps = parseDurationSecondsFromReps(block.reps);
  if (fromReps != null) return fromReps;
  if (!isTimedApproach(block.setScheme)) return null;
  const mins = Number(block.setCount);
  if (!Number.isFinite(mins) || mins < 1) return null;
  return Math.min(30, Math.max(1, Math.round(mins))) * 60;
}

function sortedSet(nums: number[]): number[] {
  return nums.slice().sort((a, b) => a - b);
}

function completedSetsEqual(
  local: Record<string, Set<number>>,
  remote: Record<string, number[]>,
): boolean {
  const localKeys = Object.keys(local);
  const remoteKeys = Object.keys(remote);
  if (localKeys.length !== remoteKeys.length) return false;
  for (const key of localKeys) {
    const a = sortedSet(Array.from(local[key] ?? []));
    const b = sortedSet(remote[key] ?? []);
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Prefer last logged weight for this exercise (any prior session).
 * First time on the movement → light/medium/heavy tier guess so coach/member
 * aren't staring at a blank box.
 */
function suggestedWeightLbs(block: MemberExerciseBlock): number | null {
  const past = block.past?.startingWeightLbs;
  if (past != null && Number.isFinite(past) && past > 0) {
    return past;
  }
  const tier = (block.weightTier || "").toLowerCase().trim();
  if (tier === "light") return 15;
  if (tier === "medium") return 25;
  if (tier === "heavy") return 45;
  return null;
}

/** True when value is last-session log (not tier guess). */
function hasLoggedPastWeight(block: MemberExerciseBlock): boolean {
  const past = block.past?.startingWeightLbs;
  return past != null && Number.isFinite(past) && past > 0;
}

function buildSeededWeights(
  exercises: MemberExerciseBlock[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of exercises) {
    const lbs = suggestedWeightLbs(block);
    if (lbs != null) out[block.id] = String(lbs);
  }
  return out;
}

/** Merge: non-empty remote wins; otherwise keep local; then seed blanks. */
function mergeWeightsWithSeeds(
  exercises: MemberExerciseBlock[],
  local: Record<string, string>,
  remote?: Record<string, string> | null,
): Record<string, string> {
  const seeds = buildSeededWeights(exercises);
  const next: Record<string, string> = { ...seeds };
  for (const [k, v] of Object.entries(local)) {
    if (typeof v === "string" && v.trim() !== "") next[k] = v;
  }
  if (remote) {
    for (const [k, v] of Object.entries(remote)) {
      if (typeof v === "string" && v.trim() !== "") next[k] = v;
    }
  }
  return next;
}

function finishedExercisesEqual(local: Set<string>, remote: string[]): boolean {
  if (local.size !== remote.length) return false;
  for (const id of remote) if (!local.has(id)) return false;
  return true;
}

export default function MemberWorkoutConsole({
  workout,
  backHref = "/member",
  backLabel = "← Dashboard",
  programSlug,
  targetUserId,
  instructorName,
  reviewMode = false,
  calendarDateLabel,
  scheduleLabel,
  liveSyncUserId,
  liveSessionDate,
  progressMode = "live",
  hideLogButton = false,
  headerNote,
  embedded = false,
  coachFloorMode = false,
  onCoachFloorFinished,
  /** Maintain: notify parent/stage when member starts (weight / set / finish). */
  onEngage,
  membershipPlan = null,
}: {
  workout: MemberWorkoutView;
  backHref?: string;
  backLabel?: string;
  programSlug?: string;
  targetUserId?: string;
  instructorName?: string;
  reviewMode?: boolean;
  /** e.g. "Tuesday, June 23, 2026" */
  calendarDateLabel?: string;
  /** e.g. "Week 1 · Tue" */
  scheduleLabel?: string;
  /** Member id for live coach ↔ member checkoff sync */
  liveSyncUserId?: string;
  liveSessionDate?: string;
  /** Persist checkoffs to warmup-progress API (pre-intake warm-ups). */
  progressMode?: "live" | "warmup";
  hideLogButton?: boolean;
  headerNote?: string;
  /** Hide title block when nested inside warm-up day navigator */
  embedded?: boolean;
  /** Coach live floor: exercise names + set buttons only (live sync to member). */
  coachFloorMode?: boolean;
  /** Called after coach taps Finished on live floor (collapse tile, etc.). */
  onCoachFloorFinished?: () => void;
  /** First real training action this session (maintain fullscreen auto-enter). */
  onEngage?: () => void;
  /** Membership plan for Free Explorer soft limits (preview sets + ticket shelf). */
  membershipPlan?: string | null;
}) {
  const engageOnceRef = useRef(false);
  const isMaintainSession = programSlug === "maintain";
  const freeExplorer = isFreeExplorerPlan(membershipPlan) && !coachFloorMode && !reviewMode;
  const freeOpenCount = freePreviewOpenCount(workout.exercises.length);
  const freeLockedExerciseIds = new Set(
    freeExplorer
      ? workout.exercises
          .map((ex, i) => (isFreePreviewExerciseLocked(i, membershipPlan) ? ex.id : null))
          .filter((id): id is string => Boolean(id))
      : [],
  );
  const markMaintainResume = useCallback(() => {
    if (!isMaintainSession || reviewMode) return;
    const uid = liveSyncUserId || targetUserId;
    if (!uid) return;
    const sessionDate =
      liveSessionDate ||
      (() => {
        try {
          return new Date().toLocaleDateString("en-CA");
        } catch {
          return new Date().toISOString().slice(0, 10);
        }
      })();
    writeMaintainResume({
      userId: uid,
      workoutId: workout.workoutId,
      workoutName: workout.workoutName || "Quick maintain",
      sessionDate,
      updatedAt: new Date().toISOString(),
    });
  }, [
    isMaintainSession,
    reviewMode,
    liveSyncUserId,
    targetUserId,
    liveSessionDate,
    workout.workoutId,
    workout.workoutName,
  ]);
  const fireEngage = useCallback(() => {
    markMaintainResume();
    if (engageOnceRef.current) return;
    engageOnceRef.current = true;
    onEngage?.();
  }, [onEngage, markMaintainResume]);

  // Remember open maintain session immediately so "Back to workout" appears if they leave.
  useEffect(() => {
    if (isMaintainSession && !reviewMode) markMaintainResume();
  }, [isMaintainSession, reviewMode, markMaintainResume]);
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    buildSeededWeights(workout.exercises),
  );
  const [activeId, setActiveId] = useState(workout.exercises[0]?.id ?? "");
  const [completedSets, setCompletedSets] = useState<Record<string, Set<number>>>(
    {},
  );
  const [finishedExercises, setFinishedExercises] = useState<Set<string>>(
    new Set(),
  );
  const [videoModalBlockId, setVideoModalBlockId] = useState<string | null>(
    null,
  );
  const [isLogging, setIsLogging] = useState(false);
  const [logResult, setLogResult] = useState<null | { performedAt: string; count: number; progress?: number }>(null);
  const [finishedListExpanded, setFinishedListExpanded] = useState(false);
  const [coachLive, setCoachLive] = useState(false);
  const [partnerLive, setPartnerLive] = useState(false);
  const [loggedDetailsOpen, setLoggedDetailsOpen] = useState(false);
  const [restTimer, setRestTimer] = useState<ActiveRestTimer | null>(null);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restMuted, setRestMuted] = useState(false);
  /** True while buzzer plays and popup is about to auto-close. */
  const [restCompleting, setRestCompleting] = useState(false);
  /** Session override so coach can set rest on the floor without rebuilding the workout. */
  const [sessionRestEnabled, setSessionRestEnabled] = useState(true);
  const [sessionRestSeconds, setSessionRestSeconds] = useState(DEFAULT_REST_TIMER_SECONDS);
  const [sessionRestSound, setSessionRestSound] = useState<RestTimerSoundKey>(DEFAULT_REST_TIMER_SOUND);
  const restSoundRef = useRef<RestTimerSoundKey>(DEFAULT_REST_TIMER_SOUND);
  const [restSettingsSaving, setRestSettingsSaving] = useState(false);
  const [coachExpandedBlockId, setCoachExpandedBlockId] = useState<string | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const restHornPlayedRef = useRef(false);
  const restTickAnnouncedRef = useRef<Set<number>>(new Set());
  /** Tracks open timer identity so duration retargets don't re-fire start/tick/complete storms. */
  const restTimerIdentityRef = useRef<string>("");
  const restMutedRef = useRef(restMuted);
  restMutedRef.current = restMuted;
  const prevCompletedSetsRef = useRef<Record<string, Set<number>> | null>(null);
  /** When true, next completedSets change came from live partner (coach↔member). */
  const pendingRemoteRestRef = useRef(false);
  /** Skip rest on first remote snapshot (history), only fire on live checkoffs after that. */
  const liveRestBaselineReadyRef = useRef(false);
  const canCoachRestSettings = Boolean(instructorName || coachFloorMode);

  useEffect(() => {
    // Coach floor stays muted unless they tap Unmute (same-room double-horn fix).
    if (coachFloorMode) {
      setRestMuted(true);
      restMutedRef.current = true;
      return;
    }
    try {
      const muted = localStorage.getItem(REST_MUTE_KEY) === "1";
      setRestMuted(muted);
      restMutedRef.current = muted;
    } catch {
      /* ignore */
    }
  }, [coachFloorMode]);

  // iOS/Safari: rest-end is timer-driven (no gesture). Unlock WebAudio + HTMLAudio
  // on first member touch so Stephanie's phone can play when rest hits 0.
  useEffect(() => {
    if (coachFloorMode || typeof window === "undefined") return;
    const unlock = () => unlockRestAudio(restSoundRef.current);
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [coachFloorMode]);

  // Seed rest settings from workout prescription (coach can change mid-session).
  useEffect(() => {
    const fromWorkout =
      workout.restTimerEnabled && typeof workout.restTimerSeconds === "number"
        ? normalizeRestTimerSeconds(workout.restTimerSeconds)
        : null;
    const firstExerciseRest = workout.exercises.find(
      (e) => typeof e.restSec === "number" && e.restSec > 0,
    )?.restSec;
    const seeded =
      fromWorkout ??
      (typeof firstExerciseRest === "number"
        ? normalizeRestTimerSeconds(firstExerciseRest)
        : DEFAULT_REST_TIMER_SECONDS);
    setSessionRestSeconds(seeded);
    // Live floor defaults rest ON so set checkoffs always spin a timer unless coach turns it off.
    const enabled = workout.restTimerEnabled !== false;
    setSessionRestEnabled(enabled);
    // Maintain always defaults to Cybertruck; null workout sound → cybertruck.
    const sound = normalizeRestTimerSound(
      programSlug === "maintain"
        ? workout.restTimerSound || DEFAULT_REST_TIMER_SOUND
        : workout.restTimerSound,
    );
    setSessionRestSound(sound);
    restSoundRef.current = sound;
    restSettingsRef.current = {
      enabled,
      seconds: seeded,
      sound,
    };
    preloadRestCompleteSound(sound);
  }, [
    workout.workoutId,
    workout.restTimerEnabled,
    workout.restTimerSeconds,
    workout.restTimerSound,
    workout.exercises,
    programSlug,
  ]);

  useEffect(() => {
    restSoundRef.current = sessionRestSound;
    preloadRestCompleteSound(sessionRestSound);
  }, [sessionRestSound]);

  useEffect(() => {
    restSettingsRef.current = {
      enabled: sessionRestEnabled,
      seconds: sessionRestSeconds,
      sound: sessionRestSound,
    };
  }, [sessionRestEnabled, sessionRestSeconds, sessionRestSound]);

  const toggleRestMute = useCallback(() => {
    setRestMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(REST_MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      // Unmute is a gesture — prime audio so the next rest-end isn't blocked.
      if (!next) unlockRestAudio(restSoundRef.current);
      return next;
    });
  }, []);

  // Keep coach + member nearly in lockstep (SSE hot path + very fast poll across instances).
  const LIVE_POLL_MS = 150;
  // Warmup used a blob store; checkoffs still belong in LiveWorkoutSession (Postgres).
  const liveSessionScope = !!liveSyncUserId && !reviewMode;
  const warmupSyncEnabled = progressMode === "warmup" && !!liveSyncUserId && !reviewMode;
  const [liveSessionHydrated, setLiveSessionHydrated] = useState(false);
  /** Wait for first remote snapshot so we don't overwrite partner history with empty local state. */
  const livePushEnabled = liveSessionScope && liveSessionHydrated;
  const pendingImmediatePushRef = useRef(false);
  const restSettingsRef = useRef({
    enabled: true,
    seconds: DEFAULT_REST_TIMER_SECONDS,
    sound: DEFAULT_REST_TIMER_SOUND as RestTimerSoundKey,
  });
  /** Shared rest popup (epoch endsAt) — pushed so partner spins up the same timer. */
  const restActiveRef = useRef<LiveRestActive | null>(null);
  /** Only push restActive when we start/clear it — never wipe partner rest with accidental null. */
  const restActiveDirtyRef = useRef(false);
  /** After skip, force restActive:null on next push even if something re-seeded the ref. */
  const pendingForceClearRestRef = useRef(false);
  const lastAppliedRestEndsAt = useRef(0);
  /** After intentional uncheck, block remote re-check / auto-timer for a short window. */
  const suppressAutoRestUntilRef = useRef(0);
  const lastAppliedRevision = useRef(0);
  const lastAppliedRemoteAt = useRef<string | null>(null);
  const applyingRemote = useRef(false);
  /** After applying a remote snapshot, skip the auto-push effect so we don't echo stale local. */
  const skipAutoPushAfterRemote = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChain = useRef(Promise.resolve());
  const lastPushedRevision = useRef(0);
  const stateRef = useRef({
    completedSets,
    finishedExercises,
    weights,
    activeId,
  });

  const serializeCompletedSets = useCallback(
    (sets: Record<string, Set<number>>) => {
      const out: Record<string, number[]> = {};
      for (const [blockId, nums] of Object.entries(sets)) {
        out[blockId] = Array.from(nums).sort((a, b) => a - b);
      }
      return out;
    },
    [],
  );

  const persistProgressCache = useCallback(
    (snap?: {
      completedSets: Record<string, Set<number>>;
      finishedExercises: Set<string>;
      weights: Record<string, string>;
      activeId: string;
    }) => {
      if (!liveSyncUserId || reviewMode) return;
      const s = snap ?? stateRef.current;
      writeMemberWorkoutProgressCache({
        userId: liveSyncUserId,
        workoutId: workout.workoutId,
        sessionDate: liveSessionDate,
        completedSets: serializeCompletedSets(s.completedSets),
        finishedExercises: Array.from(s.finishedExercises),
        weights: s.weights,
        activeId: s.activeId,
      });
    },
    [liveSyncUserId, reviewMode, workout.workoutId, liveSessionDate, serializeCompletedSets],
  );

  useEffect(() => {
    stateRef.current = { completedSets, finishedExercises, weights, activeId };
  }, [completedSets, finishedExercises, weights, activeId]);

  const applyRemoteRestActive = useCallback((rest: LiveRestActive | null | undefined) => {
    if (rest === undefined) return;
    if (rest === null) {
      // Partner closed shared rest. If countdown was already done / nearly done and we
      // never got our local finishAndClose (clock skew / coach clear after end), horn once.
      const prev = restActiveRef.current;
      if (
        prev &&
        !restHornPlayedRef.current &&
        !restMutedRef.current &&
        prev.endsAt <= Date.now() + 2500
      ) {
        restHornPlayedRef.current = true;
        playRestComplete(restSoundRef.current, { force: true });
      }
      lastAppliedRestEndsAt.current = 0;
      restActiveRef.current = null;
      setRestTimer(null);
      setRestSecondsLeft(0);
      setRestCompleting(false);
      return;
    }
    // Ignore fully expired rest windows.
    if (rest.endsAt <= Date.now() + 250) return;
    // Don't resurrect a timer right after intentional uncheck/skip.
    if (Date.now() < suppressAutoRestUntilRef.current) return;

    const prev = restActiveRef.current;
    const same =
      prev &&
      prev.blockId === rest.blockId &&
      prev.completedSetNum === rest.completedSetNum &&
      prev.endsAt === rest.endsAt &&
      prev.totalSeconds === rest.totalSeconds &&
      (prev.phase ?? "rest") === (rest.phase ?? "rest");
    if (same) return;

    // Allow coach to shorten OR lengthen mid-countdown (old code rejected shorter endsAt).
    const isRetarget =
      Boolean(prev) &&
      prev!.blockId === rest.blockId &&
      prev!.completedSetNum === rest.completedSetNum;

    lastAppliedRestEndsAt.current = rest.endsAt;
    restActiveRef.current = rest;
    const left = Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000));
    const phase = rest.phase === "exercise" ? "exercise" : "rest";
    setRestCompleting(false);
    setRestSecondsLeft(left);
    setRestTimer({
      blockId: rest.blockId,
      completedSetNum: rest.completedSetNum,
      endsAt: rest.endsAt,
      totalSeconds: rest.totalSeconds,
      phase,
    });
    // New timer only: reset sound guards. Retarget keeps them so we don't blast.
    if (!isRetarget) {
      restTimerIdentityRef.current = `${rest.blockId}:${rest.completedSetNum}:${phase}`;
      restTickAnnouncedRef.current = new Set();
      restHornPlayedRef.current = false;
      if (!restMutedRef.current) {
        playRestStart();
      }
    }
  }, []);

  const applyRemoteSession = useCallback(
    (session: {
      completedSets: Record<string, number[]>;
      finishedExercises: string[];
      weights?: Record<string, string>;
      activeId?: string;
      restTimerEnabled?: boolean;
      restTimerSeconds?: number;
      restTimerSound?: string;
      restActive?: LiveRestActive | null;
      updatedBy: "coach" | "member";
      revision?: number;
      updatedAt?: string;
    }) => {
      if (typeof session.revision === "number") {
        if (session.revision < lastAppliedRevision.current) {
          // Older than what we already applied — ignore.
          return;
        }
        if (session.revision === lastAppliedRevision.current) {
          // Same revision: still allow rest popup / rest-timer field refresh from coach.
          if ("restActive" in session) {
            applyRemoteRestActive(session.restActive);
          }
          if (session.updatedBy === "coach") {
            if (typeof session.restTimerEnabled === "boolean") {
              setSessionRestEnabled(session.restTimerEnabled);
              restSettingsRef.current = {
                ...restSettingsRef.current,
                enabled: session.restTimerEnabled,
              };
            }
            if (typeof session.restTimerSeconds === "number" && session.restTimerSeconds > 0) {
              const secs = normalizeRestTimerSeconds(session.restTimerSeconds);
              setSessionRestSeconds(secs);
              restSettingsRef.current = { ...restSettingsRef.current, seconds: secs };
            }
            if (session.weights) {
              const merged = mergeWeightsWithSeeds(
                workout.exercises,
                session.weights,
                session.weights,
              );
              setWeights(merged);
              stateRef.current = { ...stateRef.current, weights: merged };
            }
          }
          return;
        }
        lastAppliedRevision.current = session.revision;
      } else if (session.updatedAt) {
        if (
          lastAppliedRemoteAt.current &&
          session.updatedAt <= lastAppliedRemoteAt.current
        ) {
          return;
        }
        lastAppliedRemoteAt.current = session.updatedAt;
      } else {
        return;
      }

      // Always apply coach rest controls so member matches floor mid-session.
      if (typeof session.restTimerEnabled === "boolean") {
        setSessionRestEnabled(session.restTimerEnabled);
        restSettingsRef.current = {
          ...restSettingsRef.current,
          enabled: session.restTimerEnabled,
        };
      }
      if (typeof session.restTimerSeconds === "number" && session.restTimerSeconds > 0) {
        const secs = normalizeRestTimerSeconds(session.restTimerSeconds);
        setSessionRestSeconds(secs);
        restSettingsRef.current = { ...restSettingsRef.current, seconds: secs };
      }
      // Coach floor may push a chosen sound; members keep workout/default (Cybertruck).
      // Old live rows often still say "whistle" from the previous default — don't clobber.
      if (
        canCoachRestSettings &&
        typeof session.restTimerSound === "string" &&
        session.restTimerSound
      ) {
        const sound = normalizeRestTimerSound(session.restTimerSound);
        setSessionRestSound(sound);
        restSoundRef.current = sound;
        restSettingsRef.current = { ...restSettingsRef.current, sound };
        preloadRestCompleteSound(sound);
      } else if (programSlug === "maintain" || !session.restTimerSound) {
        const sound = normalizeRestTimerSound(
          workout.restTimerSound ?? DEFAULT_REST_TIMER_SOUND,
        );
        setSessionRestSound(sound);
        restSoundRef.current = sound;
        restSettingsRef.current = { ...restSettingsRef.current, sound };
        preloadRestCompleteSound(sound);
      }

      const localSnap = stateRef.current;
      const localSetCount = Object.values(localSnap.completedSets).reduce(
        (n, set) => n + set.size,
        0,
      );
      const remoteSetCount = Object.values(session.completedSets || {}).reduce(
        (n, nums) => n + (Array.isArray(nums) ? nums.length : 0),
        0,
      );
      const localHasWork =
        localSetCount > 0 || localSnap.finishedExercises.size > 0;
      const remoteEmpty = remoteSetCount === 0 && session.finishedExercises.length === 0;
      // Don't let an empty first GET wipe sets the member already checked (or restored).
      if (localHasWork && remoteEmpty && session.updatedBy !== "coach") {
        skipAutoPushAfterRemote.current = false;
        pendingImmediatePushRef.current = true;
        return;
      }
      const sets: Record<string, Set<number>> = {};
      for (const [blockId, nums] of Object.entries(session.completedSets)) {
        sets[blockId] = new Set(nums);
      }
      const remoteFinished = new Set(session.finishedExercises);
      const setsSame = completedSetsEqual(localSnap.completedSets, session.completedSets);
      const finishedSame = finishedExercisesEqual(
        localSnap.finishedExercises,
        session.finishedExercises,
      );
      const weightsSame =
        !session.weights ||
        JSON.stringify(session.weights) === JSON.stringify(localSnap.weights);
      const activeSame =
        coachFloorMode ||
        !session.activeId ||
        session.activeId === localSnap.activeId;

      // Shared rest popup — apply immediately (coach checkoff → member timer).
      // Prefer this over the delayed completedSets effect so the timer spins now.
      if ("restActive" in session) {
        applyRemoteRestActive(session.restActive);
        if (session.restActive) {
          pendingRemoteRestRef.current = false;
        }
      }

      if (setsSame && finishedSame && weightsSame && activeSame) {
        return;
      }

      applyingRemote.current = true;
      if (!setsSame) {
        // Fallback rest start if restActive missing (older clients / race).
        if (!session.restActive) {
          pendingRemoteRestRef.current = liveRestBaselineReadyRef.current;
        }
        setCompletedSets(sets);
        stateRef.current = { ...stateRef.current, completedSets: sets };
      }
      if (!finishedSame) {
        setFinishedExercises(remoteFinished);
        stateRef.current = { ...stateRef.current, finishedExercises: remoteFinished };
      }
      if (session.weights && !weightsSame) {
        // Partner non-empty weights win; keep last-session seeds for blanks.
        // Coach updates always apply fully so member floor mirrors coach weight box.
        const merged =
          session.updatedBy === "coach"
            ? mergeWeightsWithSeeds(workout.exercises, session.weights, session.weights)
            : mergeWeightsWithSeeds(
                workout.exercises,
                localSnap.weights,
                session.weights,
              );
        setWeights(merged);
        stateRef.current = { ...stateRef.current, weights: merged };
      }
      if (!coachFloorMode && session.activeId && session.activeId !== localSnap.activeId) {
        const localIdx = workout.exercises.findIndex((e) => e.id === localSnap.activeId);
        const remoteIdx = workout.exercises.findIndex((e) => e.id === session.activeId);
        const localAhead = localIdx >= 0 && remoteIdx >= 0 && localIdx > remoteIdx;
        if (!localAhead) {
          setActiveId(session.activeId);
          stateRef.current = { ...stateRef.current, activeId: session.activeId };
        }
      }

      const fromCoach = session.updatedBy === "coach";
      if (instructorName || coachFloorMode) {
        setPartnerLive(!fromCoach);
      } else {
        setCoachLive(fromCoach);
      }
      // Don't immediately re-push the state we just applied (avoids overwriting coach on race).
      skipAutoPushAfterRemote.current = true;
      applyingRemote.current = false;
    },
    [
      instructorName,
      coachFloorMode,
      canCoachRestSettings,
      programSlug,
      workout.exercises,
      workout.restTimerSound,
      applyRemoteRestActive,
    ],
  );

  const flushWarmupSave = useCallback(() => {
    if (!warmupSyncEnabled || !liveSyncUserId || !liveSessionDate) return;

    saveChain.current = saveChain.current.catch(() => {}).then(async () => {
      const snap = stateRef.current;
      const res = await fetch("/api/member/warmup-progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate: liveSessionDate,
          completedSets: serializeCompletedSets(snap.completedSets),
          finishedExercises: Array.from(snap.finishedExercises),
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (typeof data.totalPoints === "number") {
          dispatchMemberScoreCelebrate({
            pointsEarned: data.pointsEarned ?? 0,
            totalPoints: data.totalPoints,
            label: "Warm-ups before live",
          });
        }
      }
    });

    return saveChain.current;
  }, [warmupSyncEnabled, liveSyncUserId, liveSessionDate, serializeCompletedSets]);

  const flushLiveSave = useCallback(() => {
    if (!liveSessionScope || !liveSyncUserId) return;

    saveChain.current = saveChain.current.catch(() => {}).then(async () => {
      const snap = stateRef.current;
      const asCoach = Boolean(instructorName || coachFloorMode);
      const payload: Record<string, unknown> = {
        userId: liveSyncUserId,
        sessionDate: liveSessionDate,
        completedSets: serializeCompletedSets(snap.completedSets),
        finishedExercises: Array.from(snap.finishedExercises),
        weights: snap.weights,
        updatedBy: asCoach ? ("coach" as const) : ("member" as const),
      };
      // Only send restActive when we intentionally started/cleared it.
      // Omitting keeps the partner's countdown from being wiped by a null save.
      // After Skip, force null even if a race re-seeded the ref.
      if (pendingForceClearRestRef.current) {
        payload.restActive = null;
        restActiveRef.current = null;
        restActiveDirtyRef.current = false;
        pendingForceClearRestRef.current = false;
      } else if (restActiveDirtyRef.current) {
        payload.restActive = restActiveRef.current;
        restActiveDirtyRef.current = false;
      } else if (restActiveRef.current) {
        payload.restActive = restActiveRef.current;
      }
      if (!coachFloorMode) payload.activeId = snap.activeId;
      // Coach owns rest duration/enabled — members must not push defaults over coach.
      if (canCoachRestSettings) {
        const rest = restSettingsRef.current;
        payload.restTimerEnabled = rest.enabled;
        payload.restTimerSeconds = normalizeRestTimerSeconds(rest.seconds);
        payload.restTimerSound = rest.sound;
      }
      // Helps server detect stale member overwrites of newer coach revisions.
      const baseRev = Math.max(lastAppliedRevision.current, lastPushedRevision.current);
      if (baseRev > 0) payload.baseRevision = baseRev;

      persistProgressCache();
      const res = await fetch(`/api/workouts/${workout.workoutId}/live-session`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        keepalive: true,
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.session && !(coachFloorMode && instructorName)) {
        applyRemoteSession(data.session);
      } else if (data.session?.revision != null) {
        lastAppliedRevision.current = Math.max(
          lastAppliedRevision.current,
          data.session.revision,
        );
      }
      const rev = data.session?.revision;
      if (typeof rev === "number") {
        lastPushedRevision.current = rev;
        lastAppliedRevision.current = Math.max(lastAppliedRevision.current, rev);
      }
    });

    return saveChain.current;
  }, [
    liveSessionScope,
    liveSyncUserId,
    liveSessionDate,
    instructorName,
    workout.workoutId,
    serializeCompletedSets,
    applyRemoteSession,
    coachFloorMode,
    canCoachRestSettings,
    persistProgressCache,
  ]);

  const queueLiveSave = useCallback(
    (immediate = false) => {
      persistProgressCache();
      if (!livePushEnabled && !warmupSyncEnabled) {
        if (liveSessionScope) pendingImmediatePushRef.current = true;
        return;
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const run = () => {
        if (warmupSyncEnabled) void flushWarmupSave();
        if (liveSessionScope) void flushLiveSave();
      };
      if (immediate) {
        // Fire on the next microtask so React state/stateRef settle first.
        saveTimer.current = setTimeout(run, 0);
        return;
      }
      // Tiny debounce for continuous weight typing; set checkoffs use immediate.
      const delay = instructorName ? 40 : 60;
      saveTimer.current = setTimeout(run, delay);
    },
    [
      livePushEnabled,
      warmupSyncEnabled,
      liveSessionScope,
      instructorName,
      flushLiveSave,
      flushWarmupSave,
      persistProgressCache,
      liveSessionScope,
    ],
  );

  // Flush any set checkoff that happened before the first remote hydrate.
  useEffect(() => {
    if (!livePushEnabled || !pendingImmediatePushRef.current) return;
    pendingImmediatePushRef.current = false;
    queueLiveSave(true);
  }, [livePushEnabled, queueLiveSave]);

  useEffect(() => {
    setLiveSessionHydrated(false);
    lastAppliedRevision.current = 0;
    lastPushedRevision.current = 0;
    lastAppliedRemoteAt.current = null;
    setEditingExerciseId(null);
  }, [liveSyncUserId, liveSessionDate, workout.workoutId]);

  // Restore last checkoffs instantly so a pull-to-refresh does not look empty.
  useEffect(() => {
    if (!liveSyncUserId || reviewMode) return;
    const cached = readMemberWorkoutProgressCache({
      userId: liveSyncUserId,
      workoutId: workout.workoutId,
      sessionDate: liveSessionDate,
    });
    if (!progressCacheHasWork(cached) || !cached) return;
    const sets: Record<string, Set<number>> = {};
    for (const [blockId, nums] of Object.entries(cached.completedSets)) {
      sets[blockId] = new Set(nums);
    }
    setCompletedSets(sets);
    setFinishedExercises(new Set(cached.finishedExercises));
    if (cached.weights && Object.keys(cached.weights).length > 0) {
      setWeights((prev) => ({ ...prev, ...cached.weights }));
    }
    stateRef.current = {
      ...stateRef.current,
      completedSets: sets,
      finishedExercises: new Set(cached.finishedExercises),
      weights: { ...stateRef.current.weights, ...cached.weights },
      activeId: cached.activeId || stateRef.current.activeId,
    };
    pendingImmediatePushRef.current = true;
  }, [liveSyncUserId, reviewMode, workout.workoutId, liveSessionDate]);

  useEffect(() => {
    if (!warmupSyncEnabled || !liveSessionDate) return;
    void fetch(`/api/member/warmup-progress?date=${liveSessionDate}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.progress) return;
        const incomingSets = (data.progress.completedSets || {}) as Record<string, number[]>;
        const incomingFinished = (data.progress.finishedExercises || []) as string[];
        const hasWork =
          incomingFinished.length > 0 ||
          Object.values(incomingSets).some((nums) => Array.isArray(nums) && nums.length > 0);
        if (!hasWork) return;
        const sets: Record<string, Set<number>> = {};
        for (const [blockId, nums] of Object.entries(incomingSets)) {
          sets[blockId] = new Set(nums);
        }
        setCompletedSets(sets);
        setFinishedExercises(new Set(incomingFinished));
      })
      .catch(() => {});
  }, [warmupSyncEnabled, liveSessionDate]);

  const clearLiveSession = useCallback(async () => {
    if (!liveSyncUserId) return;
    try {
      await fetch(`/api/workouts/${workout.workoutId}/live-session`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: liveSyncUserId,
          sessionDate: liveSessionDate,
          clear: true,
          completedSets: {},
          finishedExercises: [],
          updatedBy: instructorName ? "coach" : "member",
        }),
      });
    } catch {
      // ignore
    }
  }, [liveSyncUserId, liveSessionDate, workout.workoutId, instructorName]);

  // Push local checkoffs to shared store (coach ↔ member).
  useEffect(() => {
    if (!livePushEnabled) return;
    if (skipAutoPushAfterRemote.current) {
      skipAutoPushAfterRemote.current = false;
      return;
    }
    if (applyingRemote.current) return;
    queueLiveSave();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    livePushEnabled,
    completedSets,
    finishedExercises,
    weights,
    activeId,
    queueLiveSave,
  ]);

  // Live read via SSE (in-memory hot cache) + fast poll fallback for other instances.
  useEffect(() => {
    if (!liveSessionScope) return;

    const q = new URLSearchParams({ userId: liveSyncUserId! });
    if (liveSessionDate) q.set("date", liveSessionDate);
    const query = q.toString();

    const poll = async () => {
      if (document.visibilityState === "hidden" && liveSessionHydrated) return;
      try {
        const res = await fetch(
          `/api/workouts/${workout.workoutId}/live-session?${query}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.session) applyRemoteSession(data.session);
        }
      } catch {
        /* still mark hydrated so local checkoffs can persist */
      } finally {
        setLiveSessionHydrated(true);
      }
    };

    void poll();

    let es: EventSource | null = null;
    try {
      es = new EventSource(
        `/api/workouts/${workout.workoutId}/live-session/stream?${query}`,
      );
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { session?: Parameters<typeof applyRemoteSession>[0] };
          if (data.session) applyRemoteSession(data.session);
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* EventSource unavailable */
    }

    const pollId = setInterval(poll, LIVE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      es?.close();
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    liveSessionScope,
    liveSyncUserId,
    liveSessionDate,
    workout.workoutId,
    applyRemoteSession,
  ]);

  useEffect(() => {
    if (!liveSessionScope) return;
    const flush = () => {
      persistProgressCache();
      void flushLiveSave();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [liveSessionScope, persistProgressCache, flushLiveSave]);

  useEffect(() => {
    persistProgressCache();
  }, [completedSets, finishedExercises, weights, activeId, persistProgressCache]);

  // Seed local completedSets from past when opening in (pure) review mode.
  // Pre-render completed sets with gold checkmarks (member-set-btn--done)
  // matching the previously logged setsCompleted. For active member or instructor sessions
  // we start empty so clicks immediately drive the green visual state.
  useEffect(() => {
    if (reviewMode && !instructorName) {
      const seed: Record<string, Set<number>> = {};
      for (const b of workout.exercises) {
        const n = b.past?.setsCompleted ?? b.past?.sets ?? 0;
        if (n > 0) {
          seed[b.id] = new Set(Array.from({ length: n }, (_, k) => k + 1));
        }
      }
      if (Object.keys(seed).length > 0) {
        setCompletedSets((prev) => ({ ...prev, ...seed }));
      }
    }
  }, [reviewMode, instructorName, workout]);

  const videoModalBlock = workout.exercises.find(
    (b) => b.id === videoModalBlockId && b.videoUrl,
  );

  // For peeking next exercise (space efficient)
  const activeIdx = workout.exercises.findIndex((e) => e.id === activeId);
  const nextExercise = workout.exercises
    .slice(activeIdx + 1)
    .find((e) => !finishedExercises.has(e.id));

  const clearRestTimer = useCallback(() => {
    setRestTimer(null);
    setRestSecondsLeft(0);
    setRestCompleting(false);
    restActiveRef.current = null;
    restActiveDirtyRef.current = true;
    pendingForceClearRestRef.current = true;
    lastAppliedRestEndsAt.current = 0;
    restTimerIdentityRef.current = "";
    // Block partner echo from re-opening the timer we just skipped.
    suppressAutoRestUntilRef.current = Date.now() + 4000;
    // Push clear so partner closes the shared rest popup.
    if (livePushEnabled) queueLiveSave(true);
  }, [livePushEnabled, queueLiveSave]);

  const resolveSecondsForBlock = useCallback(
    (_block: MemberExerciseBlock): number | null => {
      const rest = restSettingsRef.current;
      // Live sessions default rest ON — only skip when coach explicitly disabled.
      if (rest.enabled === false) return null;
      // Session/floor rest always wins so coach can retune mid-session
      // even when the workout was deployed with a different duration.
      return normalizeRestTimerSeconds(rest.seconds || DEFAULT_REST_TIMER_SECONDS);
    },
    [],
  );

  const maybeStartRestTimer = useCallback(
    (
      blockId: string,
      setNum: number,
      opts?: {
        fromRemote?: boolean;
        silentStart?: boolean;
        /** When set, force this phase (timed hold vs rest). */
        phase?: "exercise" | "rest";
        /** Prefer these seconds (e.g. timed hold minutes). */
        secondsOverride?: number;
      },
    ) => {
      if (Date.now() < suppressAutoRestUntilRef.current) return;

      const block = workout.exercises.find((e) => e.id === blockId);
      if (!block) return;

      // Ensure rest is on for live set checkoffs unless coach explicitly turned it off.
      // Timed "Time of Exercise" still runs even if between-set rest is disabled.
      const phase: "exercise" | "rest" =
        opts?.phase ??
        (opts?.fromRemote && restActiveRef.current?.phase === "exercise"
          ? "exercise"
          : "rest");

      if (phase === "rest") {
        if (restSettingsRef.current.enabled === false) return;
        restSettingsRef.current = {
          ...restSettingsRef.current,
          enabled: true,
          seconds: normalizeRestTimerSeconds(
            restSettingsRef.current.seconds || DEFAULT_REST_TIMER_SECONDS,
          ),
        };
        setSessionRestEnabled(true);
      }

      let seconds: number | null =
        typeof opts?.secondsOverride === "number" && opts.secondsOverride > 0
          ? opts.secondsOverride
          : null;
      if (seconds == null && phase === "exercise") {
        seconds = exerciseHoldDurationSec(block);
      }
      if (seconds == null) {
        seconds = resolveSecondsForBlock(block);
      }
      if (!seconds || seconds <= 0) return;

      // Rest after every set including the last set of the exercise.
      // If partner already pushed a shared restActive, prefer that endsAt.
      const shared = restActiveRef.current;
      const endsAt =
        opts?.fromRemote && shared && shared.blockId === blockId && shared.endsAt > Date.now()
          ? shared.endsAt
          : Date.now() + seconds * 1000;
      const totalSeconds =
        opts?.fromRemote && shared && shared.blockId === blockId
          ? shared.totalSeconds
          : seconds;

      setRestCompleting(false);
      setRestSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
      setRestTimer({
        blockId,
        completedSetNum: setNum,
        endsAt,
        totalSeconds,
        phase,
      });
      restTickAnnouncedRef.current = new Set();
      restHornPlayedRef.current = false;
      lastAppliedRestEndsAt.current = endsAt;

      if (!opts?.fromRemote) {
        restActiveRef.current = {
          blockId,
          completedSetNum: setNum,
          endsAt,
          totalSeconds,
          startedBy: instructorName || coachFloorMode ? "coach" : "member",
          phase,
        };
        restActiveDirtyRef.current = true;
        // Push set + restActive together so partner timer spins immediately.
        queueLiveSave(true);
      }

      if (!opts?.silentStart && !restMuted) {
        playRestStart();
      }
    },
    [
      workout.exercises,
      restMuted,
      resolveSecondsForBlock,
      instructorName,
      coachFloorMode,
      queueLiveSave,
    ],
  );

  /** After timed hold ends (or is skipped), open the between-set rest timer. */
  const flipExerciseTimerToRest = useCallback(
    (blockId: string, setNum: number) => {
      maybeStartRestTimer(blockId, setNum, { phase: "rest", silentStart: false });
    },
    [maybeStartRestTimer],
  );

  const saveCoachRestSettings = useCallback(
    async (
      enabled: boolean,
      seconds: number,
      sound: RestTimerSoundKey = restSoundRef.current,
    ) => {
      const nextSeconds = normalizeRestTimerSeconds(seconds);
      const nextSound = normalizeRestTimerSound(sound);
      setSessionRestEnabled(enabled);
      setSessionRestSeconds(nextSeconds);
      setSessionRestSound(nextSound);
      restSoundRef.current = nextSound;
      restSettingsRef.current = {
        enabled,
        seconds: nextSeconds,
        sound: nextSound,
      };

      // Live: retarget open countdown AND push restActive so member matches.
      // (Previously only local React state updated — partner kept the old endsAt.)
      if (enabled) {
        const open = restActiveRef.current;
        if (open) {
          const nextEndsAt = Date.now() + nextSeconds * 1000;
          const phase = open.phase === "exercise" ? "exercise" : "rest";
          restActiveRef.current = {
            ...open,
            totalSeconds: nextSeconds,
            endsAt: nextEndsAt,
            startedBy: instructorName || coachFloorMode ? "coach" : open.startedBy,
            phase,
          };
          restActiveDirtyRef.current = true;
          lastAppliedRestEndsAt.current = nextEndsAt;
          setRestTimer({
            blockId: open.blockId,
            completedSetNum: open.completedSetNum,
            endsAt: nextEndsAt,
            totalSeconds: nextSeconds,
            phase,
          });
          setRestSecondsLeft(nextSeconds);
          setRestCompleting(false);
          // Keep restHornPlayedRef — retarget must not re-arm complete/ticks blast.
        }
      } else {
        restActiveRef.current = null;
        restActiveDirtyRef.current = true;
        lastAppliedRestEndsAt.current = 0;
        restTimerIdentityRef.current = "";
        setRestTimer(null);
        setRestSecondsLeft(0);
        setRestCompleting(false);
      }

      if (!canCoachRestSettings || !workout.workoutId) {
        if (livePushEnabled) flushLiveSave();
        return;
      }
      setRestSettingsSaving(true);
      try {
        await fetch(`/api/workouts/${workout.workoutId}/rest-timer`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled,
            seconds: nextSeconds,
            sound: nextSound,
          }),
        });
        // Push duration + open restActive retarget to partner immediately.
        flushLiveSave();
      } catch {
        if (livePushEnabled) flushLiveSave();
      } finally {
        setRestSettingsSaving(false);
      }
    },
    [
      canCoachRestSettings,
      workout.workoutId,
      flushLiveSave,
      instructorName,
      coachFloorMode,
      livePushEnabled,
    ],
  );

  /** Both sides: nudge open countdown ±seconds and push shared restActive. */
  const adjustActiveTimerBy = useCallback(
    (deltaSec: number) => {
      const open = restActiveRef.current;
      const local = restTimer;
      if (!open && !local) return;
      const base = open ?? {
        blockId: local!.blockId,
        completedSetNum: local!.completedSetNum,
        endsAt: local!.endsAt,
        totalSeconds: local!.totalSeconds,
        startedBy: (instructorName || coachFloorMode ? "coach" : "member") as
          | "coach"
          | "member",
        phase: local!.phase,
      };
      const left = Math.max(1, Math.ceil((base.endsAt - Date.now()) / 1000) + deltaSec);
      const nextSeconds = Math.min(1800, Math.max(5, left));
      const nextEndsAt = Date.now() + nextSeconds * 1000;
      const phase = base.phase === "exercise" ? "exercise" : "rest";
      const totalSeconds = Math.max(base.totalSeconds, nextSeconds);
      restActiveRef.current = {
        blockId: base.blockId,
        completedSetNum: base.completedSetNum,
        endsAt: nextEndsAt,
        totalSeconds,
        startedBy: instructorName || coachFloorMode ? "coach" : base.startedBy,
        phase,
      };
      restActiveDirtyRef.current = true;
      lastAppliedRestEndsAt.current = nextEndsAt;
      setRestTimer({
        blockId: base.blockId,
        completedSetNum: base.completedSetNum,
        endsAt: nextEndsAt,
        totalSeconds,
        phase,
      });
      setRestSecondsLeft(nextSeconds);
      setRestCompleting(false);
      // Do not reset restHornPlayedRef / tick set on ±15s.
      if (livePushEnabled) flushLiveSave();
    },
    [restTimer, instructorName, coachFloorMode, livePushEnabled, flushLiveSave],
  );

  // Countdown while popup is open; on 0 → buzz → rest closes, exercise flips to rest.
  // Depend only on endsAt + phase so mute toggles don't cancel the auto-close timer.
  useEffect(() => {
    if (!restTimer) return;

    let cancelled = false;
    let closeTimer: number | null = null;
    const endsAt = restTimer.endsAt;
    const phase = restTimer.phase;
    const blockId = restTimer.blockId;
    const setNum = restTimer.completedSetNum;
    // New timer identity (block/set/phase) → reset sound guards.
    // Pure retarget (±15s / duration chip) keeps guards so we don't re-horn/re-tick a blast.
    const identity = `${blockId}:${setNum}:${phase ?? "rest"}`;
    const prevIdentity = restTimerIdentityRef.current;
    if (prevIdentity !== identity) {
      restTimerIdentityRef.current = identity;
      restHornPlayedRef.current = false;
      restTickAnnouncedRef.current = new Set();
    }
    setRestCompleting(false);

    const finishAndClose = () => {
      if (cancelled || restHornPlayedRef.current) return;
      restHornPlayedRef.current = true;
      setRestCompleting(true);
      setRestSecondsLeft(0);
      // Real rest-end: force so global de-dupe never swallows the horn.
      // Coach floor stays silent via restMuted default; members always try to play.
      if (!restMutedRef.current) {
        playRestComplete(restSoundRef.current, { force: true });
      }
      // Cybertruck / end samples ~1.1s+ — keep popup open long enough to finish.
      // Do not depend on effect cleanup for sound (remote null can cancel this timer).
      closeTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (phase === "exercise") {
          // Hold done → same horn, then rest timer.
          flipExerciseTimerToRest(blockId, setNum);
          return;
        }
        setRestTimer(null);
        setRestSecondsLeft(0);
        setRestCompleting(false);
        restActiveRef.current = null;
        restActiveDirtyRef.current = true;
        lastAppliedRestEndsAt.current = 0;
        if (livePushEnabled) queueLiveSave(true);
      }, 1600);
    };

    const tick = () => {
      if (cancelled) return;
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      if (left <= 0) {
        finishAndClose();
        return;
      }
      setRestSecondsLeft(left);
      // Soft ticks only in the final 5 seconds (less gym noise).
      if (
        left <= 5 &&
        !restMutedRef.current &&
        !restTickAnnouncedRef.current.has(left)
      ) {
        restTickAnnouncedRef.current.add(left);
        playRestTick(left <= 5, left);
      }
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (closeTimer != null) window.clearTimeout(closeTimer);
    };
  }, [restTimer?.endsAt, restTimer?.phase, flipExerciseTimerToRest, livePushEnabled, queueLiveSave]);

  // When coach or member marks a set on the other side, start rest locally so both see/hear it.
  useEffect(() => {
    // Seed baseline on first hydrate so we don't treat history as "new" checkoffs.
    if (prevCompletedSetsRef.current == null) {
      prevCompletedSetsRef.current = Object.fromEntries(
        Object.entries(completedSets).map(([id, set]) => [id, new Set(set)]),
      );
      pendingRemoteRestRef.current = false;
      liveRestBaselineReadyRef.current = true;
      return;
    }
    const prev = prevCompletedSetsRef.current;
    const newlyCompleted: Array<{ blockId: string; setNum: number }> = [];
    for (const [blockId, nums] of Object.entries(completedSets)) {
      const before = prev[blockId] ?? new Set<number>();
      for (const n of nums) {
        if (!before.has(n)) newlyCompleted.push({ blockId, setNum: n });
      }
    }
    prevCompletedSetsRef.current = Object.fromEntries(
      Object.entries(completedSets).map(([id, set]) => [id, new Set(set)]),
    );
    if (newlyCompleted.length === 0) {
      pendingRemoteRestRef.current = false;
      return;
    }
    // Large history sync after empty local state — re-baseline, don't start rest.
    if (newlyCompleted.length > 1 && !liveRestBaselineReadyRef.current) {
      pendingRemoteRestRef.current = false;
      liveRestBaselineReadyRef.current = true;
      return;
    }
    if (!pendingRemoteRestRef.current) return;
    pendingRemoteRestRef.current = false;
    liveRestBaselineReadyRef.current = true;
    // Only start for a single new checkoff (one set at a time).
    if (newlyCompleted.length !== 1) return;
    if (Date.now() < suppressAutoRestUntilRef.current) return;
    const latest = newlyCompleted[0];
    const block = workout.exercises.find((e) => e.id === latest.blockId);
    const holdSec = block ? exerciseHoldDurationSec(block) : null;
    maybeStartRestTimer(latest.blockId, latest.setNum, {
      fromRemote: true,
      phase: holdSec ? "exercise" : "rest",
      secondsOverride: holdSec ?? undefined,
    });
  }, [completedSets, maybeStartRestTimer, workout.exercises]);

  // Re-seed when the workout / past logs change. Keep any in-session edits.
  const weightSeedKey = workout.exercises
    .map(
      (e) =>
        `${e.id}:${e.exerciseId}:${e.past?.startingWeightLbs ?? ""}:${e.weightTier}`,
    )
    .join("|");
  useEffect(() => {
    setWeights((prev) => {
      const next = mergeWeightsWithSeeds(workout.exercises, prev, null);
      stateRef.current = { ...stateRef.current, weights: next };
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by weightSeedKey
  }, [workout.workoutId, weightSeedKey]);

  const weightValueForBlock = useCallback(
    (block: MemberWorkoutView["exercises"][number]) => weights[block.id] ?? "",
    [weights],
  );

  /** Micro-label under the lbs input: last session vs first-time tier guess. */
  const weightBoxLabel = useCallback(
    (block: MemberWorkoutView["exercises"][number]) => {
      const current = (weights[block.id] ?? "").trim();
      if (!current) return "lbs";
      if (
        hasLoggedPastWeight(block) &&
        current === String(block.past!.startingWeightLbs)
      ) {
        return "last";
      }
      if (
        !hasLoggedPastWeight(block) &&
        suggestedWeightLbs(block) != null &&
        current === String(suggestedWeightLbs(block))
      ) {
        return "guess";
      }
      return "lbs";
    },
    [weights],
  );

  const updateWeight = useCallback(
    (blockId: string, value: string) => {
      fireEngage();
      setWeights((w) => {
        const updated = { ...w, [blockId]: value };
        stateRef.current = { ...stateRef.current, weights: updated };
        return updated;
      });
      queueLiveSave();
    },
    [queueLiveSave, fireEngage],
  );

  const toggleSet = useCallback(
    (blockId: string, setNum: number, originEl?: HTMLElement) => {
      if (freeLockedExerciseIds.has(blockId)) return;
      const wasDone = completedSets[blockId]?.has(setNum) ?? false;

      if (wasDone) {
        // Undo set: stay unchecked, kill any timer, do NOT auto re-check or re-launch.
        suppressAutoRestUntilRef.current = Date.now() + 4000;
        restActiveRef.current = null;
        restActiveDirtyRef.current = true;
        lastAppliedRestEndsAt.current = 0;
        setRestTimer(null);
        setRestSecondsLeft(0);
        setRestCompleting(false);
      }

      setCompletedSets((prev) => {
        const next = new Set(prev[blockId] ?? []);
        if (wasDone) next.delete(setNum);
        else next.add(setNum);
        const updated = { ...prev, [blockId]: next };
        stateRef.current = { ...stateRef.current, completedSets: updated };
        return updated;
      });

      if (!wasDone) {
        fireEngage();
        // User gesture: unlock iOS audio so rest-end can play when countdown hits 0.
        unlockRestAudio(restSoundRef.current);
        // Soft set-check pop (member + coach). Rest start chirp still separate.
        if (!restMutedRef.current) {
          playSetCheckPop();
        }
        const block = workout.exercises.find((e) => e.id === blockId);
        // Hold / timed cue: green "Time of Exercise" first, then rest. Else rest only.
        const holdSec = block ? exerciseHoldDurationSec(block) : null;
        if (holdSec) {
          maybeStartRestTimer(blockId, setNum, {
            phase: "exercise",
            secondsOverride: holdSec,
          });
        } else {
          maybeStartRestTimer(blockId, setNum, { phase: "rest" });
        }
        // Last-set confetti: coach floor AND member (pass origin from the set button).
        if (block && originEl) {
          const prescription = normalizePrescription({
            setScheme: block.setScheme,
            repPattern: block.repPattern,
            reps: block.reps,
            sets: block.setCount,
          });
          const timed = isTimedApproach(prescription.approach);
          const isLastSet = timed ? setNum === 1 : setNum === block.setCount;
          if (isLastSet) {
            fireWorkoutConfetti(confettiOriginFromElement(originEl));
            if (coachFloorMode) {
              setCoachExpandedBlockId((open) => (open === blockId ? null : open));
            }
          }
        }
      } else {
        // Push unchecked state + cleared rest so server/partner don't re-apply the set.
        queueLiveSave(true);
      }
    },
    [
      queueLiveSave,
      completedSets,
      maybeStartRestTimer,
      coachFloorMode,
      workout.exercises,
      fireEngage,
    ],
  );

  /** Skip: exercise hold → rest; rest → close. Uses refs so coach skip works even if React state lags. */
  const skipActiveTimer = useCallback(() => {
    const open = restActiveRef.current;
    const local = restTimer;
    const blockId = open?.blockId ?? local?.blockId;
    const setNum = open?.completedSetNum ?? local?.completedSetNum;
    const phase = open?.phase ?? local?.phase ?? "rest";
    if (!blockId || setNum == null) {
      // Hard clear any stuck popup
      clearRestTimer();
      return;
    }
    if (phase === "exercise") {
      flipExerciseTimerToRest(blockId, setNum);
      return;
    }
    clearRestTimer();
  }, [restTimer, flipExerciseTimerToRest, clearRestTimer]);

  const restBlockName =
    restTimer != null
      ? workout.exercises.find((e) => e.id === restTimer.blockId)?.name ?? null
      : null;

  const displayRestSeconds =
    restTimer != null
      ? Math.max(restSecondsLeft, Math.max(0, Math.ceil((restTimer.endsAt - Date.now()) / 1000)))
      : 0;

  const restTimerUi =
    restTimer != null ? (
      <WorkoutRestTimer
        secondsLeft={displayRestSeconds > 0 ? displayRestSeconds : restSecondsLeft}
        totalSeconds={restTimer.totalSeconds}
        onSkip={skipActiveTimer}
        onAdjust={adjustActiveTimerBy}
        compact={coachFloorMode}
        sticky
        exerciseName={restBlockName}
        completedSetNum={restTimer.completedSetNum}
        muted={restMuted}
        onToggleMute={toggleRestMute}
        completing={restCompleting || displayRestSeconds <= 0}
        phase={restTimer.phase}
      />
    ) : null;

  const coachRestControls =
    canCoachRestSettings && !reviewMode ? (
      <div className="coach-rest-controls rounded-xl border border-accent/35 bg-accent/10 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
            <input
              type="checkbox"
              checked={sessionRestEnabled}
              onChange={(e) => void saveCoachRestSettings(e.target.checked, sessionRestSeconds)}
              className="rounded border-[var(--border)]"
            />
            Rest timer after each set
          </label>
          {restSettingsSaving ? (
            <span className="text-[10px] text-[var(--muted)]">Saving…</span>
          ) : (
            <span className="text-[10px] text-[var(--muted)]">
              {sessionRestEnabled
                ? `${sessionRestSeconds}s · after every set · live for member`
                : "Off"}
            </span>
          )}
        </div>
        {sessionRestEnabled ? (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REST_TIMER_PRESETS.map((preset) => {
                const active = sessionRestSeconds === preset.seconds;
                return (
                  <button
                    key={preset.seconds}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      active
                        ? "border-accent bg-accent/25 text-accent"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-accent/50 hover:text-[var(--text)]"
                    }`}
                    onClick={() => void saveCoachRestSettings(true, preset.seconds, sessionRestSound)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 border-t border-accent/20 pt-2">
              <CoachRestSoundLibrary
                compact
                value={sessionRestSound}
                onChange={(key) => {
                  void saveCoachRestSettings(true, sessionRestSeconds, key);
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    ) : null;

  const openVideo = useCallback((blockId: string) => {
    setVideoModalBlockId(blockId);
  }, []);

  const scrollMemberToExercise = useCallback(
    (blockId: string) => {
      if (coachFloorMode || instructorName || reviewMode) return;

      const scroll = () => {
        const el = document.getElementById(`member-exercise-${blockId}`);
        if (!el) return false;
        // Offset for frozen member chrome (greeting + nav + optional live strip)
        const chrome = document.querySelector(".member-sticky-chrome");
        const chromeH = chrome instanceof HTMLElement ? chrome.offsetHeight : 120;
        const top = el.getBoundingClientRect().top + window.scrollY - chromeH - 12;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        return true;
      };

      // Wait for finished exercise to collapse before measuring next card.
      window.setTimeout(() => {
        if (!scroll()) window.setTimeout(scroll, 120);
      }, 60);
    },
    [coachFloorMode, instructorName, reviewMode],
  );

  const advanceToNextExercise = useCallback(
    (blockId: string, finished: Set<string>) => {
      const idx = workout.exercises.findIndex((e) => e.id === blockId);
      const upcoming = workout.exercises.slice(idx + 1).find((e) => !finished.has(e.id));
      if (!upcoming) return;
      setActiveId(upcoming.id);
      stateRef.current = { ...stateRef.current, activeId: upcoming.id };
      scrollMemberToExercise(upcoming.id);
    },
    [workout.exercises, scrollMemberToExercise],
  );

  const markExerciseFinished = useCallback(
    (blockId: string) => {
      fireEngage();
      setVideoModalBlockId((openId) => (openId === blockId ? null : openId));
      const next = new Set(finishedExercises);
      next.add(blockId);
      setFinishedExercises(next);
      stateRef.current = { ...stateRef.current, finishedExercises: next };
      advanceToNextExercise(blockId, next);
      queueLiveSave(true);
    },
    [finishedExercises, advanceToNextExercise, queueLiveSave, fireEngage],
  );

  const closeExerciseEdit = useCallback(() => {
    setEditingExerciseId(null);
    queueLiveSave(true);
  }, [queueLiveSave]);

  const reopenExercise = useCallback(
    (blockId: string) => {
      setEditingExerciseId(blockId);
      setActiveId(blockId);
      stateRef.current = { ...stateRef.current, activeId: blockId };
      scrollMemberToExercise(blockId);
    },
    [scrollMemberToExercise],
  );

  // Auto-finish exercises when all sets are marked — batch into one state update so
  // multiple exercises finishing together all land in finishedExercises (live floor balls).
  useEffect(() => {
    if (reviewMode && !instructorName) return;
    const toFinish: string[] = [];
    for (const block of workout.exercises) {
      if (finishedExercises.has(block.id)) continue;
      const doneForBlock = completedSets[block.id] ?? new Set<number>();
      const prescription = normalizePrescription({
        setScheme: block.setScheme,
        repPattern: block.repPattern,
        reps: block.reps,
        sets: block.setCount,
      });
      const isTimedBlock = isTimedApproach(prescription.approach);
      const allSetsDoneForBlock = isTimedBlock
        ? doneForBlock.has(1)
        : doneForBlock.size >= block.setCount;
      if (allSetsDoneForBlock) toFinish.push(block.id);
    }
    if (toFinish.length === 0) return;

    const next = new Set(finishedExercises);
    for (const id of toFinish) next.add(id);
    const lastFinished = toFinish[toFinish.length - 1];
    setFinishedExercises(next);
    stateRef.current = { ...stateRef.current, finishedExercises: next };
    if (lastFinished) advanceToNextExercise(lastFinished, next);
    queueLiveSave(true);
  }, [
    completedSets,
    finishedExercises,
    workout.exercises,
    reviewMode,
    instructorName,
    queueLiveSave,
    advanceToNextExercise,
  ]);

  const markWorkoutFinished = useCallback(() => {
    const allIds = workout.exercises.map((e) => e.id);
    const next = new Set(allIds);
    setFinishedExercises(next);
    stateRef.current = { ...stateRef.current, finishedExercises: next };
    queueLiveSave(true);
    onCoachFloorFinished?.();
  }, [workout.exercises, queueLiveSave, onCoachFloorFinished]);

  const totalExercises = workout.exercises.length;
  const countableExerciseIds = freeExplorer
    ? workout.exercises.slice(0, freeOpenCount).map((e) => e.id)
    : workout.exercises.map((e) => e.id);
  const finishedCountable = countableExerciseIds.filter((id) => finishedExercises.has(id)).length;
  const allExercisesFinished =
    !reviewMode &&
    countableExerciseIds.length > 0 &&
    finishedCountable >= countableExerciseIds.length;

  useEffect(() => {
    if (allExercisesFinished) setFinishedListExpanded(false);
  }, [allExercisesFinished]);

  const handleLogComplete = useCallback(async () => {
    if (logResult || isLogging) return;

    // Collect all exercises that were explicitly finished OR have per-set progress marked.
    // This ensures the "log your sets" buttons (per-set toggles) actually contribute setsCompleted to the log.
    const blocksWithSets = Object.keys(completedSets).filter(id => (completedSets[id]?.size ?? 0) > 0);
    let idsToLog = Array.from(new Set([...finishedExercises, ...blocksWithSets]));
    // Free Explorer: only log preview-open exercises (rest are soft-locked teases).
    if (freeExplorer && freeLockedExerciseIds.size > 0) {
      idsToLog = idsToLog.filter((id) => !freeLockedExerciseIds.has(id));
    }

    const total = freeExplorer ? freeOpenCount || workout.exercises.length : workout.exercises.length;
    const progress = total > 0 ? Math.round((idsToLog.length / total) * 100) : 0;

    // Log whatever the current state is (supports 0% partial or "just noting progress")
    setIsLogging(true);
    try {
      const exercisesPayload = idsToLog.map((blockId) => {
        const block = workout.exercises.find((b) => b.id === blockId)!;
        const w = weights[blockId];
        const startingWeightLbs = w ? parseFloat(w) : (block.past?.startingWeightLbs ?? null);
        const doneForBlock = completedSets[blockId] ?? new Set<number>();
        const setsCompleted = doneForBlock.size;
        let repsCompleted = setsCompleted * 5; // default ~5 reps/set
        if (block.reps) {
          const repNum = parseInt(block.reps, 10) || 5;
          repsCompleted = setsCompleted * repNum;
        }
        // treat timed as ~12 "rep equiv" if the set was completed
        if (block.setScheme?.toLowerCase().includes("time") || block.setScheme?.toLowerCase().includes("timed")) {
          repsCompleted = setsCompleted > 0 ? 12 : 0;
        }
        return {
          workoutExerciseId: block.id,
          exerciseId: block.exerciseId,
          setScheme: block.setScheme,
          repPattern: block.repPattern,
          reps: block.reps,
          sets: block.setCount,
          weightTier: block.weightTier,
          startingWeightLbs: Number.isFinite(startingWeightLbs) ? startingWeightLbs : null,
          repsCompleted,
          setsCompleted,
        };
      });

      const payload: any = { exercises: exercisesPayload, progress };
      if (programSlug) payload.programSlug = programSlug;
      if (targetUserId) payload.targetUserId = targetUserId;
      if (liveSessionDate) payload.sessionDate = liveSessionDate;
      const res = await fetch(`/api/workouts/${workout.workoutId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err?.detail;
        const message =
          typeof detail === "string"
            ? detail
            : typeof detail === "object" && detail !== null
              ? "Failed to log workout"
              : "Failed to log workout";
        throw new Error(message);
      }

      const data = await res.json();
      await clearLiveSession();
      if (isMaintainSession) {
        clearMaintainResume(liveSyncUserId || targetUserId, workout.workoutId);
      }
      setLogResult({
        performedAt: data.performedAt,
        count: data.performances || idsToLog.length,
        progress: data.progress ?? progress,
      });
      const gamification = data.gamification;
      const fullWorkout =
        progress >= 100 ||
        (total > 0 && finishedExercises.size >= total && idsToLog.length >= total);
      if (gamification && typeof gamification.totalPoints === "number") {
        const pointsEarned = gamification.awarded
          ? gamification.pointsEarned ?? GAMIFICATION_POINTS.workout_logged
          : 0;
        dispatchMemberScoreCelebrate({
          pointsEarned,
          totalPoints: gamification.totalPoints,
          label: fullWorkout ? "Workout complete!" : "Workout logged",
          celebration: fullWorkout ? "workout-complete" : "standard",
        });
      }
      requestAnimationFrame(() => {
        document.getElementById("workout-logged-success")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (e: any) {
      const msg = e?.message || "Could not save. Check connection and try again.";
      if (!/gamification points/i.test(msg)) {
        alert(msg);
      }
    } finally {
      setIsLogging(false);
    }
  }, [
    finishedExercises,
    workout,
    weights,
    completedSets,
    activeId,
    programSlug,
    targetUserId,
    liveSessionDate,
    isMaintainSession,
    liveSyncUserId,
    clearLiveSession,
    logResult,
    isLogging,
  ]);

  const showLoggedSuccess = !reviewMode && !hideLogButton && !!logResult;

  if (coachFloorMode) {
    return (
      <div className="coach-live-checkoff w-full space-y-2">
        {coachRestControls}
        {restTimerUi}
        {partnerLive && instructorName ? (
          <p className="text-[10px] font-medium text-[var(--success)]">
            Member is logging — updates sync here.
          </p>
        ) : null}
        {workout.exercises.map((block) => {
          const prescription = normalizePrescription({
            setScheme: block.setScheme,
            repPattern: block.repPattern,
            reps: block.reps,
            sets: block.setCount,
          });
          const isTimed = isTimedApproach(prescription.approach);
          const doneForBlock = completedSets[block.id] ?? new Set<number>();
          const allSetsDone = isTimed
            ? doneForBlock.has(1)
            : doneForBlock.size >= block.setCount;
          const exerciseDone = finishedExercises.has(block.id) || allSetsDone;
          const showCompactSets = allSetsDone && coachExpandedBlockId !== block.id;
          const loggedWeight = weights[block.id]?.trim();
          const doneLabel = isTimed
            ? loggedWeight
              ? `${loggedWeight} lbs · Done`
              : "Done"
            : loggedWeight
              ? `${loggedWeight} lbs · ${block.setCount} set${block.setCount === 1 ? "" : "s"}`
              : `${block.setCount} set${block.setCount === 1 ? "" : "s"} done`;
          const weightCell = (
            <label
              className="coach-floor-weight-box"
              title={
                hasLoggedPastWeight(block)
                  ? "Last logged weight for this exercise (edit if needed)"
                  : "Starting guess from weight tier (edit if needed)"
              }
              onClick={(e) => e.stopPropagation()}
            >
              <input
                className="coach-floor-weight-box__input"
                type="number"
                inputMode="decimal"
                aria-label={`${block.name} weight in pounds`}
                placeholder="—"
                value={weightValueForBlock(block)}
                onChange={(e) => updateWeight(block.id, e.target.value)}
                onFocus={(e) => e.target.select()}
              />
              <span className="coach-floor-weight-box__label">
                {weightBoxLabel(block)}
              </span>
            </label>
          );

          return (
            <div
              key={block.id}
              className={`coach-floor-exercise rounded-lg border ${
                exerciseDone
                  ? `coach-floor-exercise--complete border-[var(--ramp-gold)]/45 bg-[var(--ramp-gold)]/8${
                      showCompactSets ? "" : " px-2 py-1.5"
                    }`
                  : "border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
              }`}
            >
              {showCompactSets ? (
                <button
                  type="button"
                  className="coach-floor-exercise__compact"
                  aria-label={`${block.name}, ${doneLabel}. Tap to edit weight and sets.`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCoachExpandedBlockId(block.id);
                  }}
                >
                  <span className="coach-floor-exercise__compact-name">{block.name}</span>
                  <span className="coach-floor-exercise__compact-status">{doneLabel}</span>
                </button>
              ) : (
                <>
                  <p
                    className={`text-xs font-semibold leading-snug ${
                      exerciseDone ? "text-[var(--ramp-gold-light)]" : ""
                    }`}
                  >
                    {block.name}
                  </p>
                  <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                    {isTimed ? (
                      <div className="coach-floor-set-grid">
                        {weightCell}
                        <button
                          type="button"
                          data-coach-last-set={block.id}
                          aria-pressed={allSetsDone}
                          className={`coach-floor-set-btn ${allSetsDone ? "coach-floor-set-btn--done" : ""}`}
                          onClick={(e) => toggleSet(block.id, 1, e.currentTarget)}
                        >
                          <span className="coach-floor-set-btn__num">
                            {allSetsDone ? "✓" : "▶"}
                          </span>
                          <span className="coach-floor-set-btn__label">
                            {allSetsDone ? "Done" : "Mark"}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="coach-floor-set-grid">
                        {weightCell}
                        {Array.from({ length: block.setCount }, (_, i) => {
                          const setNum = i + 1;
                          const done = doneForBlock.has(setNum);
                          return (
                            <button
                              key={setNum}
                              type="button"
                              {...(setNum === block.setCount ? { "data-coach-last-set": block.id } : {})}
                              aria-pressed={done}
                              aria-label={`Set ${setNum}${done ? ", completed" : ""}`}
                              className={`coach-floor-set-btn ${done ? "coach-floor-set-btn--done" : ""}`}
                              onClick={(e) => toggleSet(block.id, setNum, e.currentTarget)}
                            >
                              <span className="coach-floor-set-btn__num">
                                {done ? "✓" : setNum}
                              </span>
                              <span className="coach-floor-set-btn__label">Set</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {(() => {
                      const restS = resolveSecondsForBlock(block);
                      if (!restS) return null;
                      return (
                        <p className="mt-0.5 text-[9px] font-medium leading-tight text-[var(--muted)]">
                          Rest {restS}s on check
                        </p>
                      );
                    })()}
                  </div>
                  {allSetsDone ? (
                    <button
                      type="button"
                      className="coach-floor-exercise__collapse"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoachExpandedBlockId(null);
                      }}
                    >
                      Collapse
                    </button>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn-primary min-h-[44px] w-full rounded-xl py-2.5 text-sm font-semibold"
            onClick={() => markWorkoutFinished()}
          >
            Finished
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto w-full max-w-md md:max-w-2xl lg:max-w-2xl xl:max-w-2xl ${
        embedded ? "px-0 py-2 md:px-2" : showLoggedSuccess ? "px-4 py-2 md:px-6" : "px-4 py-6 md:px-6"
      }`}
    >
      {showLoggedSuccess ? (
        <div
          id="workout-logged-success"
          className="rounded-xl border border-[var(--success)]/35 bg-[var(--success)]/8 px-3 py-2.5"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => setLoggedDetailsOpen((open) => !open)}
              aria-expanded={loggedDetailsOpen}
            >
              <span
                className={`shrink-0 text-[10px] text-[var(--success)] transition-transform duration-200 ${
                  loggedDetailsOpen ? "rotate-90" : ""
                }`}
                aria-hidden
              >
                ▶
              </span>
              <span className="truncate text-sm font-semibold text-[var(--success)]">Workout logged</span>
            </button>
            <button
              type="button"
              className="btn-ghost shrink-0 px-3 py-1.5 text-xs font-semibold"
              onClick={() => window.location.reload()}
            >
              Open
            </button>
          </div>
          {loggedDetailsOpen && (
            <div className="mt-2 space-y-1 border-t border-[var(--success)]/20 pt-2 text-xs text-[var(--muted)]">
              <p className="font-medium text-[var(--text)]">{workout.workoutName}</p>
              <p>
                {logResult.count > 0
                  ? `${logResult.count} exercise${logResult.count === 1 ? "" : "s"} saved — silhouettes updated.`
                  : "Session progress noted."}
              </p>
              {logResult.progress != null && (
                <p className="text-[var(--success)]">
                  {logResult.progress}% complete
                  {logResult.progress < 100 ? " (partial)" : ""}
                </p>
              )}
              <p>Logged {new Date(logResult.performedAt).toLocaleString()}</p>
            </div>
          )}
          {freeExplorer ? (
            <div className="mt-3">
              <FreePostWorkoutTicketShelf visible />
            </div>
          ) : null}
        </div>
      ) : null}

      {!showLoggedSuccess && !embedded && (
        <>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            {calendarDateLabel ? "Scheduled workout" : "Today\u2019s workout"}
          </p>
          {calendarDateLabel && (
            <p className="mt-1 text-sm font-medium text-[var(--text)]">{calendarDateLabel}</p>
          )}
          {scheduleLabel && (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{scheduleLabel}</p>
          )}
          <h1 className={`${calendarDateLabel ? "mt-2" : "mt-1"} text-2xl font-bold`}>
            {workout.workoutName}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {headerNote ||
              `Hi ${workout.memberName} — follow each exercise. Your last session appears as a faint silhouette behind the active card.`}
          </p>
        </>
      )}
      {!showLoggedSuccess && coachLive && !instructorName && (
        <p className="mt-2 text-xs font-medium text-[var(--success)]">
          Coach is marking your workout live — updates appear almost instantly.
        </p>
      )}
      {!showLoggedSuccess && partnerLive && instructorName && (
        <p className="mt-2 text-xs font-medium text-[var(--success)]">
          Member is logging live — their checkoffs sync here automatically.
        </p>
      )}

      {!showLoggedSuccess ? (
      <>
      {coachRestControls}
      {restTimerUi}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex-1 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--ramp-gold-light)] to-[var(--ramp-gold)] transition-all"
            style={{ width: `${Math.round((finishedExercises.size / workout.exercises.length) * 100)}%` }}
          />
        </div>
        <span className="font-medium text-accent">
          {finishedExercises.size}/{workout.exercises.length}
        </span>
      </div>

      {allExercisesFinished ? (
        <button
          type="button"
          className="member-workout-finished-collapse mt-4 w-full"
          onClick={() => setFinishedListExpanded((open) => !open)}
          aria-expanded={finishedListExpanded}
        >
          <span
            className={`member-workout-finished-collapse__chev ${finishedListExpanded ? "is-open" : ""}`}
            aria-hidden
          >
            ▶
          </span>
          <span className="member-workout-finished-collapse__label">
            {finishedExercises.size} exercises complete
          </span>
          <span className="member-workout-finished-collapse__hint">
            {finishedListExpanded ? "Tap to collapse" : "Tap to review"}
          </span>
        </button>
      ) : null}

      {freeExplorer && freeLockedExerciseIds.size > 0 ? (
        <p className="mt-3 text-[11px] leading-snug text-[var(--muted)]">
          Free Explorer: log the first {freeOpenCount} exercise
          {freeOpenCount === 1 ? "" : "s"} fully — the rest of the day is a preview. Coach Class
          unlocks the full session.
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {workout.exercises.map((block, exerciseIndex) => {
          if (freeLockedExerciseIds.has(block.id)) {
            return (
              <div
                key={block.id}
                id={`member-exercise-${block.id}`}
                className="member-exercise-anchor relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/80 p-3 opacity-90"
              >
                <p className="text-sm font-semibold text-[var(--text)]">{block.name}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  On the board — unlock with Coach Class
                </p>
                <div className="pointer-events-none absolute inset-0 bg-[var(--bg)]/35 backdrop-blur-[1px]" />
                <div className="relative z-10 mt-2">
                  <FreeUpgradeTease
                    compact
                    title="Preview only"
                    body={`Free logs ${FREE_PREVIEW_EXERCISES} moves per open day. This is exercise ${exerciseIndex + 1}.`}
                  />
                </div>
              </div>
            );
          }

          const isFinished =
            finishedExercises.has(block.id) && !reviewMode && editingExerciseId !== block.id;
          const isEditingFinished = editingExerciseId === block.id;

          if (isFinished) {
            if (allExercisesFinished && !finishedListExpanded) return null;
            const loggedWeight = weights[block.id]?.trim();
            return (
              <div
                key={block.id}
                id={`member-exercise-${block.id}`}
                className="member-exercise-anchor"
              >
                <button
                  type="button"
                  className="member-exercise-done w-full text-left"
                  onClick={() => reopenExercise(block.id)}
                  aria-label={`${block.name} completed. Tap to edit weight.`}
                >
                  <span className="member-exercise-done__check" aria-hidden="true">
                    ✓
                  </span>
                  <span className="member-exercise-done__body">
                    <span className="member-exercise-done__name">{block.name}</span>
                    <span className="member-exercise-done__hint">
                      {loggedWeight
                        ? `${loggedWeight} lbs · tap to edit`
                        : "Tap to add or edit weight"}
                    </span>
                  </span>
                </button>
              </div>
            );
          }

          const isActive = block.id === activeId;
          const prescription = normalizePrescription({
            setScheme: block.setScheme,
            repPattern: block.repPattern,
            reps: block.reps,
            sets: block.setCount,
          });
          const isTimed = isTimedApproach(prescription.approach);
          const summary = formatPrescriptionSummary({
            setScheme: block.setScheme,
            repPattern: block.repPattern,
            reps: block.reps,
            sets: block.setCount,
          });
          const doneForBlock = completedSets[block.id] ?? new Set<number>();
          const allSetsDone = isTimed
            ? doneForBlock.has(1)
            : doneForBlock.size >= block.setCount;

          return (
            <section
              key={block.id}
              id={`member-exercise-${block.id}`}
              className="member-exercise-anchor relative"
            >
              {block.past && (
                <div className="member-silhouette" aria-hidden="true">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Past performance
                  </p>
                  <p className="mt-2 text-sm leading-snug">
                    {formatPastPerformance({
                      weightTier: block.past.weightTier,
                      setScheme: block.past.setScheme,
                      repPattern: block.past.repPattern,
                      reps: block.past.reps,
                      sets: block.past.sets,
                      startingWeightLbs: block.past.startingWeightLbs,
                      performedAt: block.past.performedAt,
                    })}
                  </p>
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    {formatPrescriptionSummary(block.past)} ·{" "}
                    {weightTierLabel(block.past.weightTier)}
                  </p>
                </div>
              )}

              <div
                className={`member-active-card ${isActive ? "ring-2 ring-accent" : ""}`}
                onClick={() => setActiveId(block.id)}
                onKeyDown={(e) => e.key === "Enter" && setActiveId(block.id)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold">{block.name}</h2>
                  {isActive && (
                    <span className="rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
                      Now
                    </span>
                  )}
                </div>

                {(block.coachNotes || block.description) && (
                  <div className="mt-2 space-y-1.5">
                    {block.coachNotes ? (
                      <p className="rounded-md border border-violet-500/25 bg-violet-500/10 px-2.5 py-1.5 text-sm text-violet-100">
                        <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300/90">
                          Coach
                        </span>
                        {block.coachNotes}
                      </p>
                    ) : block.description ? (
                      <p className="text-sm text-[color-mix(in_srgb,var(--text)_82%,var(--muted))]">
                        {block.description}
                      </p>
                    ) : null}
                    {block.coachNotes &&
                    block.libraryDescription &&
                    block.libraryDescription !== block.coachNotes ? (
                      <p className="text-sm text-[color-mix(in_srgb,var(--text)_78%,var(--muted))]">
                        {block.libraryDescription}
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="mt-3">
                  {block.videoUrl ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="badge-accent inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:brightness-110"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openVideo(block.id);
                        }}
                      >
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-muted text-xs"
                          aria-hidden="true"
                        >
                          ▶
                        </span>
                        Watch demo
                      </button>
                      <a
                        href={block.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        YouTube link →
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-[color-mix(in_srgb,var(--text)_80%,var(--muted))]">
                      No demo video linked yet — tell your instructor to add one in the exercise library.
                    </p>
                  )}
                </div>

                {/* Compact two-column: scheme info (left) + weight + sets (right) — same row as live floor */}
                <div className="mt-3 flex gap-3 text-sm">
                  {/* Left: Approach / Prescription / Weight tier - tighter */}
                  <div className="w-5/12 space-y-1 rounded-lg bg-[var(--surface-2)] p-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-[color-mix(in_srgb,var(--text)_72%,var(--muted))]">
                        Approach
                      </span>
                      <span className="font-medium text-accent-deep">{approachLabel(prescription.approach)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[color-mix(in_srgb,var(--text)_72%,var(--muted))]">
                        Prescription
                      </span>
                      <span className="font-medium">{summary}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[color-mix(in_srgb,var(--text)_72%,var(--muted))]">
                        Weight tier
                      </span>
                      <span className="font-medium">{weightTierLabel(block.weightTier)}</span>
                    </div>
                  </div>

                  {/* Right: Weight (far left) + set checkoffs — coach live floor uses the same pattern */}
                  <div
                    className="flex-1"
                    onClick={(e) => e.stopPropagation()}
                    role="group"
                    aria-label={`${block.name} weight and ${isTimed ? "timed set" : "set"} completion`}
                  >
                    {isTimed ? (
                      <>
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-sm font-semibold">Weight &amp; timed set</p>
                          <p className="text-xs text-[color-mix(in_srgb,var(--text)_75%,var(--muted))]">
                            {allSetsDone ? "Done" : summary}
                          </p>
                        </div>
                        <div className="member-set-row mt-1">
                          <label
                            className="member-set-weight-box"
                            title={
                              hasLoggedPastWeight(block)
                                ? "Last logged weight for this exercise (edit if needed)"
                                : "Starting guess from weight tier (edit if needed)"
                            }
                          >
                            <input
                              className="member-set-weight-box__input"
                              type="number"
                              inputMode="decimal"
                              aria-label={`${block.name} weight in pounds`}
                              placeholder="—"
                              value={weightValueForBlock(block)}
                              onChange={(e) => updateWeight(block.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              disabled={reviewMode && !instructorName}
                            />
                            <span className="member-set-weight-box__label">
                              {weightBoxLabel(block)}
                            </span>
                          </label>
                          <button
                            type="button"
                            aria-pressed={allSetsDone}
                            className={`member-set-btn text-xs py-0.5 ${allSetsDone ? "member-set-btn--done" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSet(block.id, 1, e.currentTarget);
                            }}
                            disabled={reviewMode && !instructorName}
                          >
                            <span className="member-set-btn__num text-sm">
                              {allSetsDone ? "✓" : "▶"}
                            </span>
                            <span className="member-set-btn__label">
                              {allSetsDone ? "Done" : "Mark"}
                            </span>
                          </button>
                        </div>
                        {(() => {
                          const holdSec = exerciseHoldDurationSec(block);
                          if (!holdSec) return null;
                          const restS = resolveSecondsForBlock(block);
                          return (
                            <p className="mt-1 text-xs text-[color-mix(in_srgb,var(--text)_78%,var(--muted))]">
                              Green hold {holdSec >= 60 ? `${Math.round(holdSec / 60)} min` : `${holdSec}s`}
                              {restS ? ` → rest ${restS}s` : ""} · uncheck stays off until you re-mark
                            </p>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-sm font-semibold">Weight &amp; sets</p>
                          <p className="text-xs text-[color-mix(in_srgb,var(--text)_75%,var(--muted))]">
                            {doneForBlock.size}/{block.setCount}
                          </p>
                        </div>
                        <div className="member-set-row mt-1">
                          <label
                            className="member-set-weight-box"
                            title={
                              hasLoggedPastWeight(block)
                                ? "Last logged weight for this exercise (edit if needed)"
                                : "Starting guess from weight tier (edit if needed)"
                            }
                          >
                            <input
                              className="member-set-weight-box__input"
                              type="number"
                              inputMode="decimal"
                              aria-label={`${block.name} weight in pounds`}
                              placeholder="—"
                              value={weightValueForBlock(block)}
                              onChange={(e) => updateWeight(block.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              disabled={reviewMode && !instructorName}
                            />
                            <span className="member-set-weight-box__label">
                              {weightBoxLabel(block)}
                            </span>
                          </label>
                          {Array.from({ length: block.setCount }, (_, i) => {
                            const setNum = i + 1;
                            const done = doneForBlock.has(setNum);
                            return (
                              <button
                                key={setNum}
                                type="button"
                                aria-pressed={done}
                                aria-label={`Set ${setNum}${done ? ", completed" : ""}`}
                                className={`member-set-btn text-xs py-0.5 ${done ? "member-set-btn--done" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSet(block.id, setNum, e.currentTarget);
                                }}
                                disabled={reviewMode && !instructorName}
                              >
                                <span className="member-set-btn__num text-sm">
                                  {done ? "✓" : setNum}
                                </span>
                                <span className="member-set-btn__label">Set</span>
                              </button>
                            );
                          })}
                        </div>
                        {(() => {
                          const holdSec = exerciseHoldDurationSec(block);
                          const restS = resolveSecondsForBlock(block);
                          if (holdSec) {
                            return (
                              <p className="mt-1 text-xs text-[color-mix(in_srgb,var(--text)_78%,var(--muted))]">
                                Green hold {holdSec >= 60 ? `${Math.round(holdSec / 60)} min` : `${holdSec}s`}
                                {restS ? ` → rest ${restS}s` : ""} · uncheck stays off until you re-mark
                              </p>
                            );
                          }
                          if (!restS) return null;
                          return (
                            <p className="mt-1 text-xs text-[color-mix(in_srgb,var(--text)_78%,var(--muted))]">
                              Rest {restS}s — opens on set, closes when it buzzes
                            </p>
                          );
                        })()}
                      </>
                    )}
                    {allSetsDone && (
                      <p className="mt-1 text-center text-xs font-medium text-[var(--ramp-gold-light)]">
                        {isTimed ? "Timed complete" : "Sets logged"}
                      </p>
                    )}
                  </div>
                </div>

                {/* (weight input moved above the sets grid for prominence) */}

                {/* Peek next exercise - space efficient teaser */}
                {nextExercise && isActive && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-[color-mix(in_srgb,var(--text)_78%,var(--muted))]">
                    <span>Next:</span>{" "}
                    <span className="font-medium text-[var(--text)] truncate">{nextExercise.name}</span>
                  </div>
                )}

                {isEditingFinished ? (
                  <button
                    type="button"
                    className="btn-primary mt-3 w-full text-sm py-1.5"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      closeExerciseEdit();
                    }}
                    disabled={reviewMode && !instructorName}
                  >
                    Done editing
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary mt-3 w-full text-sm py-1.5"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markExerciseFinished(block.id);
                    }}
                    disabled={reviewMode && !instructorName}
                  >
                    {reviewMode && !instructorName
                      ? "Session already logged (review)"
                      : instructorName
                        ? "Mark done for member"
                        : "Exercise finished"}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      </>
      ) : null}

      {!showLoggedSuccess && !reviewMode && !hideLogButton ? (
        <button
          type="button"
          className="btn-primary mt-10 w-full"
          onClick={handleLogComplete}
          disabled={isLogging}
        >
          {isLogging ? "Saving your session..." : "Log workout complete"}
        </button>
      ) : null}

      {videoModalBlock?.videoUrl && (
        <MemberExerciseVideoModal
          exerciseName={videoModalBlock.name}
          videoUrl={videoModalBlock.videoUrl}
          onClose={() => setVideoModalBlockId(null)}
        />
      )}
    </div>
  );
}