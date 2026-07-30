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
 * Linear volume fade 100 → 0 over exactly `durationMs` (default 2s), then mute + pause.
 * Uses rAF for smooth steps; posts setVolume often so YouTube actually ramps.
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

  // Start from full volume (in case player was quieter)
  postYoutubeEmbedCommand(iframe, "unMute");
  postYoutubeEmbedCommand(iframe, "setVolume", 100);

  const finish = () => {
    postYoutubeEmbedCommand(iframe, "setVolume", 0);
    postYoutubeEmbedCommand(iframe, "mute");
    postYoutubeEmbedCommand(iframe, "pauseVideo");
  };

  const tick = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / durationMs);
    // Linear to silent
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