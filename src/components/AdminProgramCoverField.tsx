"use client";

import { useState } from "react";
import { resolveProgramImage } from "@/lib/program-constants";

/**
 * Compact cover URL editor for Admin → Programs list.
 * Uses Program.coverUrl (Postgres); falls back to static /images/programs/* defaults.
 */
export default function AdminProgramCoverField({
  slug,
  name,
  coverUrl: initialCover,
}: {
  slug: string;
  name: string;
  coverUrl?: string | null;
}) {
  const [coverUrl, setCoverUrl] = useState(initialCover || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const preview = resolveProgramImage(slug, coverUrl || null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/programs/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl: coverUrl.trim() || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Save failed");
      setMsg("Cover saved.");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => void save(e)}
      className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-end"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview}
        alt=""
        className="h-14 w-24 shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)]"
      />
      <label className="min-w-0 flex-1 text-[10px] text-[var(--muted)]">
        Cover image URL (landing / member cards)
        <input
          className="input mt-0.5 w-full text-xs"
          placeholder="/images/programs/… or https://…"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
        />
      </label>
      <button type="submit" className="btn-secondary shrink-0 text-xs" disabled={busy}>
        {busy ? "Saving…" : "Save cover"}
      </button>
      {msg ? (
        <span className="text-[10px] text-[var(--muted)] sm:self-center">{msg}</span>
      ) : (
        <span className="sr-only">{name} cover</span>
      )}
    </form>
  );
}
