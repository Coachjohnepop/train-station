"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ByowFormatGuide from "@/components/ByowFormatGuide";

type Preview = {
  title: string;
  exercises: Array<{ name: string; sets: number; reps: string; notes?: string }>;
};

export default function ByowUploadClient() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setFilename(file.name);
    setRawText(text);
    setPreview(null);
  }

  async function parseNotes() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/byow/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveWorkout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/byow/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, filename }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      router.push(`/member/workout?byow=${encodeURIComponent(data.workoutId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ByowFormatGuide rawText={rawText} />
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Notes file (.txt)
        </span>
        <input
          type="file"
          accept=".txt,.text,.md,text/plain"
          className="mt-1 block w-full text-sm"
          onChange={(e) => void onFile(e.target.files?.[0] || null)}
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Or paste
        </span>
        <textarea
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setPreview(null);
          }}
          rows={12}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-sm"
          placeholder={"Type or paste here — same shape as the example above."}
        />
      </label>
      {filename ? (
        <p className="text-xs text-[var(--muted)]">File: {filename}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !rawText.trim()}
          onClick={() => void parseNotes()}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Working…" : "Preview parse"}
        </button>
        <button
          type="button"
          disabled={busy || !rawText.trim()}
          onClick={() => void saveWorkout()}
          className="rounded-full bg-[var(--ramp-gold)] px-4 py-2 text-sm font-bold text-[#1a1204] disabled:opacity-50"
        >
          Build &amp; open workout
        </button>
      </div>
      {preview ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold">{preview.title || "Untitled"}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {preview.exercises.length} exercises — these go into your private library, not
            Jeremy&apos;s.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
            {preview.exercises.map((ex, i) => (
              <li key={`${ex.name}-${i}`}>
                {ex.name}{" "}
                <span className="text-[var(--muted)]">
                  {ex.sets} × {ex.reps}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
