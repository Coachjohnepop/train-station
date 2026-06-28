"use client";

import { useState } from "react";
import type { ChatMessage, ChatThreadKind } from "@/lib/coach-chat";

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

export default function ChatThreadReply({
  threadId,
  role,
  threadKind,
  placeholder,
  onSent,
}: {
  threadId: string;
  role: "coach" | "member";
  threadKind?: ChatThreadKind;
  placeholder?: string;
  onSent?: (message?: ChatMessage) => void;
}) {
  const [message, setMessage] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsNote, setSmsNote] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim() || !threadId) return;
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setMessage("");
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

  return (
    <div className={`${barClass} px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}>
      <div className="flex items-end gap-2">
        <textarea
          className="input min-h-[44px] max-h-28 flex-1 resize-y text-sm"
          placeholder={placeholder || (role === "coach" ? "Reply to this thread..." : "Message your coach...")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
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
          disabled={sending || !message.trim()}
          onClick={handleSend}
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
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