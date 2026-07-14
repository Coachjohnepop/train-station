"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TimeScrollPicker from "@/components/TimeScrollPicker";
import type { CoachMemberOption } from "@/components/CoachMemberPicker";
import ExerciseCatalogMatchList, {
  ExerciseCatalogMatchSummary,
  NewExerciseReviewLink,
} from "@/components/ExerciseCatalogMatchList";
import WorkoutBuilder from "@/components/WorkoutBuilder";
import type { LessonPlanQuestion } from "@/lib/lesson-plan-interpreter";
import type { WorkoutCatalogPreview } from "@/lib/exercise-catalog-preview-types";
import type { TodaySession } from "@/lib/today-sessions";
import {
  DEFAULT_REST_TIMER_SECONDS,
  REST_TIMER_PRESETS,
} from "@/lib/rest-timer";


type ParsedExercise = {
  name: string;
  sets: number;
  reps: string;
  notes?: string;
  section?: string;
};

type InterpretResponse = {
  normalizedText: string;
  workout: { title: string; exercises: ParsedExercise[] };
  questions: LessonPlanQuestion[];
  includeWarmup: boolean;
  warmupInjected: boolean;
  usedAi: boolean;
  confidence: "high" | "medium" | "low";
  catalogPreview?: WorkoutCatalogPreview;
};

type IndividualDraft = {
  userId: string;
  rawSms: string;
  useCustom: boolean;
};

const STEPS = ["Write plan", "Edit workout", "Assign class", "Published"] as const;

export default function CoachLessonPlanBuilder({
  sessionDate,
  viewDateLabel,
  memberOptions,
  savedSessions = [],
  defaultTime = "06:30",
  embedded = false,
  onPublished,
}: {
  sessionDate: string;
  viewDateLabel: string;
  memberOptions: CoachMemberOption[];
  savedSessions?: TodaySession[];
  defaultTime?: string;
  embedded?: boolean;
  onPublished?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [rawText, setRawText] = useState("");
  const [includeWarmup, setIncludeWarmup] = useState(true);
  const [scheduledTime, setScheduledTime] = useState(defaultTime);
  const [templateMemberId, setTemplateMemberId] = useState<string>("");
  const [cascadeIds, setCascadeIds] = useState<string[]>([]);
  const [individualDrafts, setIndividualDrafts] = useState<IndividualDraft[]>([]);
  const [interpretation, setInterpretation] = useState<InterpretResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sendSmsAlert, setSendSmsAlert] = useState(true);
  const [restTimerEnabled, setRestTimerEnabled] = useState(false);
  const [restTimerSeconds, setRestTimerSeconds] = useState(DEFAULT_REST_TIMER_SECONDS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [deployResult, setDeployResult] = useState<{
    cascadeNames: string[];
    individualNames: string[];
    built: number;
  } | null>(null);
  const [newExerciseCount, setNewExerciseCount] = useState(0);
  const [draftWorkoutId, setDraftWorkoutId] = useState<string | null>(null);
  /** Plan text used to build the current draft — re-interpret with different text gets a new draft. */
  const [draftSourceText, setDraftSourceText] = useState<string | null>(null);

  const templateMember = memberOptions.find((m) => m.id === templateMemberId);

  const unassignedMembers = useMemo(() => {
    const assigned = new Set([
      ...cascadeIds,
      ...individualDrafts.filter((d) => d.useCustom).map((d) => d.userId),
    ]);
    return memberOptions.filter((m) => !assigned.has(m.id));
  }, [memberOptions, cascadeIds, individualDrafts]);

  useEffect(() => {
    if (step !== 2 || cascadeIds.length > 0 || memberOptions.length === 0) return;
    setCascadeIds(memberOptions.map((m) => m.id));
  }, [step, cascadeIds.length, memberOptions]);

  async function openDraftEditor(
    data: InterpretResponse,
    priorQuestions: LessonPlanQuestion[] = [],
  ) {
    setLoading(true);
    setMessage(null);
    setError(false);
    try {
      const res = await fetch("/api/today/lesson-plan/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawText.trim(),
          includeWarmup,
          templateMemberName: templateMember?.name,
          answers,
          priorQuestions,
          workoutId:
            draftWorkoutId && rawText.trim() === draftSourceText
              ? draftWorkoutId
              : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(true);
        setMessage(body.error || "Could not open workout editor.");
        return;
      }
      setDraftWorkoutId(body.workoutId);
      setDraftSourceText(rawText.trim());
      setInterpretation({
        ...(body.interpretation as InterpretResponse),
        catalogPreview: body.catalogPreview ?? data.catalogPreview,
      });
      setMessage("Edit the workout below — same editor as the workout library.");
      setStep(1);
    } catch (e: unknown) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function continueToAssign() {
    if (!draftWorkoutId) return;
    try {
      const res = await fetch(`/api/workouts/${draftWorkoutId}`, { cache: "no-store" });
      const w = await res.json().catch(() => null);
      if (res.ok && w?.name && interpretation) {
        setInterpretation({
          ...interpretation,
          workout: { ...interpretation.workout, title: w.name },
        });
      }
    } catch {
      /* non-fatal */
    }
    setStep(2);
    setMessage(null);
    setError(false);
  }

  useEffect(() => {
    setIndividualDrafts((prev) => {
      const map = new Map(prev.map((d) => [d.userId, d]));
      return memberOptions.map((m) => {
        const existing = map.get(m.id);
        return (
          existing ?? {
            userId: m.id,
            rawSms: "",
            useCustom: false,
          }
        );
      });
    });
  }, [memberOptions]);

  async function runInterpret(nextAnswers?: Record<string, string>) {
    if (!rawText.trim()) return;
    setLoading(true);
    setMessage(null);
    setError(false);
    try {
      const res = await fetch("/api/today/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawText.trim(),
          includeWarmup,
          templateMemberName: templateMember?.name,
          answers: nextAnswers ?? answers,
          priorQuestions: interpretation?.questions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(true);
        setMessage(data.error || "Could not interpret lesson plan.");
        return;
      }
      setInterpretation(data);
      if (data.questions?.length > 0 && (!nextAnswers || Object.keys(nextAnswers).length === 0)) {
        const initial: Record<string, string> = {};
        for (const q of data.questions as LessonPlanQuestion[]) {
          if (q.choices?.length) initial[q.id] = q.choices[0];
        }
        setAnswers(initial);
        setMessage(
          data.usedAi
            ? "Grok read your plan — answer any questions below, then continue."
            : "Almost there — a few quick questions so we build the right workout.",
        );
      } else {
        await openDraftEditor(data, data.questions ?? []);
      }
    } catch (e: unknown) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswerAndContinue() {
    setLoading(true);
    setMessage(null);
    setError(false);
    try {
      const res = await fetch("/api/today/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawText.trim(),
          includeWarmup,
          templateMemberName: templateMember?.name,
          answers,
          priorQuestions: interpretation?.questions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(true);
        setMessage(data.error || "Could not apply answers.");
        return;
      }
      setInterpretation(data);
      if (!data.questions?.length) {
        await openDraftEditor(data, interpretation?.questions ?? []);
      } else {
        setError(true);
        setMessage("Still need a few details — update your answers above.");
      }
    } catch (e: unknown) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  function toggleCascade(id: string) {
    setCascadeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setIndividualDrafts((prev) =>
      prev.map((d) => (d.userId === id ? { ...d, useCustom: false, rawSms: "" } : d)),
    );
  }

  function toggleIndividual(userId: string) {
    setIndividualDrafts((prev) =>
      prev.map((d) =>
        d.userId === userId
          ? { ...d, useCustom: !d.useCustom, rawSms: d.useCustom ? "" : d.rawSms }
          : d,
      ),
    );
    if (!individualDrafts.find((d) => d.userId === userId)?.useCustom) {
      setCascadeIds((prev) => prev.filter((x) => x !== userId));
    }
  }

  function cascadeFromTemplate() {
    if (!templateMemberId) return;
    const others = memberOptions
      .filter((m) => m.id !== templateMemberId)
      .map((m) => m.id);
    setCascadeIds([templateMemberId, ...others]);
    setIndividualDrafts((prev) =>
      prev.map((d) => ({ ...d, useCustom: false, rawSms: "" })),
    );
  }

  const matchingSavedSession = useMemo(() => {
    const normalized = interpretation?.normalizedText?.trim() || rawText.trim();
    const key = normalized.replace(/\r\n/g, "\n");
    if (!key) return null;
    return (
      savedSessions.find((s) => s.rawSms.trim().replace(/\r\n/g, "\n") === key) ?? null
    );
  }, [interpretation?.normalizedText, rawText, savedSessions]);

  async function handleDeploy() {
    if (!draftWorkoutId && !matchingSavedSession?.workoutId) {
      setError(true);
      setMessage("Open the workout editor first — edits there become today's class workout.");
      return;
    }

    const individuals = individualDrafts
      .filter((d) => d.useCustom && d.rawSms.trim())
      .map((d) => ({ userId: d.userId, rawSms: d.rawSms.trim() }));

    if (cascadeIds.length === 0 && individuals.length === 0) {
      setError(true);
      setMessage("Pick who gets the cascade workout or mark students for individual plans.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(false);

    const scheduled = new Date(`${sessionDate}T${scheduledTime}:00`);
    if (Number.isNaN(scheduled.getTime())) {
      setSaving(false);
      setError(true);
      setMessage("Invalid scheduled time.");
      return;
    }

    const normalized = interpretation?.normalizedText?.trim() || rawText.trim();

    try {
      const res = await fetch("/api/today/cascade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate,
          scheduledAt: scheduled.toISOString(),
          sendSmsAlert,
          restTimer: restTimerEnabled
            ? { enabled: true, seconds: restTimerSeconds }
            : { enabled: false, seconds: restTimerSeconds },
          cascade:
            cascadeIds.length > 0
              ? {
                  rawSms: normalized,
                  userIds: cascadeIds,
                  title: interpretation?.workout?.title,
                  workoutId: draftWorkoutId || matchingSavedSession?.workoutId,
                }
              : undefined,
          individuals,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(true);
        setMessage(data.error || "Deploy failed.");
        return;
      }
      const cascadeNames = memberOptions
        .filter((m) => cascadeIds.includes(m.id))
        .map((m) => m.name);
      const individualNames = memberOptions
        .filter((m) => individuals.some((i) => i.userId === m.id))
        .map((m) => m.name);
      const created = Array.isArray(data.newExerciseIds) ? data.newExerciseIds.length : 0;
      setNewExerciseCount(created);
      setDeployResult({
        cascadeNames,
        individualNames,
        built: data.built ?? 1,
      });
      setMessage(null);
      setError(false);
      setStep(3);
      setSaving(false);
      onPublished?.();
      void router.refresh();
      return;
    } catch (e: unknown) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Deploy failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => i < step && setStep(i)}
            className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
              i === step
                ? "border-accent bg-accent/20 text-accent"
                : i < step
                  ? "border-[var(--border)] text-[var(--muted)] hover:text-accent"
                  : "border-[var(--border)] text-[var(--muted)] opacity-50"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="card border-[#7c3aed]/40 bg-[#7c3aed]/5 space-y-4">
          <div>
            <h2 className="font-semibold text-lg">Lesson plan</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Type or paste from voice-to-text — however you send workouts to John today. Grok interprets
              it, asks questions if something is unclear, and builds the session.
            </p>
          </div>

          <p className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
            Publishing to <strong>{viewDateLabel}</strong> — switch days with the square buttons above
          </p>

          <label className="block text-xs">
            <span className="text-[var(--muted)]">Built around student (optional)</span>
            <select
              className="input mt-1 w-full"
              value={templateMemberId}
              onChange={(e) => setTemplateMemberId(e.target.value)}
            >
              <option value="">General class plan</option>
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-[var(--muted)]">
              Pick Stephanie (or anyone) as the template — you can cascade the same workout to others
              later or fork individuals with special needs.
            </span>
          </label>

          <textarea
            className="input min-h-[220px] w-full resize-y text-sm leading-relaxed"
            placeholder={`Example:\n\nLower Day\n\nLeg press 4 sets\n10,10,10,10\n\nBarbell hip thrust 4 sets\nBulgarian split squats 3 each leg\n\nHIIT jump squats 8 rounds 20 sec on`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={includeWarmup}
              onChange={(e) => setIncludeWarmup(e.target.checked)}
            />
            Add standard warm-up if missing (wall taps, bands, light curls, Bosu/jump squats — bonus points
            if members finish before you arrive)
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runInterpret()}
              disabled={loading || !rawText.trim()}
              className="btn-primary px-4 py-2 text-sm"
            >
              {loading ? "Reading plan…" : "Interpret plan"}
            </button>
          </div>

          {interpretation && interpretation.questions.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-4">
              <p className="text-sm font-semibold text-amber-200">Quick questions</p>
              {interpretation.questions.map((q) => (
                <div key={q.id} className="space-y-1">
                  <p className="text-xs font-medium">{q.prompt}</p>
                  {q.hint && <p className="text-[10px] text-[var(--muted)]">{q.hint}</p>}
                  {q.choices?.length ? (
                    <select
                      className="input w-full text-sm"
                      value={answers[q.id] ?? q.choices[0]}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    >
                      {q.choices.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input w-full text-sm"
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="Your answer"
                    />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAnswerAndContinue}
                disabled={loading}
                className="btn-primary px-4 py-1.5 text-sm"
              >
                {loading ? "Opening editor…" : "Apply answers & open editor"}
              </button>
            </div>
          )}
        </div>
      )}

      {step === 1 && draftWorkoutId && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setStep(0)} className="btn-ghost text-xs px-2 py-1">
              ← Edit plan text
            </button>
            {interpretation?.catalogPreview ? (
              <ExerciseCatalogMatchSummary preview={interpretation.catalogPreview} compact />
            ) : null}
          </div>
          <WorkoutBuilder
            workoutId={draftWorkoutId}
            embedded
            onContinue={() => void continueToAssign()}
            continueLabel="Assign to class →"
            headerNote={
              interpretation?.catalogPreview ? (
                <ExerciseCatalogMatchList
                  preview={interpretation.catalogPreview}
                  showSets={false}
                />
              ) : (
                <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                  Same workout editor as <strong>Admin → Workouts</strong> — add, edit setup, remove,
                  rename. Changes save to today&apos;s class automatically.
                </p>
              )
            }
          />
        </div>
      )}

      {step === 2 && (
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold text-lg">Assign class</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Cascade the same workout to a group, or mark students who need their own plan (injuries,
              different goals).
            </p>
            {interpretation?.catalogPreview ? (
              <div className="mt-3">
                <ExerciseCatalogMatchSummary preview={interpretation.catalogPreview} compact />
                {interpretation.catalogPreview.summary.newCount > 0 ? (
                  <p className="mt-1 text-[10px] text-amber-200/90">
                    Deploy will add {interpretation.catalogPreview.summary.newCount} exercise
                    {interpretation.catalogPreview.summary.newCount !== 1 ? "s" : ""} to Admin →
                    Exercises.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <label className="block text-xs">
            <span className="text-[var(--muted)]">Session time</span>
            <TimeScrollPicker className="mt-2" value={scheduledTime} onChange={setScheduledTime} />
          </label>

          <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-accent">Cascade — same workout</p>
              {templateMemberId && (
                <button type="button" onClick={cascadeFromTemplate} className="btn-ghost text-xs px-2 py-1">
                  Everyone except custom
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {memberOptions.map((m) => {
                const on = cascadeIds.includes(m.id);
                const isCustom = individualDrafts.find((d) => d.userId === m.id)?.useCustom;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={isCustom}
                    onClick={() => toggleCascade(m.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                      isCustom
                        ? "opacity-40 cursor-not-allowed border-[var(--border)]"
                        : on
                          ? "border-accent bg-accent/20 text-accent"
                          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {m.name}
                  </button>
                );
              })}
            </div>
            {cascadeIds.length > 0 && (
              <p className="text-[10px] text-[var(--success)]">
                {cascadeIds.length} student{cascadeIds.length !== 1 ? "s" : ""} get the same workout
              </p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Individual — custom plan</p>
            {memberOptions.map((m) => {
              const draft = individualDrafts.find((d) => d.userId === m.id);
              if (!draft) return null;
              return (
                <div
                  key={m.id}
                  className={`rounded-lg border p-3 ${
                    draft.useCustom ? "border-amber-500/40 bg-amber-500/5" : "border-[var(--border)]"
                  }`}
                >
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.useCustom}
                      onChange={() => toggleIndividual(m.id)}
                    />
                    {m.name} — different workout
                  </label>
                  {draft.useCustom && (
                    <textarea
                      className="input mt-2 min-h-[100px] w-full text-xs"
                      placeholder={`Custom plan for ${m.name}…`}
                      value={draft.rawSms}
                      onChange={(e) =>
                        setIndividualDrafts((prev) =>
                          prev.map((d) =>
                            d.userId === m.id ? { ...d, rawSms: e.target.value } : d,
                          ),
                        )
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>

          {unassignedMembers.length > 0 && (
            <p className="text-xs text-amber-300">
              Not assigned yet: {unassignedMembers.map((m) => m.name).join(", ")}
            </p>
          )}

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={restTimerEnabled}
                onChange={(e) => setRestTimerEnabled(e.target.checked)}
              />
              Rest timer between sets
            </label>
            {restTimerEnabled ? (
              <label className="block text-xs">
                <span className="text-[var(--muted)]">Countdown after each set (whole workout)</span>
                <select
                  className="input mt-1 w-full text-sm"
                  value={restTimerSeconds}
                  onChange={(e) => setRestTimerSeconds(Number(e.target.value))}
                >
                  {REST_TIMER_PRESETS.map((preset) => (
                    <option key={preset.seconds} value={preset.seconds}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <p className="text-[10px] text-[var(--muted)]">
              When on, coach and member see an automatic countdown on Go to Today after each set
              is checked off.
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={sendSmsAlert}
              onChange={(e) => setSendSmsAlert(e.target.checked)}
            />
            SMS alert with link to Go to Today
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStep(1)} className="btn-ghost text-sm px-3 py-1">
              ← Edit workout
            </button>
            <button
              type="button"
              onClick={handleDeploy}
              disabled={saving}
              className="btn-primary px-4 py-2 text-sm"
            >
              {saving
                ? matchingSavedSession
                  ? "Publishing…"
                  : "Building workout…"
                : matchingSavedSession
                  ? "Publish saved class"
                  : "Deploy to students"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && deployResult && (
        <div className="card space-y-4 border-emerald-500/35 bg-emerald-500/10">
          <div>
            <h2 className="font-semibold text-lg text-emerald-100">Published</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Built {deployResult.built} workout{deployResult.built !== 1 ? "s" : ""} for{" "}
              {viewDateLabel}. Students below should see it on Go to Today.
            </p>
            <NewExerciseReviewLink count={newExerciseCount} className="mt-2 inline-block text-xs font-medium text-accent hover:underline" />
          </div>
          {deployResult.cascadeNames.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Same workout ({deployResult.cascadeNames.length})
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {deployResult.cascadeNames.map((name) => (
                  <li
                    key={name}
                    className="rounded-full border border-emerald-500/30 bg-[var(--surface)] px-3 py-1 text-xs"
                  >
                    ✓ {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {deployResult.individualNames.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Individual plans ({deployResult.individualNames.length})
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {deployResult.individualNames.map((name) => (
                  <li
                    key={name}
                    className="rounded-full border border-amber-500/30 bg-[var(--surface)] px-3 py-1 text-xs"
                  >
                    ✓ {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/today" className="btn-primary px-4 py-2 text-sm">
              Open floor (Go to Today) →
            </Link>
            <Link href="/admin/day" className="btn-ghost px-4 py-2 text-sm">
              Stay on Dashboard
            </Link>
            <button
              type="button"
              className="btn-ghost px-4 py-2 text-sm"
              onClick={() => {
                setDeployResult(null);
                setNewExerciseCount(0);
                setDraftWorkoutId(null);
                setDraftSourceText(null);
                setRawText("");
                setInterpretation(null);
                setCascadeIds([]);
                setStep(0);
              }}
            >
              {embedded ? "Plan another workout" : "Plan another day"}
            </button>
          </div>
        </div>
      )}

      {message && step !== 3 && (
        <p className={`text-sm ${error ? "text-red-400" : "text-[var(--success)]"}`}>{message}</p>
      )}

      {!embedded && process.env.NEXT_PUBLIC_XAI_LESSON_PLAN_HINT !== "off" && (
        <p className="text-[10px] text-[var(--muted)]">
          Set <code className="text-[10px]">XAI_API_KEY</code> in Vercel for Grok interpretation.
        </p>
      )}
    </div>
  );
}