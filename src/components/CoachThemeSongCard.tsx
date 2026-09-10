"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { saveThemeSongAction } from "@/app/admin/landing/actions";
import {
  clampMixVolume,
  clampThemeSongClickStarts,
  mixVolumePercent,
  THEME_SONG_CLICK_STARTS_MAX,
  THEME_SONG_CLICK_STARTS_MIN,
  THEME_SONG_CLICK_STARTS_DEFAULT,
  THEME_SONG_DEFAULT_VOLUME,
} from "@/lib/landing-mix-audio";

/**
 * Jeremy-facing Theme Song controls (iPhone Settings). Same store as Admin → Landing mix.
 */
export default function CoachThemeSongCard() {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(THEME_SONG_DEFAULT_VOLUME);
  const [clickStarts, setClickStarts] = useState(THEME_SONG_CLICK_STARTS_DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/landing-media", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          themeSongEnabled?: boolean;
          themeSongVolume?: unknown;
          themeSongClickStarts?: unknown;
        };
        if (cancelled) return;
        setEnabled(data.themeSongEnabled !== false);
        setVolume(clampMixVolume(data.themeSongVolume, THEME_SONG_DEFAULT_VOLUME));
        setClickStarts(
          clampThemeSongClickStarts(data.themeSongClickStarts, 1),
        );
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: { enabled: boolean; volume: number; clickStarts: number }) {
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await saveThemeSongAction({
      themeSongEnabled: next.enabled,
      themeSongVolume: next.volume,
      themeSongClickStarts: next.clickStarts,
    });
    setSaving(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    setMessage("Theme Song saved — first tap on the public site uses this.");
  }

  return (
    <section className="rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-amber-100">Theme Song</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Guests hear this on the first tap at thetrainstation.co. It is not the Cybertruck rest
          horn — that only plays when a rest timer ends.
        </p>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={enabled}
          disabled={!loaded || saving}
          onChange={(e) => {
            const on = e.target.checked;
            setEnabled(on);
            void save({ enabled: on, volume, clickStarts });
          }}
        />
        Play Theme Song for guests
      </label>
      <label className="block text-sm">
        Volume ({mixVolumePercent(volume)}%)
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          className="mt-2 w-full"
          value={mixVolumePercent(volume)}
          disabled={!loaded || saving || !enabled}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          onPointerUp={() => void save({ enabled, volume, clickStarts })}
        />
      </label>
      <label className="block text-sm">
        Play, mute, play again — second mute stays (2)
        <input
          type="number"
          min={THEME_SONG_CLICK_STARTS_MIN}
          max={THEME_SONG_CLICK_STARTS_MAX}
          className="input mt-1 max-w-[6rem] min-h-11"
          value={clickStarts}
          disabled={!loaded || saving}
          onChange={(e) => {
            const n = clampThemeSongClickStarts(e.target.value, 1);
            setClickStarts(n);
            void save({ enabled, volume, clickStarts: n });
          }}
        />
      </label>
      <p className="text-xs text-[var(--muted)]">
        Mix slide audio and hear both volumes at{" "}
        <Link href="/admin/landing" className="font-semibold text-accent hover:underline">
          Admin → Landing
        </Link>
        .
      </p>
      {saving ? <p className="text-xs text-[var(--muted)]">Saving…</p> : null}
      {message ? <p className="text-xs text-[var(--success)]">{message}</p> : null}
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </section>
  );
}
