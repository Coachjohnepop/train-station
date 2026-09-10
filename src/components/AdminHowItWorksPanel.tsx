"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { saveLandingMediaAction } from "@/app/admin/landing/actions";
import {
  HOW_IT_WORKS_DEFAULT_STEPS,
  howItWorksVoiceWindow,
  normalizeHowItWorks,
  type HowItWorksConfig,
  type HowItWorksStep,
  type HowItWorksStepId,
} from "@/lib/how-it-works";
import {
  clientHeroAudioMime,
  HERO_AUDIO_CLIENT_ACCEPT,
  heroAudioExtFromMime,
} from "@/lib/landing-mix-audio";
import { formatIntroTime, INTRO_MIN_TRIM_SEC, introTrimDurationSec } from "@/lib/intro-trim";

export default function AdminHowItWorksPanel({
  initial,
}: {
  initial: HowItWorksConfig;
}) {
  const [config, setConfig] = useState<HowItWorksConfig>(() => normalizeHowItWorks(initial));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<HowItWorksStepId | null>(null);
  const [durations, setDurations] = useState<Partial<Record<HowItWorksStepId, number>>>({});
  const [recordingId, setRecordingId] = useState<HowItWorksStepId | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const saveTimer = useRef<number>(0);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function patchStep(id: HowItWorksStepId, patch: Partial<HowItWorksStep>) {
    setConfig((prev) => ({
      steps: prev.steps.map((step) =>
        step.id === id
          ? {
              ...step,
              ...patch,
              voice: patch.voice ? { ...step.voice, ...patch.voice } : step.voice,
            }
          : step,
      ),
    }));
  }

  async function persist(next = configRef.current) {
    setSaving(true);
    const result = await saveLandingMediaAction({ howItWorks: next });
    setSaving(false);
    if ("error" in result && result.error) {
      setError(result.error);
      setMessage(null);
      return false;
    }
    if ("storedHowItWorks" in result && result.storedHowItWorks) {
      const stored = normalizeHowItWorks(result.storedHowItWorks);
      setConfig(stored);
      configRef.current = stored;
    }
    setError(null);
    setMessage("How it Works is live.");
    return true;
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persist();
    }, 600);
  }

  async function uploadVoice(id: HowItWorksStepId, file: File) {
    setBusyId(id);
    setError(null);
    setMessage(`Uploading ${file.name}…`);
    try {
      const mime = clientHeroAudioMime(file);
      const ext = heroAudioExtFromMime(mime, file.name);
      const pathname = `hero/how-it-works/${id}-${crypto.randomUUID()}.${ext}`;
      let url: string | null = null;
      try {
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/admin/landing-media/hero-upload",
          contentType: mime,
          multipart: file.size > 4 * 1024 * 1024,
        });
        url = blob.url;
      } catch (clientErr) {
        if (file.size > 4.5 * 1024 * 1024) throw clientErr;
      }
      if (!url) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/admin/landing-media/hero-upload", {
          method: "POST",
          body: form,
        });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
        url = data.url;
      }
      const next: HowItWorksConfig = {
        steps: configRef.current.steps.map((step) =>
          step.id === id
            ? { ...step, voice: { audioUrl: url, startSec: 0, endSec: null } }
            : step,
        ),
      };
      setConfig(next);
      configRef.current = next;
      await persist(next);
      setMessage(`${HOW_IT_WORKS_DEFAULT_STEPS.find((s) => s.id === id)?.title} voice is live.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setMessage(null);
    } finally {
      setBusyId(null);
    }
  }

  async function startRecording(id: HowItWorksStepId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/mp4" });
        const ext = rec.mimeType.includes("webm") ? "webm" : "m4a";
        const file = new File([blob], `how-it-works-${id}.${ext}`, { type: blob.type });
        setRecordingId(null);
        void uploadVoice(id, file);
      };
      recRef.current = rec;
      rec.start();
      setRecordingId(id);
      setMessage("Recording… tap Stop when Jeremy is done.");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone blocked.");
    }
  }

  function stopRecording() {
    recRef.current?.stop();
    recRef.current = null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">How it Works</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Five screens guests tap through. Record or upload a voice-over per screen, then trim dead
          air. Next stays hidden until that clip finishes.
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="space-y-4">
        {config.steps.map((step, index) => {
          const duration = durations[step.id] || 0;
          const window = howItWorksVoiceWindow(step.voice, duration || null);
          const max = duration > 0 ? duration : Math.max(step.voice.endSec || 20, step.voice.startSec + 8);
          const kept = introTrimDurationSec(step.voice, duration || null);
          const endValue = window.end ?? max;
          const busy = busyId === step.id;
          const recording = recordingId === step.id;
          return (
            <article
              key={step.id}
              className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent-fg)]">
                Screen {index + 1}
              </p>
              <label className="block text-xs text-[var(--muted)]">
                Title
                <input
                  value={step.title}
                  onChange={(e) => {
                    patchStep(step.id, { title: e.target.value });
                    scheduleSave();
                  }}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Line under the picture
                <textarea
                  value={step.coachLine}
                  rows={2}
                  onChange={(e) => {
                    patchStep(step.id, { coachLine: e.target.value });
                    scheduleSave();
                  }}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <label className="btn-primary inline-flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">
                  {busy ? "Uploading…" : step.voice.audioUrl ? "Replace voice" : "Upload voice"}
                  <input
                    type="file"
                    accept={HERO_AUDIO_CLIENT_ACCEPT}
                    className="hidden"
                    disabled={busy || Boolean(recordingId)}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void uploadVoice(step.id, file);
                    }}
                  />
                </label>
                {recording ? (
                  <button
                    type="button"
                    className="btn-ghost min-h-11 px-4 text-sm font-semibold text-rose-300"
                    onClick={stopRecording}
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost min-h-11 px-4 text-sm font-semibold"
                    disabled={busy || Boolean(recordingId)}
                    onClick={() => void startRecording(step.id)}
                  >
                    Record
                  </button>
                )}
                {step.voice.audioUrl ? (
                  <button
                    type="button"
                    className="btn-ghost min-h-11 px-4 text-sm text-red-300"
                    onClick={() => {
                      patchStep(step.id, { voice: { audioUrl: null, startSec: 0, endSec: null } });
                      scheduleSave();
                    }}
                  >
                    Clear voice
                  </button>
                ) : null}
              </div>

              {step.voice.audioUrl ? (
                <div className="space-y-2 rounded-xl border border-violet-500/25 bg-violet-500/5 p-3">
                  <audio
                    key={step.voice.audioUrl}
                    className="w-full"
                    controls
                    src={step.voice.audioUrl}
                    onLoadedMetadata={(e) => {
                      const sec = e.currentTarget.duration;
                      if (Number.isFinite(sec) && sec > 0) {
                        setDurations((prev) =>
                          prev[step.id] === sec ? prev : { ...prev, [step.id]: sec },
                        );
                      }
                    }}
                  />
                  <p className="text-sm font-semibold text-violet-100">Trim (no re-export)</p>
                  <p className="text-[11px] text-[var(--muted)]">
                    Guests hear this window. Next appears when it ends.
                  </p>
                  <label className="block text-xs">
                    Start ({formatIntroTime(window.start)})
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0.1, max - INTRO_MIN_TRIM_SEC)}
                      step={0.1}
                      value={window.start}
                      onChange={(e) => {
                        patchStep(step.id, {
                          voice: { ...step.voice, startSec: Number(e.target.value) },
                        });
                        scheduleSave();
                      }}
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="block text-xs">
                    End ({formatIntroTime(endValue)})
                    <input
                      type="range"
                      min={Math.min(max, window.start + INTRO_MIN_TRIM_SEC)}
                      max={max}
                      step={0.1}
                      value={endValue}
                      onChange={(e) => {
                        patchStep(step.id, {
                          voice: { ...step.voice, endSec: Number(e.target.value) },
                        });
                        scheduleSave();
                      }}
                      className="mt-1 w-full"
                    />
                  </label>
                  <p className="text-[11px] text-emerald-200/90">
                    Guests hear {kept != null ? formatIntroTime(kept) : "the full clip"}
                    {duration ? ` of ${formatIntroTime(duration)}` : ""}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  No voice yet — Next shows as soon as they land on this screen.
                </p>
              )}
            </article>
          );
        })}
      </div>

      <button
        type="button"
        className="btn-primary min-h-11 px-5 text-sm font-semibold"
        disabled={saving}
        onClick={() => void persist()}
      >
        {saving ? "Saving…" : "Save How it Works"}
      </button>
    </section>
  );
}
