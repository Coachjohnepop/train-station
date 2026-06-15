"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHAT_VIDEO_MAX_DURATION_SEC } from "@/lib/chat-video-constants";
import CoachMemberPicker from "@/components/CoachMemberPicker";

type MemberOption = { id: string; name: string; email: string };

export default function CoachChatComposer({ members }: { members: MemberOption[] }) {
  const router = useRouter();
  const [audience, setAudience] = useState<"member" | "cohort">("member");
  const [selectedIds, setSelectedIds] = useState<string[]>(["demo-user-john", "demo-user-stephanie"]);
  const [programSlug, setProgramSlug] = useState("adult");
  const [body, setBody] = useState("");
  const [rawSms, setRawSms] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState("06:30");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendSmsAlert, setSendSmsAlert] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleVideoPick(file: File | null) {
    setError(null);
    setMediaUrl(null);
    setVideoDurationSec(null);
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
        form.append("durationSec", String(Math.round(duration)));
        const res = await fetch("/api/chat/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setMediaUrl(data.url);
        setVideoDurationSec(data.durationSec);
      } catch (e: any) {
        setError(e?.message || "Upload failed");
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
          audience: audience === "cohort" ? "cohort" : "members",
          memberIds: audience === "cohort" ? selectedIds : selectedIds,
          programSlug,
          body: body.trim() || undefined,
          rawSms: rawSms.trim() || undefined,
          sessionDate: rawSms.trim() ? sessionDate : undefined,
          scheduledTime: rawSms.trim() ? scheduledTime : undefined,
          youtubeUrl: youtubeUrl.trim() || undefined,
          mediaUrl: mediaUrl || undefined,
          videoDurationSec: videoDurationSec || undefined,
          sendSmsAlert,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Post failed");

      setMessage(
        `Posted ${data.messages?.length || 0} message(s)${data.alerts?.sent ? ` · SMS sent to ${data.alerts.sent}` : ""}.`,
      );
      setBody("");
      setRawSms("");
      setYoutubeUrl("");
      setMediaUrl(null);
      setVideoDurationSec(null);
      window.dispatchEvent(new CustomEvent("coach-chat-posted"));
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Post failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card border-accent/30 space-y-4">
      <div>
        <h2 className="font-semibold">Post coach update</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          One place to message members, schedule an SMS workout override, attach a short clip or YouTube link, and send an alert.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          className={`btn-ghost px-3 py-1 ${audience === "member" ? "ring-1 ring-accent" : ""}`}
          onClick={() => setAudience("member")}
        >
          Individual thread(s)
        </button>
        <button
          type="button"
          className={`btn-ghost px-3 py-1 ${audience === "cohort" ? "ring-1 ring-accent" : ""}`}
          onClick={() => setAudience("cohort")}
        >
          Program cohort
        </button>
      </div>

      {audience === "cohort" && (
        <label className="block text-xs">
          <span className="text-[var(--muted)]">Program slug</span>
          <input className="input mt-1 w-full" value={programSlug} onChange={(e) => setProgramSlug(e.target.value)} />
        </label>
      )}

      <CoachMemberPicker
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
      />

      <label className="block text-xs">
        <span className="text-[var(--muted)]">Message (optional)</span>
        <textarea
          className="input mt-1 h-20 w-full resize-y text-sm"
          placeholder="Quick note for the feed..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>

      <details className="group rounded border border-amber-500/30 bg-amber-500/5 p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
          <span className="text-accent group-open:rotate-90 transition-transform text-xs">▶</span>
          Paste SMS workout (optional — overrides schedule)
        </summary>
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <label className="block">
              <span className="text-[var(--muted)]">Session date</span>
              <input type="date" className="input mt-1 w-full" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[var(--muted)]">Scheduled time</span>
              <input type="time" className="input mt-1 w-full" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </label>
          </div>
          <textarea
            className="input h-32 w-full resize-y font-mono text-sm"
            placeholder="Paste coach SMS workout..."
            value={rawSms}
            onChange={(e) => setRawSms(e.target.value)}
          />
        </div>
      </details>

      <div className="grid gap-3 sm:grid-cols-2">
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

      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={sendSmsAlert} onChange={(e) => setSendSmsAlert(e.target.checked)} />
        Send SMS alert with link to Go to Today / chat
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary px-4 py-1.5 text-sm"
          disabled={sending || selectedIds.length === 0}
          onClick={handlePost}
        >
          {sending ? "Posting..." : "Post update"}
        </button>
        {message && <p className="text-xs text-[var(--success)]">{message}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}