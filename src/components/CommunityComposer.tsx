"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHAT_IMAGE_MAX_BYTES, CHAT_VIDEO_MAX_DURATION_SEC } from "@/lib/chat-video-constants";
import {
  COMMUNITY_NO_BROADCAST_NOTE,
  STATION_COMMUNITY_SLUG,
  communityProgramTargets,
} from "@/lib/community-feed";
import TimeScrollPicker from "@/components/TimeScrollPicker";

type TargetMode = "station" | "programs";

export default function CommunityComposer({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const programs = useMemo(() => communityProgramTargets(), []);
  const [targetMode, setTargetMode] = useState<TargetMode>("station");
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>(() =>
    programs[0] ? [programs[0].slug] : [],
  );
  const [body, setBody] = useState("");
  const [rawSms, setRawSms] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState("06:30");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newExerciseCount, setNewExerciseCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function toggleProgram(slug: string) {
    setSelectedPrograms((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function selectAllPrograms() {
    setSelectedPrograms(programs.map((p) => p.slug));
  }

  async function handleImagePick(file: File | null) {
    setError(null);
    setImageUrl(null);
    if (!file) return;
    if (file.size > CHAT_IMAGE_MAX_BYTES) {
      setError("Image too large (max 5 MB).");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "image");
      const res = await fetch("/api/chat/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setImageUrl(data.url);
      setMediaUrl(null);
      setVideoDurationSec(null);
      setYoutubeUrl("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleVideoPick(file: File | null) {
    setError(null);
    setMediaUrl(null);
    setVideoDurationSec(null);
    setImageUrl(null);
    if (!file) return;

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;

    video.onloadedmetadata = async () => {
      URL.revokeObjectURL(url);
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        setError("Could not read video duration.");
        return;
      }
      if (duration > CHAT_VIDEO_MAX_DURATION_SEC) {
        setError(
          `Clip is ${Math.round(duration)}s — max ${CHAT_VIDEO_MAX_DURATION_SEC}s. Use YouTube for longer.`,
        );
        return;
      }

      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", "video");
        form.append("durationSec", String(Math.round(duration)));
        const res = await fetch("/api/chat/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setMediaUrl(data.url);
        setVideoDurationSec(data.durationSec);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not read video file.");
    };
  }

  async function handlePost() {
    const programSlugs =
      targetMode === "station" ? [STATION_COMMUNITY_SLUG] : selectedPrograms;

    if (programSlugs.length === 0) {
      setError("Select at least one program community.");
      return;
    }

    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/chat/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience: "cohort",
          programSlugs,
          body: body.trim() || undefined,
          rawSms: rawSms.trim() || undefined,
          sessionDate: rawSms.trim() ? sessionDate : undefined,
          scheduledTime: rawSms.trim() ? scheduledTime : undefined,
          youtubeUrl: youtubeUrl.trim() || undefined,
          mediaUrl: mediaUrl || undefined,
          imageUrl: imageUrl || undefined,
          videoDurationSec: videoDurationSec || undefined,
          sendSmsAlert: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Post failed");

      const created = Array.isArray(data.newExerciseIds) ? data.newExerciseIds.length : 0;
      setNewExerciseCount(created);
      const n = data.threads?.length || programSlugs.length;
      const who =
        targetMode === "station"
          ? "Everyone (whole station)"
          : `${n} program group${n === 1 ? "" : "s"}`;
      setMessage(
        `Posted to ${who} — members get an in-app badge on that group (home-screen badge if installed).`,
      );
      setBody("");
      setRawSms("");
      setYoutubeUrl("");
      setMediaUrl(null);
      setImageUrl(null);
      setVideoDurationSec(null);
      window.dispatchEvent(
        new CustomEvent("coach-chat-posted", {
          detail: { audience: "cohort", threadIds: data.threads || [] },
        }),
      );
      window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Post failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`space-y-4 ${embedded ? "p-4" : "card border-violet-500/30"}`}>
      {!embedded && (
        <div>
          <h2 className="font-semibold">Community post</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Patreon-style updates — text, photos, short clips (≤{CHAT_VIDEO_MAX_DURATION_SEC}s), or
            YouTube. Target everyone or specific program groups.
          </p>
        </div>
      )}

      <p className="text-[11px] text-[var(--muted)]">{COMMUNITY_NO_BROADCAST_NOTE}</p>

      {/* Audience: everyone vs by program */}
      <div className="space-y-2 rounded-xl border border-violet-400/30 bg-violet-500/5 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-200">
          Who gets this?
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTargetMode("station")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              targetMode === "station"
                ? "bg-violet-500/30 text-violet-50 ring-1 ring-violet-300/50"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            Everyone · whole station
          </button>
          <button
            type="button"
            onClick={() => setTargetMode("programs")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              targetMode === "programs"
                ? "bg-violet-500/30 text-violet-50 ring-1 ring-violet-300/50"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            By program
          </button>
        </div>

        {targetMode === "station" ? (
          <p className="text-[11px] text-[var(--muted)]">
            All members see this under <strong className="text-[var(--text)]">Everyone</strong> and
            get a Messages badge.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="text-[10px] font-semibold text-violet-200 hover:underline"
                onClick={selectAllPrograms}
              >
                Select all programs
              </button>
              <button
                type="button"
                className="text-[10px] font-semibold text-[var(--muted)] hover:underline"
                onClick={() => setSelectedPrograms([])}
              >
                Clear
              </button>
            </div>
            <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
              {programs.map((p) => {
                const on = selectedPrograms.includes(p.slug);
                return (
                  <label
                    key={p.slug}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                      on ? "bg-violet-500/15 text-[var(--text)]" : "text-[var(--muted)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-violet-500"
                      checked={on}
                      onChange={() => toggleProgram(p.slug)}
                    />
                    <span className="font-medium">{p.name}</span>
                    <span className="text-[10px] opacity-60">{p.slug}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              Only members <strong className="text-[var(--text)]">enrolled</strong> in a selected
              program see that group tab and get the badge.
            </p>
          </div>
        )}
      </div>

      <label className="block text-xs">
        <span className="text-[var(--muted)]">Message (optional)</span>
        <textarea
          className="input mt-1 h-20 w-full resize-y text-sm"
          placeholder="Share an update with the station or a program group..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>

      <details className="group rounded border border-amber-500/30 bg-amber-500/5 p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
          <span className="text-xs text-accent transition-transform group-open:rotate-90">▶</span>
          Workout text (optional — for 1:1 / Today, not program groups)
        </summary>
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <label className="block">
              <span className="text-[var(--muted)]">Session date</span>
              <input
                type="date"
                className="input mt-1 w-full"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[var(--muted)]">Scheduled time</span>
              <TimeScrollPicker
                className="mt-2"
                value={scheduledTime}
                onChange={setScheduledTime}
              />
            </label>
          </div>
          <textarea
            className="input h-32 w-full resize-y font-mono text-sm"
            placeholder="Paste workout text..."
            value={rawSms}
            onChange={(e) => setRawSms(e.target.value)}
          />
        </div>
      </details>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="text-[var(--muted)]">Photo (max 5MB)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="input mt-1 w-full text-xs"
            onChange={(e) => handleImagePick(e.target.files?.[0] || null)}
          />
          {imageUrl && <p className="mt-1 text-[10px] text-[var(--success)]">Photo ready</p>}
        </label>
        <label className="block text-xs">
          <span className="text-[var(--muted)]">
            Short video (≤{CHAT_VIDEO_MAX_DURATION_SEC}s, max 20MB)
          </span>
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="input mt-1 w-full text-xs"
            onChange={(e) => handleVideoPick(e.target.files?.[0] || null)}
          />
          {uploading && <p className="mt-1 text-[10px] text-[var(--muted)]">Uploading...</p>}
          {mediaUrl && <p className="mt-1 text-[10px] text-[var(--success)]">Video ready</p>}
        </label>
        <label className="block text-xs">
          <span className="text-[var(--muted)]">Or YouTube link (any length)</span>
          <input
            className="input mt-1 w-full"
            placeholder="https://youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary px-4 py-1.5 text-sm"
          disabled={
            sending ||
            uploading ||
            (targetMode === "programs" && selectedPrograms.length === 0)
          }
          onClick={() => void handlePost()}
        >
          {sending
            ? "Posting..."
            : targetMode === "station"
              ? "Post to everyone"
              : `Post to ${selectedPrograms.length || 0} program${selectedPrograms.length === 1 ? "" : "s"}`}
        </button>
        {message && (
          <div className="space-y-1">
            <p className="text-xs text-[var(--success)]">{message}</p>
            {newExerciseCount > 0 && (
              <Link
                href="/admin/exercises?tab=newly-added"
                className="inline-block text-xs font-medium text-accent hover:underline"
              >
                Review {newExerciseCount} newly added exercise
                {newExerciseCount !== 1 ? "s" : ""} →
              </Link>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
