"use client";

import { useEffect, useRef, useState } from "react";
import { warmUrl } from "@/lib/warm-media";
import { startThemeSongFromOnboardingPlay } from "@/lib/background-music-control";
import { unlockLandingMix } from "@/lib/landing-mix-audio";

export default function LandingAbClip({
  src,
  readySrc,
  poster,
  title,
  analyticsAction,
}: {
  src: string;
  /** Second half of the intro — shown beside / under part 1 with READY. */
  readySrc?: string | null;
  poster?: string | null;
  title: string;
  analyticsAction: string;
}) {
  const part1Ref = useRef<HTMLVideoElement>(null);
  const part2Ref = useRef<HTMLVideoElement>(null);
  const part2WrapRef = useRef<HTMLDivElement>(null);
  const [part1On, setPart1On] = useState(false);
  const [part2On, setPart2On] = useState(false);
  const [part2Armed, setPart2Armed] = useState(false);

  useEffect(() => {
    warmUrl(src, "video");
    if (readySrc) warmUrl(readySrc, "video");
  }, [src, readySrc]);

  async function playEl(el: HTMLVideoElement | null) {
    if (!el) return;
    unlockLandingMix();
    startThemeSongFromOnboardingPlay();
    try {
      el.muted = false;
      await el.play();
    } catch {
      try {
        el.muted = true;
        await el.play();
      } catch {
        /* ignore */
      }
    }
  }

  function snapPart2ToTop() {
    const node = part2WrapRef.current;
    if (!node) return;
    const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
    if (!mobile) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function playPart1() {
    part2Ref.current?.pause();
    setPart1On(true);
    await playEl(part1Ref.current);
  }

  async function playPart2() {
    part1Ref.current?.pause();
    setPart2Armed(true);
    setPart2On(true);
    snapPart2ToTop();
    await playEl(part2Ref.current);
  }

  if (!readySrc) {
    return (
      <SingleTile
        src={src}
        poster={poster}
        title={title}
        analyticsAction={analyticsAction}
        playing={part1On}
        videoRef={part1Ref}
        onPlay={() => void playPart1()}
        onEnded={() => setPart1On(false)}
      />
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      <SingleTile
        src={src}
        poster={poster}
        title={title}
        analyticsAction={analyticsAction}
        playing={part1On}
        videoRef={part1Ref}
        onPlay={() => void playPart1()}
        onEnded={() => {
          setPart1On(false);
          setPart2Armed(true);
          snapPart2ToTop();
        }}
      />
      <div ref={part2WrapRef} className="scroll-mt-[4.5rem] sm:scroll-mt-0">
        <SingleTile
          src={readySrc}
          title="Let’s Go!"
          analyticsAction="hero-meet-jeremy-ready"
          playing={part2On}
          videoRef={part2Ref}
          cta="Let’s Go!"
          hint={part2Armed ? "Part 2" : "After Intro"}
          onPlay={() => void playPart2()}
          onEnded={() => setPart2On(false)}
        />
      </div>
    </div>
  );
}

function SingleTile({
  src,
  poster,
  title,
  analyticsAction,
  playing,
  videoRef,
  onPlay,
  onEnded,
  cta,
  hint,
}: {
  src: string;
  poster?: string | null;
  title: string;
  analyticsAction: string;
  playing: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onPlay: () => void;
  onEnded: () => void;
  cta?: string;
  hint?: string;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/20">
      <video
        ref={videoRef}
        className="aspect-video w-full object-cover"
        src={src}
        poster={poster || undefined}
        playsInline
        preload="auto"
        controls={playing}
        onPlay={() => {
          /* parent owns phase */
        }}
        onEnded={onEnded}
        aria-label={title}
      />
      {playing ? null : (
        <button
          type="button"
          data-analytics-action={analyticsAction}
          onClick={onPlay}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 px-3 text-center"
        >
          <span className="landing-hero-clip-cta inline-flex min-h-12 min-w-[7.5rem] items-center justify-center rounded-full bg-[#7c3aed] px-6 text-base font-extrabold tracking-wide text-white">
            {cta || title}
          </span>
          {hint ? <span className="mt-2 text-[11px] font-semibold text-white/80">{hint}</span> : null}
        </button>
      )}
    </div>
  );
}
