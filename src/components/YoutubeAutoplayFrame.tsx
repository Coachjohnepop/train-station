"use client";

import { useEffect, useRef, useState } from "react";
import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";
import {
  DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
  volumeDbToYoutubePercent,
} from "@/lib/media-volume";
import {
  kickYoutubeAudible,
  postYoutubeEmbedCommand,
} from "@/lib/youtube-embed-control";
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
  /** Relative dB from native; YouTube can only attenuate (boost capped at 100). */
  volumeDb?: number;
};

export default function YoutubeAutoplayFrame({
  videoUrl,
  title,
  className = "h-full w-full",
  embedOptions = {},
  autoplay = false,
  kickPlayback = false,
  duckBackgroundMusic = false,
  volumeDb = DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);

  useEffect(() => {
    setEmbedSrc(
      youtubeEmbedUrl(videoUrl, {
        autoplay,
        mute: autoplay ? false : true,
        enableJsApi: true,
        origin: typeof window !== "undefined" ? window.location.origin : undefined,
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
    if (!embedSrc) return;
    const pct = volumeDbToYoutubePercent(volumeDb);
    const kick = () => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      if (autoplay || kickPlayback) {
        kickYoutubeAudible(iframe);
      }
      postYoutubeEmbedCommand(iframe, "setVolume", pct);
    };
    const delays = [100, 300, 700, 1400];
    const ids = delays.map((ms) => window.setTimeout(kick, ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [embedSrc, kickPlayback, autoplay, volumeDb]);

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
