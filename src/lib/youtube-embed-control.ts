export type YoutubeEmbedCommand = "playVideo" | "pauseVideo" | "mute" | "unMute";

export function postYoutubeEmbedCommand(
  iframe: HTMLIFrameElement | null,
  func: YoutubeEmbedCommand,
): void {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: "" }), "*");
}