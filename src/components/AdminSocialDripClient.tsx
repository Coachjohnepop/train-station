"use client";

import { useCallback, useEffect, useState } from "react";

type Channel = "x" | "instagram" | "facebook";

type Post = {
  id: string;
  body: string;
  mediaUrl: string | null;
  channels: Channel[];
  status: string;
  scheduledAt: string;
  postedAt: string | null;
  lastError: string | null;
};

type Payload = {
  posts: Post[];
  credentials: Record<string, boolean>;
};

export default function AdminSocialDripClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["x", "instagram", "facebook"]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/social");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not load drip.");
      return;
    }
    setData(json as Payload);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function queue() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          mediaUrl: mediaUrl.trim() || null,
          channels,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Queue failed");
      setBody("");
      setMediaUrl("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Queue failed");
    } finally {
      setSaving(false);
    }
  }

  function toggle(ch: Channel) {
    setChannels((cur) => (cur.includes(ch) ? cur.filter((c) => c !== ch) : [...cur, ch]));
  }

  const cred = data?.credentials || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Social drip</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Queue captions for X, Instagram, and Facebook. Daily cron posts one due item. TikTok later.
          Paste tokens in Vercel env — never in this form.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(["x", "instagram", "facebook"] as const).map((ch) => (
          <span
            key={ch}
            className={`rounded-full px-2.5 py-1 font-semibold ${
              cred[ch] ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"
            }`}
          >
            {ch} {cred[ch] ? "keys on" : "awaiting login"}
          </span>
        ))}
        <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--muted)]">
          tiktok later
        </span>
      </div>

      <section className="card space-y-3 p-4">
        <p className="text-sm font-medium">Queue a post</p>
        <textarea
          className="min-h-28 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Caption…"
        />
        <input
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="Image URL (required for Instagram)"
        />
        <div className="flex flex-wrap gap-2">
          {(["x", "instagram", "facebook"] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => toggle(ch)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                channels.includes(ch)
                  ? "bg-[#7c3aed]/30 text-white ring-[#7c3aed]"
                  : "text-[var(--muted)] ring-[var(--border)]"
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={saving || !body.trim() || channels.length === 0}
          onClick={() => void queue()}
        >
          {saving ? "Queueing…" : "Queue"}
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Queue</h2>
        {(data?.posts || []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing queued yet.</p>
        ) : (
          <ul className="space-y-2">
            {data!.posts.map((p) => (
              <li key={p.id} className="card p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold uppercase tracking-wide text-[10px] text-[var(--muted)]">
                    {p.status} · {p.channels.join(", ")}
                  </span>
                  <span className="text-[10px] tabular-nums text-[var(--muted)]">
                    {new Date(p.scheduledAt).toLocaleString("en-US", {
                      timeZone: "America/Los_Angeles",
                    })}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{p.body}</p>
                {p.lastError ? (
                  <p className="mt-1 text-xs text-amber-300">{p.lastError}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
