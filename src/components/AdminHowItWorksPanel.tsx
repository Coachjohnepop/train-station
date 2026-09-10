"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { saveLandingMediaAction } from "@/app/admin/landing/actions";
import HowItWorksScreen from "@/components/HowItWorksScreen";
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
  mixVolumePercent,
} from "@/lib/landing-mix-audio";
import {
  coachVoiceFileExt,
  createCoachVoiceRecorder,
  openCoachVoiceStream,
} from "@/lib/coach-voice-capture";
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
  const [playingId, setPlayingId] = useState<HowItWorksStepId | null>(null);
  const [recordSec, setRecordSec] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const saveTimer = useRef<number>(0);
  const recordTick = useRef<number>(0);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      previewRef.current?.pause();
      window.clearInterval(recordTick.current);
    };
  }, []);

  function stopPreview() {
    const audio = previewRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    setPlayingId(null);
  }

  function patchStep(id: HowItWorksStepId, patch: Partial<HowItWorksStep>) {
    setConfig((prev) => ({
      ...prev,
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
    stopPreview();
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
        ...configRef.current,
        steps: configRef.current.steps.map((step) =>
          step.id === id
            ? { ...step, voice: { audioUrl: url, startSec: 0, endSec: null } }
            : step,
        ),
      };
      setConfig(next);
      configRef.current = next;
      await persist(next);
      setMessage("Saved. Play it, trim it, or tap Try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setMessage(null);
    } finally {
      setBusyId(null);
    }
  }

  function playGuestHear(step: HowItWorksStep) {
    if (!step.voice.audioUrl) return;
    stopPreview();
    const audio = previewRef.current ?? new Audio();
    previewRef.current = audio;
    const duration = durations[step.id] || 0;
    const { start, end } = howItWorksVoiceWindow(step.voice, duration || null);
    audio.src = step.voice.audioUrl;
    const onMeta = () => {
      try {
        audio.currentTime = start;
      } catch {
        /* iOS */
      }
      void audio.play().catch(() => setPlayingId(null));
    };
    const onTime = () => {
      if (end != null && audio.currentTime >= end - 0.05) {
        audio.pause();
        setPlayingId(null);
      }
    };
    const onEnded = () => setPlayingId(null);
    audio.addEventListener("loadedmetadata", onMeta, { once: true });
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded, { once: true });
    audio.load();
    setPlayingId(step.id);
  }

  async function startRecording(id: HowItWorksStepId) {
    stopPreview();
    try {
      const stream = await openCoachVoiceStream();
      streamRef.current = stream;
      const rec = createCoachVoiceRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        window.clearInterval(recordTick.current);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = coachVoiceFileExt(type);
        const file = new File([blob], `how-it-works-${id}.${ext}`, { type: blob.type });
        setRecordingId(null);
        setRecordSec(0);
        void uploadVoice(id, file);
      };
      recRef.current = rec;
      rec.start();
      setRecordingId(id);
      setRecordSec(0);
      window.clearInterval(recordTick.current);
      const started = Date.now();
      recordTick.current = window.setInterval(() => {
        setRecordSec(Math.floor((Date.now() - started) / 1000));
      }, 250);
      setMessage("Recording over this screen. Tap Stop, then Play to hear it.");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone blocked — allow the mic and try again.");
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
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
          Watch the same screen guests see, play it, do the voice-over here, try again, then trim
          the audio. Mic processing is off so your S’s stay yours — headphones help if Theme Song
          is playing. Pad Theme Song down so guests still hear it under your narration.
        </p>
      </div>

      <label className="block rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm">
        <span className="font-semibold text-amber-100">
          Theme Song while you talk ({mixVolumePercent(config.themeSongDuck)}%)
        </span>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Percent of the Theme Song volume during a How it Works clip. 20% pads it down so your
          voice sits on top. 0% is silent. 100% is no duck.
        </p>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          className="mt-2 w-full"
          value={mixVolumePercent(config.themeSongDuck)}
          onChange={(e) => {
            const themeSongDuck = Number(e.target.value) / 100;
            setConfig((prev) => ({ ...prev, themeSongDuck }));
            configRef.current = { ...configRef.current, themeSongDuck };
            scheduleSave();
          }}
        />
      </label>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="space-y-5">
        {config.steps.map((step, index) => {
          const duration = durations[step.id] || 0;
          const window = howItWorksVoiceWindow(step.voice, duration || null);
          const max = duration > 0 ? duration : Math.max(step.voice.endSec || 20, step.voice.startSec + 8);
          const kept = introTrimDurationSec(step.voice, duration || null);
          const endValue = window.end ?? max;
          const busy = busyId === step.id;
          const recording = recordingId === step.id;
          const playing = playingId === step.id;
          const hasVoice = Boolean(step.voice.audioUrl);
          return (
            <article
              key={step.id}
              className={`space-y-3 rounded-xl border p-4 ${
                recording
                  ? "border-rose-400/50 bg-rose-950/20"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent-fg)]">
                Screen {index + 1} · {HOW_IT_WORKS_DEFAULT_STEPS.find((s) => s.id === step.id)?.title}
              </p>

              <div className="relative">
                <HowItWorksScreen stepId={step.id} />
                {recording ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45">
                    <p className="rounded-full bg-rose-500 px-4 py-2 text-sm font-extrabold text-white">
                      Recording {formatIntroTime(recordSec)}
                    </p>
                  </div>
                ) : null}
                {playing ? (
                  <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-bold text-[#042f1a]">
                    Playing
                  </div>
                ) : null}
              </div>

              <p className="text-center text-sm font-semibold text-[var(--text)]">{step.coachLine}</p>

              <div className="flex flex-wrap gap-2">
                {hasVoice ? (
                  <button
                    type="button"
                    className="btn-primary min-h-11 px-4 text-sm font-semibold"
                    disabled={busy || recording}
                    onClick={() => {
                      if (playing) stopPreview();
                      else playGuestHear(step);
                    }}
                  >
                    {playing ? "Stop" : "Play"}
                  </button>
                ) : null}
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
                    {hasVoice ? "Try again" : "Record voice-over"}
                  </button>
                )}
                <label className="btn-ghost inline-flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">
                  {busy ? "Uploading…" : "Upload"}
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
                {hasVoice ? (
                  <button
                    type="button"
                    className="btn-ghost min-h-11 px-4 text-sm text-red-300"
                    onClick={() => {
                      stopPreview();
                      patchStep(step.id, { voice: { audioUrl: null, startSec: 0, endSec: null } });
                      scheduleSave();
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <label className="block text-xs text-[var(--muted)]">
                Title guests see
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

              {hasVoice ? (
                <div className="space-y-2 rounded-xl border border-violet-500/25 bg-violet-500/5 p-3">
                  <audio
                    className="hidden"
                    src={step.voice.audioUrl ?? undefined}
                    onLoadedMetadata={(e) => {
                      const sec = e.currentTarget.duration;
                      if (Number.isFinite(sec) && sec > 0) {
                        setDurations((prev) =>
                          prev[step.id] === sec ? prev : { ...prev, [step.id]: sec },
                        );
                      }
                    }}
                  />
                  <p className="text-sm font-semibold text-violet-100">Trim the audio</p>
                  <p className="text-[11px] text-[var(--muted)]">
                    Cut dead air. Play uses this window. Guests hear the same cut.
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
                    Kept {kept != null ? formatIntroTime(kept) : "full clip"}
                    {duration ? ` of ${formatIntroTime(duration)}` : ""}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  Look at the screen, tap Record voice-over, talk, Stop. Then Play. If you don’t like
                  it, Try again.
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
