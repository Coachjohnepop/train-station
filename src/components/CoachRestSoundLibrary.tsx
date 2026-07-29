"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { playRestComplete } from "@/lib/rest-audio";
import {
  DEFAULT_REST_TIMER_SOUND,
  buildRestTimerSoundOptions,
  type RestTimerSoundKey,
  type RestTimerSoundOption,
} from "@/lib/rest-timer-sound";

type LibraryItem = {
  id: string;
  title: string;
  url: string;
  fileName?: string | null;
};

type Props = {
  /** Currently selected sound key (built-in id or custom URL). */
  value: RestTimerSoundKey;
  onChange: (key: RestTimerSoundKey) => void;
  /** Compact for live floor; full for lesson builder. */
  compact?: boolean;
  disabled?: boolean;
};

export default function CoachRestSoundLibrary({
  value,
  onChange,
  compact = false,
  disabled = false,
}: Props) {
  const [system, setSystem] = useState<RestTimerSoundOption[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [defaultKey, setDefaultKey] = useState<string>(DEFAULT_REST_TIMER_SOUND);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/rest-sounds", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load rest sounds.");
        return;
      }
      setSystem(Array.isArray(data.system) ? data.system : []);
      setItems(Array.isArray(data.items) ? data.items : []);
      if (typeof data.defaultSoundKey === "string" && data.defaultSoundKey) {
        setDefaultKey(data.defaultSoundKey);
      }
    } catch {
      setError("Could not load rest sounds.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const options = buildRestTimerSoundOptions(items);

  async function uploadFile(file: File) {
    setUploading(true);
    setError("");
    setMessage("");
    try {
      // Prefer direct blob upload when available
      const metaRes = await fetch("/api/admin/rest-sounds", { cache: "no-store" });
      const meta = await metaRes.json().catch(() => ({}));
      let url = "";
      if (meta.clientUpload) {
        const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
        const pathname = `rest-sounds/${crypto.randomUUID()}.${ext}`;
        const result = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/admin/rest-sounds",
          contentType: file.type || "audio/mpeg",
        });
        url = result.url;
        const addRes = await fetch("/api/admin/rest-sounds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add",
            url,
            title: file.name.replace(/\.[^.]+$/, "") || "Custom rest sound",
            fileName: file.name,
          }),
        });
        const addData = await addRes.json().catch(() => ({}));
        if (!addRes.ok) throw new Error(addData.error || "Could not save to library.");
        if (addData.library?.items) setItems(addData.library.items);
      } else {
        const form = new FormData();
        form.set("file", file);
        form.set("title", file.name.replace(/\.[^.]+$/, "") || "Custom rest sound");
        const res = await fetch("/api/admin/rest-sounds", {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Upload failed.");
        url = data.url;
        if (data.library?.items) setItems(data.library.items);
      }
      if (url) {
        onChange(url);
        playRestComplete(url, { force: true });
        setMessage("Uploaded — selected as rest sound.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("Remove this custom rest sound from the library?")) return;
    setError("");
    try {
      const res = await fetch("/api/admin/rest-sounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      if (data.library?.items) setItems(data.library.items);
      // If we deleted the active custom sound, fall back to default.
      const stillThere = (data.library?.items || []).some(
        (i: LibraryItem) => i.url === value || i.id === value,
      );
      if (!stillThere && !system.some((s) => s.id === value)) {
        onChange(DEFAULT_REST_TIMER_SOUND);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  async function setAsDefault(key: string) {
    setError("");
    try {
      const res = await fetch("/api/admin/rest-sounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setDefault", defaultSoundKey: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not set default.");
      setDefaultKey(key);
      setMessage("Saved as system default for new workouts.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set default.");
    }
  }

  if (loading) {
    return <p className="text-[10px] text-[var(--muted)]">Loading sounds…</p>;
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Rest end sound
        </p>
        <div className="flex flex-wrap gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/mp4,audio/x-m4a,audio/ogg,audio/webm,.mp3,.wav,.m4a,.ogg,.webm"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
            }}
          />
          <button
            type="button"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text)] hover:border-accent/50"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload sound"}
          </button>
        </div>
      </div>

      <p className="text-[10px] text-[var(--muted)] leading-relaxed">
        System defaults stay available. Upload a longer/louder MP3 (up to 8 MB) for live rest-end.
        Custom clips play at full volume.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.id;
          const isDefault = defaultKey === opt.id;
          return (
            <div key={opt.id} className="flex items-center gap-0.5">
              <button
                type="button"
                title={opt.hint}
                disabled={disabled}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  active
                    ? "border-sky-400/60 bg-sky-500/25 text-sky-100"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-sky-400/40 hover:text-[var(--text)]"
                }`}
                onClick={() => {
                  onChange(opt.id);
                  playRestComplete(opt.id, { force: true });
                }}
              >
                {opt.label}
                {isDefault ? " · default" : ""}
                {opt.kind === "custom" ? " · upload" : ""}
              </button>
            </div>
          );
        })}
      </div>

      {items.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 p-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted)]"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">
                {item.title}
              </span>
              <button
                type="button"
                className="text-accent hover:underline"
                disabled={disabled}
                onClick={() => {
                  onChange(item.url);
                  playRestComplete(item.url, { force: true });
                }}
              >
                Use
              </button>
              <button
                type="button"
                className="hover:underline"
                disabled={disabled}
                onClick={() => void setAsDefault(item.url)}
              >
                Make default
              </button>
              <button
                type="button"
                className="text-red-300 hover:underline"
                disabled={disabled}
                onClick={() => void removeItem(item.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2 text-[10px]">
        <button
          type="button"
          className="text-accent hover:underline"
          disabled={disabled}
          onClick={() => void setAsDefault(value)}
        >
          Set current selection as default
        </button>
        <button
          type="button"
          className="text-[var(--muted)] hover:underline"
          disabled={disabled}
          onClick={() => void load()}
        >
          Refresh library
        </button>
      </div>

      {error ? (
        <p className="text-[10px] text-amber-200">{error}</p>
      ) : message ? (
        <p className="text-[10px] text-emerald-200">{message}</p>
      ) : null}
    </div>
  );
}
