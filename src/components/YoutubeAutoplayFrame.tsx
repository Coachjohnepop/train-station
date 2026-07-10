"use client";

import { useEffect, useRef, useState } from "react";
import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";
import { postYoutubeEmbedCommand } from "@/lib/youtube-embed-control";
import { youtubeEmbedUrl, type YoutubeEmbedOptions } from "@/lib/youtube";

type Props = {
  videoUrl: string;
  title: string;
  className?: string;
  embedOptions?: Omit<YoutubeEmbedOptions, "autoplay">;
  /** When false (default), embed loads paused — use in admin previews. */
  autoplay?: boolean;
  /** Nudge the player after load (member-facing modals only). */
  kickPlayback?: boolean;
  /** Pause site background music while this embed is open/playing (user-click flows). */
  duckBackgroundMusic?: boolean;
};

export default function YoutubeAutoplayFrame({
  videoUrl,
  title,
  className = "h-full w-full",
  embedOptions = {},
  autoplay = false,
  kickPlayback = false,
  duckBackgroundMusic = false,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);

  useEffect(() => {
    setEmbedSrc(
      youtubeEmbedUrl(videoUrl, {
        autoplay,
        mute: autoplay ? false : true,
        enableJsApi: autoplay,
        origin: autoplay ? window.location.origin : undefined,
        ...embedOptions,
      }),
    );
    // embedOptions intentionally omitted — callers pass stable overrides only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, autoplay]);

  useEffect(() => {
    if (!duckBackgroundMusic) return;
    return holdBackgroundMusicForMedia();
  }, [duckBackgroundMusic]);

  useEffect(() => {
    if (!autoplay || !kickPlayback || !embedSrc) return;
    const kick = () => {
      postYoutubeEmbedCommand(iframeRef.current, "playVideo");
      postYoutubeEmbedCommand(iframeRef.current, "unMute");
    };
    const t1 = window.setTimeout(kick, 250);
    const t2 = window.setTimeout(kick, 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [embedSrc, kickPlayback, autoplay]);

  if (!embedSrc) return null;

  return (
    <iframe
      ref={iframeRef}
      className={className}
      src={embedSrc}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}