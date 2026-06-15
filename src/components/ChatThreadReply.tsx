"use client";

import { useState } from "react";

export default function ChatThreadReply({
  threadId,
  role,
  placeholder,
  onSent,
}: {
  threadId: string;
  role: "coach" | "member";
  placeholder?: string;
  onSent?: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim() || !threadId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          threadId,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setMessage("");
      onSent?.();
    } catch (e: any) {
      setError(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] px-3 py-3">
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
          className="btn-primary shrink-0 px-4 py-2 text-sm"
          disabled={sending || !message.trim()}
          onClick={handleSend}
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
      {role === "member" && (
        <p className="mt-2 text-[10px] text-[var(--muted)]">
          Or text your coach — SMS replies show up in this thread too.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}