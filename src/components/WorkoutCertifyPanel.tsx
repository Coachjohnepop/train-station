"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatParsedWorkoutAsSms,
  resolveCertifiedExportText,
  validateWorkoutExportText,
  type WorkoutExportValidation,
} from "@/lib/workout-export";
import type { ParsedSmsWorkout } from "@/lib/sms-workout-parser";

type Props = {
  workoutId: string;
  parsedWorkout: ParsedSmsWorkout;
  savedExportText?: string | null;
  savedCertifiedAt?: string | null;
  onCertified?: (exportText: string) => void;
  disabled?: boolean;
  /** Open the panel on load (e.g. fresh text-upload workouts). */
  defaultOpen?: boolean;
};

export default function WorkoutCertifyPanel({
  workoutId,
  parsedWorkout,
  savedExportText,
  savedCertifiedAt,
  onCertified,
  disabled = false,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen || Boolean(savedCertifiedAt));
  const [exportDraftText, setExportDraftText] = useState("");
  const [exportValidation, setExportValidation] = useState<WorkoutExportValidation | null>(null);
  const [exportSource, setExportSource] = useState<"normalized" | "formatted" | "manual" | "saved">(
    "formatted",
  );
  const [certified, setCertified] = useState(Boolean(savedCertifiedAt && savedExportText));
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exerciseCount = parsedWorkout.exercises.length;

  const primeExport = useMemo(() => {
    if (savedExportText?.trim()) {
      return {
        text: savedExportText.trim(),
        source: "saved" as const,
        validation: validateWorkoutExportText(savedExportText.trim(), parsedWorkout),
      };
    }
    const resolved = resolveCertifiedExportText(undefined, parsedWorkout);
    return {
      text: resolved.text,
      source: resolved.source,
      validation: resolved.validation,
    };
  }, [parsedWorkout, savedExportText]);

  useEffect(() => {
    setExportDraftText(primeExport.text);
    setExportValidation(primeExport.validation);
    setExportSource(primeExport.source);
    setCertified(Boolean(savedCertifiedAt && savedExportText));
  }, [primeExport, savedCertifiedAt, savedExportText, workoutId]);

  function revalidateExportDraft(text = exportDraftText) {
    const validation = validateWorkoutExportText(text, parsedWorkout);
    setExportValidation(validation);
    return validation;
  }

  async function persistCertification(exportText: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/workouts/${workoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exportText,
          certifiedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : "Could not save certification — try again.",
        );
      }
      setCertified(true);
      setMessage("Workout certified — export text saved. Download or copy it; use the same format for future uploads.");
      onCertified?.(exportText);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Certification save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCertify() {
    const validation = revalidateExportDraft();
    if (!validation.ok) {
      setError("Fix export issues before certifying — re-parse must match this workout.");
      return;
    }
    await persistCertification(validation.exportText);
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
    const slug = parsedWorkout.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    anchor.href = url;
    anchor.download = `${slug || "workout"}-certified.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (exerciseCount === 0) {
    return (
      <div className="card text-sm text-[var(--muted)]">
        Add at least one exercise before certifying export text for download.
      </div>
    );
  }

  return (
    <div className="card space-y-4 border-violet-500/30 bg-violet-500/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="flex items-center gap-2 text-left font-semibold text-lg"
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`text-sm transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
            Certify for text download
            {certified ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-200">
                Certified ✓
              </span>
            ) : null}
          </button>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Download plain text to your computer (use the same format for future uploads).
            Re-parse must match before certify sticks.
          </p>
        </div>
      </div>

      {open && (
        <>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Export text
              </p>
              <span className="text-[10px] text-[var(--muted)]">
                Source:{" "}
                {exportSource === "formatted"
                  ? "auto-formatted"
                  : exportSource === "saved"
                    ? "saved certified copy"
                    : exportSource === "manual"
                      ? "edited copy"
                      : "interpreted"}
              </span>
            </div>
            <textarea
              className="input min-h-[240px] w-full resize-y font-mono text-xs leading-relaxed"
              value={exportDraftText}
              disabled={disabled || saving}
              onChange={(e) => {
                setExportDraftText(e.target.value);
                setCertified(false);
                setExportSource("manual");
                setCopyState("idle");
                setMessage(null);
              }}
              onBlur={() => revalidateExportDraft()}
              spellCheck={false}
            />
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
                {exportValidation.reparsed.exercises.length} blocks · &quot;
                {exportValidation.reparsed.title}&quot;
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-[10px] text-amber-100">
                {(exportValidation?.issues ?? ["Edit export text or use auto-format."]).map(
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
                Re-validate
              </button>
              <button
                type="button"
                className="btn-ghost text-xs px-2 py-1"
                onClick={() => {
                  const formatted = formatParsedWorkoutAsSms(parsedWorkout);
                  setExportDraftText(formatted);
                  setExportSource("formatted");
                  setCertified(false);
                  revalidateExportDraft(formatted);
                }}
              >
                Use auto-formatted export
              </button>
            </div>
          </div>

          {message && (
            <p className="text-sm text-emerald-200" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyExportText()} className="btn-ghost text-sm">
              {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy"}
            </button>
            <button type="button" onClick={downloadExportText} className="btn-ghost text-sm">
              Download .txt
            </button>
            <button
              type="button"
              onClick={() => void handleCertify()}
              disabled={disabled || saving || !exportValidation?.ok}
              className="btn-primary text-sm"
            >
              {saving ? "Saving…" : certified ? "Re-certify workout" : "Certify workout"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}