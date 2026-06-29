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
  /** Browsers block audible autoplay without a gesture — default mute when autoplay is on. */
  mute?: boolean;
  enableJsApi?: boolean;
  origin?: string;
};

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
    params.set("mute", options.mute === false ? "0" : "1");
  }
  if (options.enableJsApi || options.origin) {
    params.set("enablejsapi", "1");
  }
  if (options.origin?.trim()) {
    params.set("origin", options.origin.trim());
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
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