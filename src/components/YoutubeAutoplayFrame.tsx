"use client";

import { useEffect, useRef, useState } from "react";
import { postYoutubeEmbedCommand } from "@/lib/youtube-embed-control";
import { youtubeEmbedUrl, type YoutubeEmbedOptions } from "@/lib/youtube";

type Props = {
  videoUrl: string;
  title: string;
  className?: string;
  embedOptions?: Omit<YoutubeEmbedOptions, "autoplay">;
  /** Nudge the player after load (helps after a tap / modal open). */
  kickPlayback?: boolean;
};

export default function YoutubeAutoplayFrame({
  videoUrl,
  title,
  className = "h-full w-full",
  embedOptions = {},
  kickPlayback = true,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);

  useEffect(() => {
    setEmbedSrc(
      youtubeEmbedUrl(videoUrl, {
        autoplay: true,
        mute: false,
        enableJsApi: true,
        origin: window.location.origin,
        ...embedOptions,
      }),
    );
    // embedOptions intentionally omitted — callers pass stable overrides only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  useEffect(() => {
    if (!kickPlayback || !embedSrc) return;
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
  }, [embedSrc, kickPlayback]);

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