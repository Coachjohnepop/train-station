export type YoutubeEmbedCommand =
  | "playVideo"
  | "pauseVideo"
  | "stopVideo"
  | "mute"
  | "unMute"
  | "seekTo"
  | "setVolume";

export function postYoutubeEmbedCommand(
  iframe: HTMLIFrameElement | null,
  func: YoutubeEmbedCommand,
  ...args: unknown[]
): void {
  if (!iframe?.contentWindow) return;
  // YouTube IFrame API: seekTo(seconds, allowSeekAhead); setVolume(0–100)
  const payloadArgs = args.length > 0 ? args : "";
  iframe.contentWindow.postMessage(
    JSON.stringify({ event: "command", func, args: payloadArgs }),
    "*",
  );
}

/**
 * Handshake so the embed accepts postMessage commands (enablejsapi=1 required on src).
 * Without this, unMute/setVolume are often ignored.
 */
export function primeYoutubeEmbed(iframe: HTMLIFrameElement | null): void {
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
      "*",
    );
  } catch {
    /* ignore */
  }
}

/**
 * Make embed audible. Never call playVideo if the clip already auto-started —
 * a second playVideo restarts from start= and the gag plays twice.
 */
export function kickYoutubeAudible(
  iframe: HTMLIFrameElement | null,
  opts?: {
    /** If true, do not call playVideo (embed already autoplaying). */
    noPlay?: boolean;
  },
): void {
  if (!iframe) return;
  primeYoutubeEmbed(iframe);
  if (!opts?.noPlay) {
    postYoutubeEmbedCommand(iframe, "playVideo");
  }
  postYoutubeEmbedCommand(iframe, "unMute");
  postYoutubeEmbedCommand(iframe, "setVolume", 100);
}

/** Unmute + full volume only — never restarts playback. */
export function ensureYoutubeAudible(iframe: HTMLIFrameElement | null): void {
  kickYoutubeAudible(iframe, { noPlay: true });
}

/**
 * Linear volume fade 100 → 0 over `durationMs`, then mute + pause.
 * Never calls playVideo (would restart the clip).
 */
export function fadeOutYoutubeEmbed(
  iframe: HTMLIFrameElement | null,
  durationMs = 2_000,
): () => void {
  if (!iframe?.contentWindow || durationMs <= 0) {
    killYoutubeEmbed(iframe);
    return () => {};
  }

  let cancelled = false;
  let rafId = 0;
  const start = performance.now();
  primeYoutubeEmbed(iframe);

  const finish = () => {
    killYoutubeEmbed(iframe);
  };

  const tick = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / durationMs);
    const pct = Math.max(0, Math.min(100, Math.round(100 * (1 - t))));
    postYoutubeEmbedCommand(iframe, "setVolume", pct);
    if (t < 1) {
      rafId = window.requestAnimationFrame(tick);
    } else {
      finish();
    }
  };

  rafId = window.requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(rafId);
  };
}

/** Hard stop — mute, volume 0, pause. No playVideo. */
export function killYoutubeEmbed(iframe: HTMLIFrameElement | null): void {
  if (!iframe) return;
  primeYoutubeEmbed(iframe);
  postYoutubeEmbedCommand(iframe, "setVolume", 0);
  postYoutubeEmbedCommand(iframe, "mute");
  postYoutubeEmbedCommand(iframe, "pauseVideo");
  postYoutubeEmbedCommand(iframe, "stopVideo" as YoutubeEmbedCommand);
}
