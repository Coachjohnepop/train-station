/** Extract YouTube video ID for embed links. */
export function youtubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return u.pathname.slice(1).split("/")[0]?.split("?")[0] || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return v.split("&")[0];
      const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts) return shorts[1];
      const embed = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embed) return embed[1];
    }
  } catch {
    const fallback = trimmed.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/,
    );
    return fallback?.[1] ?? null;
  }
  return null;
}

export type YoutubeEmbedOptions = {
  autoplay?: boolean;
  /** true = muted autoplay. Default false when autoplay is on (audible after a tap). */
  mute?: boolean;
  enableJsApi?: boolean;
  origin?: string;
  /**
   * Jump to this second on load (YouTube embed `start=`).
   * If omitted, we parse `t=` / `start=` from the watch URL when present.
   * Share tip: open YouTube → right-click video → "Copy video URL at current time"
   * or append `&t=43s` to the watch link.
   */
  startSeconds?: number;
};

/** Parse YouTube `t` / `start` values: `43`, `43s`, `1m23s`, `1h2m3s`. */
export function youtubeStartSecondsFromParam(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const v = raw.trim().toLowerCase();
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  }
  const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m) return null;
  const hours = Number(m[1] || 0);
  const mins = Number(m[2] || 0);
  const secs = Number(m[3] || 0);
  const total = hours * 3600 + mins * 60 + secs;
  return total > 0 || v === "0s" || v === "0" ? total : null;
}

/** Start time from a watch/embed URL (`t` or `start` query), if any. */
export function youtubeStartSecondsFromUrl(url: string): number | null {
  try {
    const u = new URL(url.trim());
    const fromT = youtubeStartSecondsFromParam(u.searchParams.get("t"));
    if (fromT != null) return fromT;
    return youtubeStartSecondsFromParam(u.searchParams.get("start"));
  } catch {
    const tMatch = url.match(/[?&#]t=([^&#]+)/i);
    if (tMatch) return youtubeStartSecondsFromParam(decodeURIComponent(tMatch[1]));
    const sMatch = url.match(/[?&#]start=(\d+)/i);
    if (sMatch) return youtubeStartSecondsFromParam(sMatch[1]);
    return null;
  }
}

export function youtubeEmbedUrl(
  url: string,
  options: YoutubeEmbedOptions = {},
): string | null {
  const id = youtubeVideoId(url);
  if (!id) return null;
  const params = new URLSearchParams({
    rel: "0",
    playsinline: "1",
    modestbranding: "1",
  });
  if (options.autoplay) {
    params.set("autoplay", "1");
    params.set("mute", options.mute === true ? "1" : "0");
  }
  if (options.enableJsApi || options.origin) {
    params.set("enablejsapi", "1");
  }
  if (options.origin?.trim()) {
    params.set("origin", options.origin.trim());
  }
  // Never loop a free-ticket gag / intro embed
  params.set("loop", "0");
  const start =
    options.startSeconds != null && Number.isFinite(options.startSeconds)
      ? Math.max(0, Math.floor(options.startSeconds))
      : youtubeStartSecondsFromUrl(url);
  if (start != null && start > 0) {
    params.set("start", String(start));
  }
  // Use www.youtube.com (not nocookie) so enablejsapi postMessage unMute/setVolume is reliable.
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

export function isYoutubeUrl(url: string): boolean {
  return youtubeVideoId(url) !== null;
}

/** Canonical watch URL for storage (accepts youtu.be, shorts, embed, etc.). */
export function normalizeYoutubeWatchUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}