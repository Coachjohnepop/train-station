"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MemberChatReply() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setMessage("");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card space-y-2">
      <p className="text-xs text-[var(--muted)]">
        Reply in chat here — your coach sees it under Messages with a badge.
      </p>
      <textarea
        className="input h-16 w-full resize-y text-sm"
        placeholder="Message your coach..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <button type="button" className="btn-primary px-3 py-1 text-sm" disabled={sending || !message.trim()} onClick={handleSend}>
          {sending ? "Sending..." : "Send"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}