"use client";

import { useEffect, useRef } from "react";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";
import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";
import {
  applyMediaVolumeDb,
  DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
} from "@/lib/media-volume";
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
  /**
   * Relative volume for uploaded / coach intro content (dB from native, steps of 3).
   * Default +6 dB so intros play louder.
   */
  volumeDb?: number;
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
  volumeDb = DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!duckBackgroundMusic) return;
    if (!isDirectVideoUrl(videoUrl) || isYoutubeUrl(videoUrl)) return;
    return holdBackgroundMusicForMedia();
  }, [duckBackgroundMusic, videoUrl]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    applyMediaVolumeDb(el, volumeDb);
  }, [videoUrl, volumeDb]);

  useEffect(() => {
    if (!autoplay || !kickPlayback) return;
    const el = videoRef.current;
    if (!el) return;
    const play = () => {
      applyMediaVolumeDb(el, volumeDb);
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
  }, [videoUrl, autoplay, kickPlayback, volumeDb]);

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
        volumeDb={volumeDb}
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
        // Never start muted — blob intros must be audible after user opens the player.
        muted={false}
        autoPlay={autoplay}
        preload="metadata"
        onLoadedMetadata={(e) => {
          e.currentTarget.muted = false;
          applyMediaVolumeDb(e.currentTarget, volumeDb);
        }}
        onPlay={(e) => {
          e.currentTarget.muted = false;
          applyMediaVolumeDb(e.currentTarget, volumeDb);
        }}
      />
    );
  }

  return null;
}
