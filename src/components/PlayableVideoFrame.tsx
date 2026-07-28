"use client";

import { useEffect, useRef } from "react";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";
import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";
import { isDirectVideoUrl } from "@/lib/site-video";
import { isYoutubeUrl, type YoutubeEmbedOptions } from "@/lib/youtube";

type Props = {
  videoUrl: string;
  title: string;
  className?: string;
  embedOptions?: Omit<YoutubeEmbedOptions, "autoplay">;
  /** When false (default), YouTube loads paused; native video still shows controls. */
  autoplay?: boolean;
  /** Nudge YouTube after load (member-facing modals only). */
  kickPlayback?: boolean;
  /** Pause site background music while this player is open/playing. */
  duckBackgroundMusic?: boolean;
};

/**
 * Plays YouTube embeds or uploaded MP4/WebM/MOV (Blob / local site-videos).
 */
export default function PlayableVideoFrame({
  videoUrl,
  title,
  className = "h-full w-full",
  embedOptions = {},
  autoplay = false,
  kickPlayback = false,
  duckBackgroundMusic = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!duckBackgroundMusic) return;
    if (!isDirectVideoUrl(videoUrl) || isYoutubeUrl(videoUrl)) return;
    return holdBackgroundMusicForMedia();
  }, [duckBackgroundMusic, videoUrl]);

  useEffect(() => {
    if (!autoplay || !kickPlayback) return;
    const el = videoRef.current;
    if (!el) return;
    const play = () => {
      void el.play().catch(() => {
        /* autoplay may need user gesture */
      });
    };
    const t1 = window.setTimeout(play, 100);
    const t2 = window.setTimeout(play, 800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [videoUrl, autoplay, kickPlayback]);

  if (isYoutubeUrl(videoUrl)) {
    return (
      <YoutubeAutoplayFrame
        videoUrl={videoUrl}
        title={title}
        className={className}
        embedOptions={embedOptions}
        autoplay={autoplay}
        kickPlayback={kickPlayback}
        duckBackgroundMusic={duckBackgroundMusic}
      />
    );
  }

  if (isDirectVideoUrl(videoUrl)) {
    return (
      <video
        ref={videoRef}
        className={className}
        src={videoUrl}
        title={title}
        controls
        playsInline
        autoPlay={autoplay}
        preload="metadata"
      />
    );
  }

  return null;
}
