"use client";

import { useCallback, useRef, useState, type ClipboardEvent, type ChangeEvent } from "react";
import type { ChatMessage, ChatThreadKind } from "@/lib/coach-chat";
import { CHAT_IMAGE_MAX_BYTES } from "@/lib/chat-video-constants";

type SmsResult = {
  sent?: number;
  phone?: string;
  simulated?: boolean;
  reason?: "no_phone" | "delivery_failed";
};

function smsStatusLine(sms?: SmsResult, twilioLive?: boolean): string | null {
  if (!sms) return null;
  if (sms.sent && sms.sent > 0) {
    if (twilioLive) return `Also texted ${sms.phone || "member"}.`;
    if (sms.simulated) return `SMS simulated (Twilio not configured) — in-app message sent.`;
    return `Also texted ${sms.phone || "member"}.`;
  }
  if (sms.reason === "no_phone") return "In-app only — add a phone on the member's user row for SMS.";
  if (sms.reason === "delivery_failed") return "In-app sent — SMS delivery failed.";
  return null;
}

function firstImageFromClipboard(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  const files = e.clipboardData?.files;
  if (files) {
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) return file;
    }
  }
  return null;
}

export default function ChatThreadReply({
  threadId,
  role,
  threadKind,
  destinationLabel,
  placeholder,
  onSent,
}: {
  threadId: string;
  role: "coach" | "member";
  threadKind?: ChatThreadKind;
  destinationLabel?: string;
  placeholder?: string;
  onSent?: (message?: ChatMessage) => void;
}) {
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sendSms, setSendSms] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsNote, setSmsNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearImage = useCallback(() => {
    setImageUrl(null);
    setImagePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const uploadImage = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("Only image files can be pasted or attached.");
        return;
      }
      if (file.size > CHAT_IMAGE_MAX_BYTES) {
        setError("Image too large (max 5 MB).");
        return;
      }

      const localPreview = URL.createObjectURL(file);
      setImagePreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return localPreview;
      });
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", "image");
        const res = await fetch("/api/chat/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setImageUrl(data.url as string);
      } catch (e: unknown) {
        clearImage();
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [clearImage],
  );

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const file = firstImageFromClipboard(e);
    if (!file) return;
    e.preventDefault();
    void uploadImage(file);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void uploadImage(file);
  }

  async function handleSend() {
    if ((!message.trim() && !imageUrl) || !threadId || uploading) return;
    setSending(true);
    setError(null);
    setSmsNote(null);
    try {
      const res = await fetch("/api/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          threadId,
          role,
          sendSms: role === "coach" ? sendSms : false,
          imageUrl: imageUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setMessage("");
      clearImage();
      setSmsNote(smsStatusLine(data.sms as SmsResult, data.twilioLive));
      onSent?.(data.message as ChatMessage | undefined);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  const barClass =
    role === "coach"
      ? "border-t border-violet-500/30 bg-violet-950/30"
      : "border-t border-[var(--border)] bg-[var(--surface)]";

  const canSend = (Boolean(message.trim()) || Boolean(imageUrl)) && !uploading && !sending;

  return (
    <div className={`${barClass} px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}>
      {destinationLabel ? (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {destinationLabel}
        </p>
      ) : null}

      {(imagePreview || imageUrl) && (
        <div className="mb-2 flex items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview || imageUrl || ""}
            alt="Attached photo"
            className="h-20 w-20 rounded-lg border border-[var(--border)] object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[var(--text)]">
              {uploading ? "Uploading photo…" : "Photo ready"}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Paste another image to replace, or remove.</p>
            <button
              type="button"
              className="mt-1 text-[11px] font-semibold text-rose-300 hover:underline"
              onClick={clearImage}
              disabled={uploading}
            >
              Remove photo
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2.5 text-sm text-[var(--muted)] transition hover:border-accent hover:text-[var(--text)] disabled:opacity-40"
          title="Attach photo (or paste into the box)"
          aria-label="Attach photo"
          disabled={uploading || sending}
          onClick={() => fileInputRef.current?.click()}
        >
          📷
        </button>
        <textarea
          className="input min-h-[44px] max-h-28 flex-1 resize-y text-sm lg:max-h-48"
          placeholder={
            placeholder ||
            (role === "coach"
              ? "Reply… paste a screenshot or photo"
              : "Message your coach… paste a photo")
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          rows={1}
        />
        <button
          type="button"
          className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40 ${
            role === "coach"
              ? "bg-violet-600 hover:bg-violet-500"
              : "btn-primary"
          }`}
          disabled={!canSend}
          onClick={handleSend}
        >
          {sending ? "..." : uploading ? "…" : "Send"}
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-[var(--muted)]">
        Paste an image (Ctrl/⌘+V) or tap 📷 · JPEG/PNG/WebP/GIF · max 5&nbsp;MB
      </p>
      {role === "coach" && threadKind !== "cohort" && (
        <label className="mt-2 flex items-center gap-2 text-[10px] text-violet-200/90">
          <input
            type="checkbox"
            checked={sendSms}
            onChange={(e) => setSendSms(e.target.checked)}
            className="rounded border-violet-400/50"
          />
          Also text member&apos;s phone (SMS + in-app Messages)
        </label>
      )}
      {role === "member" && threadKind !== "cohort" && (
        <p className="mt-2 text-[10px] text-[var(--muted)]">
          Or text your coach — SMS replies show up in this thread too.
        </p>
      )}
      {smsNote && <p className="mt-1 text-[10px] text-emerald-400/90">{smsNote}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
