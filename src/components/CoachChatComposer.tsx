"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHAT_IMAGE_MAX_BYTES, CHAT_VIDEO_MAX_DURATION_SEC } from "@/lib/chat-video-constants";
import CoachMemberPicker from "@/components/CoachMemberPicker";
import TimeScrollPicker from "@/components/TimeScrollPicker";
import { DEFAULT_DEMO_MEMBER_ID } from "@/lib/demo-coach";

type MemberOption = { id: string; name: string; email: string };

export default function CoachChatComposer({
  members,
  embedded = false,
}: {
  members: MemberOption[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([DEFAULT_DEMO_MEMBER_ID]);
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
        setError(`Clip is ${Math.round(duration)}s — max ${CHAT_VIDEO_MAX_DURATION_SEC}s. Use YouTube for longer.`);
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
    if (selectedIds.length === 0) {
      setError("Select at least one member.");
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
          audience: "members",
          memberIds: selectedIds,
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
      setMessage(
        `Posted to ${selectedIds.length} member thread${selectedIds.length === 1 ? "" : "s"} — in-app badge will show on their Messages.`,
      );
      setBody("");
      setRawSms("");
      setYoutubeUrl("");
      setMediaUrl(null);
      setImageUrl(null);
      setVideoDurationSec(null);
      window.dispatchEvent(
        new CustomEvent("coach-chat-posted", {
          detail: { audience: "member", threadIds: data.threads || [] },
        }),
      );
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Post failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`space-y-4 ${embedded ? "p-4" : "card border-accent/30"}`}>
      {!embedded && (
        <div>
          <h2 className="font-semibold">Direct message post</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Private 1:1 updates — text, photos, short clips, or YouTube. Only selected members see these.
          </p>
        </div>
      )}

      <CoachMemberPicker
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
        label="Members"
        required
      />

      <label className="block text-xs">
        <span className="text-[var(--muted)]">Message (optional)</span>
        <textarea
          className="input mt-1 h-20 w-full resize-y text-sm"
          placeholder="Note for this member… paste a screenshot here too"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of Array.from(items)) {
              if (item.kind === "file" && item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                  e.preventDefault();
                  void handleImagePick(file);
                }
                return;
              }
            }
          }}
        />
        <p className="mt-1 text-[10px] text-[var(--muted)]">
          Paste an image into this box (Ctrl/⌘+V) or use Photo below.
        </p>
      </label>

      <details className="group rounded border border-amber-500/30 bg-amber-500/5 p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
          <span className="text-accent group-open:rotate-90 transition-transform text-xs">▶</span>
          Text Upload (optional — overrides schedule)
        </summary>
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <label className="block">
              <span className="text-[var(--muted)]">Session date</span>
              <input type="date" className="input mt-1 w-full" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[var(--muted)]">Scheduled time</span>
              <TimeScrollPicker className="mt-2" value={scheduledTime} onChange={setScheduledTime} />
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
          {imageUrl && (
            <div className="mt-1.5 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="h-12 w-12 rounded border border-[var(--border)] object-cover" />
              <p className="text-[10px] text-[var(--success)]">Photo ready</p>
            </div>
          )}
        </label>
        <label className="block text-xs">
          <span className="text-[var(--muted)]">Short video (≤{CHAT_VIDEO_MAX_DURATION_SEC}s, max 20MB)</span>
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

      <p className="text-[10px] text-[var(--muted)]">
        Delivers in-app Messages only (red badge on Messages / home screen if installed). No phone texts.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary px-4 py-1.5 text-sm"
          disabled={sending || selectedIds.length === 0}
          onClick={handlePost}
        >
          {sending ? "Posting..." : "Post to member(s)"}
        </button>
        {message && (
          <div className="space-y-1">
            <p className="text-xs text-[var(--success)]">{message}</p>
            {newExerciseCount > 0 && (
              <Link
                href="/admin/exercises?tab=newly-added"
                className="inline-block text-xs font-medium text-accent hover:underline"
              >
                Review {newExerciseCount} newly added exercise{newExerciseCount !== 1 ? "s" : ""} →
              </Link>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}