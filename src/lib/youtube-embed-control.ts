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
 * Ramp YouTube embed volume 100 → 0 over `durationMs`, then mute + pause.
 * Visual opacity fades separately in FreeTicketModal.
 */
export function fadeOutYoutubeEmbed(
  iframe: HTMLIFrameElement | null,
  durationMs: number,
): () => void {
  if (!iframe?.contentWindow || durationMs <= 0) {
    postYoutubeEmbedCommand(iframe, "mute");
    postYoutubeEmbedCommand(iframe, "pauseVideo");
    return () => {};
  }
  const steps = Math.max(8, Math.round(durationMs / 80));
  const stepMs = durationMs / steps;
  let i = 0;
  const id = window.setInterval(() => {
    i += 1;
    const pct = Math.max(0, Math.round(100 * (1 - i / steps)));
    postYoutubeEmbedCommand(iframe, "setVolume", pct);
    if (i >= steps) {
      window.clearInterval(id);
      postYoutubeEmbedCommand(iframe, "mute");
      postYoutubeEmbedCommand(iframe, "pauseVideo");
    }
  }, stepMs);
  return () => window.clearInterval(id);
}