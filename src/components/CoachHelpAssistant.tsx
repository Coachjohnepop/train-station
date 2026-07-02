"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { COACH_HELP_OPEN_EVENT } from "@/lib/coach-help-events";

type ChatLine = {
  role: "user" | "assistant";
  content: string;
  suggestionSaved?: boolean;
};

export default function CoachHelpAssistant() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [sendToJohn, setSendToJohn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/help-chat", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.enabled) {
          setEnabled(true);
          const name = data.coachName || "Coach";
          setLines([
            {
              role: "assistant",
              content: `Hi ${name} — I'm Grok. Ask how anything in the coach admin works, or what members see on their phones. I can't change the app; tick "Send to John" if you want him to see a suggestion.`,
            },
          ]);
        }
        if (data && data.configured === false) setConfigured(false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(COACH_HELP_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(COACH_HELP_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, loading, open]);

  const send = useCallback(async () => {
    const message = draft.trim();
    if (!message || loading) return;
    setLoading(true);
    setError(null);
    setDraft("");

    const userLine: ChatLine = { role: "user", content: message };
    setLines((prev) => [...prev, userLine]);

    try {
      const history = [...lines, userLine]
        .filter((l) => l.role === "user" || l.role === "assistant")
        .slice(-10)
        .map((l) => ({ role: l.role, content: l.content }));

      const res = await fetch("/api/admin/help-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          pagePath: pathname,
          history: history.slice(0, -1),
          sendSuggestionToJohn: sendToJohn,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not get an answer.");
        return;
      }
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          suggestionSaved: Boolean(data.suggestionSaved),
        },
      ]);
      if (sendToJohn) {
        setSendToJohn(false);
        window.dispatchEvent(new Event("coach-suggestions-badge-refresh"));
      }
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }, [draft, loading, lines, pathname, sendToJohn]);

  if (!enabled) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="coach-help-fab fixed z-50 hidden items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] bg-[color-mix(in_srgb,var(--surface)_92%,var(--bg))] px-4 py-3 text-sm font-semibold text-accent shadow-lg backdrop-blur-md transition hover:border-accent xl:flex"
          style={{
            right: "max(1rem, env(safe-area-inset-right))",
            bottom: "max(5.5rem, calc(5rem + env(safe-area-inset-bottom)))",
          }}
          aria-label="Ask Grok for help using this app"
        >
          <span aria-hidden>?</span>
          Ask Grok
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coach-help-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close help"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:rounded-2xl">
            <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <h2 id="coach-help-title" className="text-sm font-bold">
                  Ask Grok
                </h2>
                <p className="text-[10px] text-[var(--muted)]">
                  How to use the coach admin · read-only
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost min-h-[40px] px-3 text-xs"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </header>

            {!configured && (
              <p className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
                Help AI isn&apos;t wired up on the server yet — John needs to add XAI_API_KEY.
              </p>
            )}

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {lines.map((line, i) => (
                <div
                  key={`${line.role}-${i}`}
                  className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    line.role === "user"
                      ? "ml-auto bg-accent/20 text-[var(--foreground)]"
                      : "mr-auto border border-[var(--border)] bg-[var(--surface-2)]"
                  }`}
                >
                  {line.content}
                  {line.suggestionSaved && (
                    <p className="mt-1 text-[10px] text-emerald-400">Sent to John ✓</p>
                  )}
                </div>
              ))}
              {loading && (
                <p className="text-xs text-[var(--muted)] animate-pulse">Grok is thinking…</p>
              )}
              {error && (
                <p className="text-xs text-amber-300">{error}</p>
              )}
            </div>

            <footer className="space-y-2 border-t border-[var(--border)] px-4 py-3">
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={sendToJohn}
                  onChange={(e) => setSendToJohn(e.target.checked)}
                />
                Send this question to John as a suggestion
              </label>
              <div className="flex gap-2">
                <input
                  className="input min-h-[44px] flex-1 text-sm"
                  placeholder="e.g. How do I copy today's workout to Stephanie?"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  disabled={loading || !configured}
                />
                <button
                  type="button"
                  className="btn-primary min-h-[44px] shrink-0 px-4"
                  disabled={loading || !draft.trim() || !configured}
                  onClick={() => void send()}
                >
                  Ask
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}