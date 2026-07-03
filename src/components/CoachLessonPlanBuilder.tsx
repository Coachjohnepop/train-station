"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TimeScrollPicker from "@/components/TimeScrollPicker";
import type { CoachMemberOption } from "@/components/CoachMemberPicker";
import type { LessonPlanQuestion } from "@/lib/lesson-plan-interpreter";
import type { TodaySession } from "@/lib/today-sessions";
import {
  DEFAULT_REST_TIMER_SECONDS,
  REST_TIMER_PRESETS,
} from "@/lib/rest-timer";
import {
  formatParsedWorkoutAsSms,
  resolveCertifiedExportText,
  validateWorkoutExportText,
  type WorkoutExportValidation,
} from "@/lib/workout-export";
import type { ParsedSmsWorkout } from "@/lib/sms-workout-parser";

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
};

type IndividualDraft = {
  userId: string;
  rawSms: string;
  useCustom: boolean;
};

const STEPS = ["Write plan", "Review", "Certify", "Assign class", "Published"] as const;

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
  const [exportDraftText, setExportDraftText] = useState("");
  const [exportValidation, setExportValidation] = useState<WorkoutExportValidation | null>(null);
  const [exportSource, setExportSource] = useState<"normalized" | "formatted" | "manual">("normalized");
  const [certified, setCertified] = useState(false);
  const [certifiedExportText, setCertifiedExportText] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const templateMember = memberOptions.find((m) => m.id === templateMemberId);

  const unassignedMembers = useMemo(() => {
    const assigned = new Set([
      ...cascadeIds,
      ...individualDrafts.filter((d) => d.useCustom).map((d) => d.userId),
    ]);
    return memberOptions.filter((m) => !assigned.has(m.id));
  }, [memberOptions, cascadeIds, individualDrafts]);

  useEffect(() => {
    if (step !== 3 || cascadeIds.length > 0 || memberOptions.length === 0) return;
    setCascadeIds(memberOptions.map((m) => m.id));
  }, [step, cascadeIds.length, memberOptions]);

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
        setMessage(
          data.warmupInjected
            ? "Standard warm-up added. Review the workout, then certify the export."
            : "Workout ready — review below, then certify the export.",
        );
        setStep(1);
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
        setMessage("Workout ready — review below, then certify the export.");
        setStep(1);
      } else {
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

  const parsedWorkoutForExport = useMemo((): ParsedSmsWorkout | null => {
    if (!interpretation?.workout) return null;
    return {
      title: interpretation.workout.title,
      exercises: interpretation.workout.exercises as ParsedSmsWorkout["exercises"],
      rawText: interpretation.normalizedText?.trim() || rawText.trim(),
    };
  }, [interpretation, rawText]);

  const matchingSavedSession = useMemo(() => {
    const normalized = certifiedExportText.trim() || interpretation?.normalizedText?.trim() || rawText.trim();
    const key = normalized.replace(/\r\n/g, "\n");
    if (!key) return null;
    return (
      savedSessions.find((s) => s.rawSms.trim().replace(/\r\n/g, "\n") === key) ?? null
    );
  }, [certifiedExportText, interpretation?.normalizedText, rawText, savedSessions]);

  function primeCertifyExport() {
    if (!parsedWorkoutForExport) return;
    const resolved = resolveCertifiedExportText(
      interpretation?.normalizedText,
      parsedWorkoutForExport,
    );
    setExportDraftText(resolved.text);
    setExportValidation(resolved.validation);
    setExportSource(resolved.source);
    setCertified(false);
    setCertifiedExportText("");
    setCopyState("idle");
  }

  function revalidateExportDraft(text = exportDraftText) {
    if (!parsedWorkoutForExport) return null;
    const validation = validateWorkoutExportText(text, parsedWorkoutForExport);
    setExportValidation(validation);
    return validation;
  }

  function handleCertifyWorkout() {
    const validation = revalidateExportDraft();
    if (!validation?.ok) {
      setError(true);
      setMessage("Fix export issues before certifying — re-parse must match this workout.");
      return;
    }
    setCertified(true);
    setCertifiedExportText(validation.exportText);
    setExportSource("manual");
    setError(false);
    setMessage("Workout certified — export text is ready for re-ingest. Continue to assign your class.");
  }

  async function copyExportText() {
    try {
      await navigator.clipboard.writeText(exportDraftText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
    }
  }

  function downloadExportText() {
    const blob = new Blob([exportDraftText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const slug = (workout?.title || "workout")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    anchor.href = url;
    anchor.download = `${slug || "workout"}-certified.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeploy() {
    const normalized = certifiedExportText.trim() || interpretation?.normalizedText?.trim() || rawText.trim();
    if (!normalized) return;
    if (!certified) {
      setError(true);
      setMessage("Certify the workout before deploying to students.");
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
                  workoutId: matchingSavedSession?.workoutId,
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
      setDeployResult({
        cascadeNames,
        individualNames,
        built: data.built ?? 1,
      });
      setMessage(null);
      setError(false);
      setStep(4);
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

  const workout = interpretation?.workout;
  const warmups = workout?.exercises.filter((e) => e.section === "warmup") ?? [];
  const main = workout?.exercises.filter((e) => e.section !== "warmup" && e.section !== "cooldown") ?? [];
  const cooldown = workout?.exercises.filter((e) => e.section === "cooldown") ?? [];

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
                Apply answers &amp; preview workout
              </button>
            </div>
          )}
        </div>
      )}

      {step === 1 && workout && (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-lg">{workout.title}</h2>
              <p className="text-xs text-[var(--muted)]">
                {workout.exercises.length} blocks
                {interpretation?.usedAi ? " · Grok" : " · rules"}
                {interpretation?.confidence && ` · ${interpretation.confidence} confidence`}
              </p>
            </div>
            <button type="button" onClick={() => setStep(0)} className="btn-ghost text-xs px-2 py-1">
              ← Edit plan
            </button>
          </div>

          {warmups.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-emerald-400 mb-2">Warm-up · bonus if done early</p>
              <ul className="space-y-1 text-sm">
                {warmups.map((ex, i) => (
                  <li key={i} className="text-[var(--muted)]">
                    {ex.name}
                    {ex.notes && <span className="block text-[10px]">{ex.notes}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <p className="text-xs font-semibold text-accent mb-2">Main workout</p>
            <ul className="space-y-2 text-sm max-h-64 overflow-auto">
              {main.map((ex, i) => (
                <li key={i} className="border-b border-[var(--border)] pb-2">
                  <span className="font-medium">{ex.name}</span>
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {ex.sets} set{ex.sets !== 1 ? "s" : ""} · {ex.reps}
                  </span>
                  {ex.notes && <p className="text-[10px] text-[var(--muted)]">{ex.notes}</p>}
                </li>
              ))}
            </ul>
          </section>

          {cooldown.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-[var(--muted)] mb-2">Cool-down</p>
              <ul className="text-sm text-[var(--muted)]">
                {cooldown.map((ex, i) => (
                  <li key={i}>{ex.name}</li>
                ))}
              </ul>
            </section>
          )}

          <button
            type="button"
            onClick={() => {
              primeCertifyExport();
              setStep(2);
            }}
            className="btn-primary px-4 py-2 text-sm"
          >
            Certify workout →
          </button>
        </div>
      )}

      {step === 2 && workout && parsedWorkoutForExport && (
        <div className="card space-y-4 border-violet-500/30 bg-violet-500/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-lg">Certify workout</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Lock the export text coaches can paste back into the lesson plan box. We re-parse it
                here to confirm perfect ingest before you assign students.
              </p>
            </div>
            <button type="button" onClick={() => setStep(1)} className="btn-ghost text-xs px-2 py-1">
              ← Review
            </button>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Certified export text
              </p>
              <span className="text-[10px] text-[var(--muted)]">
                Source:{" "}
                {exportSource === "formatted"
                  ? "auto-formatted from blocks"
                  : exportSource === "manual"
                    ? "certified copy"
                    : "interpreted plan"}
              </span>
            </div>
            <textarea
              className="input min-h-[280px] w-full resize-y font-mono text-xs leading-relaxed"
              value={exportDraftText}
              onChange={(e) => {
                setExportDraftText(e.target.value);
                setCertified(false);
                setCertifiedExportText("");
                setExportSource("manual");
                setCopyState("idle");
              }}
              onBlur={() => revalidateExportDraft()}
              spellCheck={false}
            />
            <p className="text-[10px] text-[var(--muted)]">
              Paste this into <strong>Write plan</strong> later — one exercise per block, sets/reps on
              their own lines, same format Jeremy uses today.
            </p>
          </div>

          <div
            className={`rounded-lg border p-3 ${
              exportValidation?.ok
                ? "border-emerald-500/35 bg-emerald-500/10"
                : "border-amber-500/35 bg-amber-500/10"
            }`}
          >
            <p className="text-xs font-semibold">
              {exportValidation?.ok ? "Re-parse check passed" : "Re-parse check needs attention"}
            </p>
            {exportValidation?.ok ? (
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                {exportValidation.reparsed.exercises.length} blocks · title &quot;
                {exportValidation.reparsed.title}&quot; · ready to paste back in.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-[10px] text-amber-100">
                {(exportValidation?.issues ?? ["Run validation after editing export text."]).map(
                  (issue) => (
                    <li key={issue}>• {issue}</li>
                  ),
                )}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost text-xs px-2 py-1"
                onClick={() => revalidateExportDraft()}
              >
                Re-validate export
              </button>
              {!exportValidation?.ok && parsedWorkoutForExport ? (
                <button
                  type="button"
                  className="btn-ghost text-xs px-2 py-1"
                  onClick={() => {
                    const formatted = formatParsedWorkoutAsSms(parsedWorkoutForExport);
                    setExportDraftText(formatted);
                    setExportSource("formatted");
                    setCertified(false);
                    setCertifiedExportText("");
                    revalidateExportDraft(formatted);
                  }}
                >
                  Use auto-formatted export
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyExportText()} className="btn-ghost text-sm px-3 py-1.5">
              {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy export"}
            </button>
            <button type="button" onClick={downloadExportText} className="btn-ghost text-sm px-3 py-1.5">
              Download .txt
            </button>
            <button
              type="button"
              onClick={handleCertifyWorkout}
              disabled={!exportValidation?.ok}
              className="btn-primary px-4 py-2 text-sm"
            >
              {certified ? "Certified ✓" : "Certify workout"}
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!certified}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              Assign to class →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold text-lg">Assign class</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Cascade the same workout to a group, or mark students who need their own plan (injuries,
              different goals).
            </p>
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
            <button type="button" onClick={() => setStep(2)} className="btn-ghost text-sm px-3 py-1">
              ← Certify workout
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

      {step === 4 && deployResult && (
        <div className="card space-y-4 border-emerald-500/35 bg-emerald-500/10">
          <div>
            <h2 className="font-semibold text-lg text-emerald-100">Published</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Built {deployResult.built} workout{deployResult.built !== 1 ? "s" : ""} for{" "}
              {viewDateLabel}. Students below should see it on Go to Today.
            </p>
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
              Go to Today →
            </Link>
            <button
              type="button"
              className="btn-ghost px-4 py-2 text-sm"
              onClick={() => {
                setDeployResult(null);
                setRawText("");
                setInterpretation(null);
                setCascadeIds([]);
                setCertified(false);
                setCertifiedExportText("");
                setExportDraftText("");
                setExportValidation(null);
                setStep(0);
              }}
            >
              {embedded ? "Plan another workout" : "Plan another day"}
            </button>
          </div>
        </div>
      )}

      {message && step !== 4 && (
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