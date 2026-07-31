export type YoutubeEmbedCommand =
  | "playVideo"
  | "pauseVideo"
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
 * Play + full volume + unmute (after prime).
 * Prefer `startOnce: true` for Free gag — repeated playVideo restarts the video.
 */
export function kickYoutubeAudible(
  iframe: HTMLIFrameElement | null,
  opts?: { startOnce?: boolean; alreadyStarted?: boolean },
): void {
  if (!iframe) return;
  primeYoutubeEmbed(iframe);
  // Only call playVideo once; later kicks only unMute/volume (no restart).
  if (!opts?.startOnce || !opts.alreadyStarted) {
    postYoutubeEmbedCommand(iframe, "playVideo");
  }
  postYoutubeEmbedCommand(iframe, "unMute");
  postYoutubeEmbedCommand(iframe, "setVolume", 100);
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
    postYoutubeEmbedCommand(iframe, "setVolume", 0);
    postYoutubeEmbedCommand(iframe, "mute");
    postYoutubeEmbedCommand(iframe, "pauseVideo");
    return () => {};
  }

  let cancelled = false;
  let rafId = 0;
  const start = performance.now();
  primeYoutubeEmbed(iframe);

  const finish = () => {
    postYoutubeEmbedCommand(iframe, "setVolume", 0);
    postYoutubeEmbedCommand(iframe, "mute");
    postYoutubeEmbedCommand(iframe, "pauseVideo");
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
