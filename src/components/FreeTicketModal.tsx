"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import { isIosDevice } from "@/lib/ios-device";
import { landingVideoEmbedSrc } from "@/lib/landing-media";
import { postYoutubeEmbedCommand } from "@/lib/youtube-embed-control";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";

const RICKROLL_MS = 10_000;
const FADE_MS = 1_500;
const JEREMY_PRELOAD_MS = 7_000;

export default function FreeTicketModal({
  open,
  onClose,
  onUpgrade,
  freeChastiseVideoUrl = null,
  welcomeVideoUrl = null,
  purchaseAuth = { signedIn: false },
}: {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
  purchaseAuth?: PurchaseAuth;
}) {
  const [needsTapToPlay] = useState(() => isIosDevice());
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const [showJeremy, setShowJeremy] = useState(false);
  const [fadeJeremyIn, setFadeJeremyIn] = useState(false);
  const [hideRickroll, setHideRickroll] = useState(false);
  const [loadJeremy, setLoadJeremy] = useState(false);
  const timersRef = useRef<number[]>([]);
  const rickrollRef = useRef<HTMLIFrameElement>(null);
  const jeremyRef = useRef<HTMLIFrameElement>(null);

  const readyToPlay = !needsTapToPlay || playbackStarted;
  const embedOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
  const hasRickroll = Boolean(freeChastiseVideoUrl?.trim());
  const hasJeremy = Boolean(welcomeVideoUrl?.trim());

  const rickrollSrc =
    readyToPlay && hasRickroll
      ? landingVideoEmbedSrc(freeChastiseVideoUrl, true, { mute: false, origin: embedOrigin })
      : null;
  const jeremySrc =
    loadJeremy && hasJeremy
      ? landingVideoEmbedSrc(welcomeVideoUrl, true, {
          mute: needsTapToPlay,
          origin: embedOrigin,
        })
      : null;

  useEffect(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    if (!open) {
      setPlaybackStarted(false);
      setShowJeremy(false);
      setFadeJeremyIn(false);
      setHideRickroll(false);
      setLoadJeremy(false);
      setBackgroundMusicOverlay(false);
      return;
    }

    setBackgroundMusicOverlay(true);

    if (!readyToPlay || !hasJeremy) return;

    const schedule = (fn: () => void, ms: number) => {
      timersRef.current.push(window.setTimeout(fn, ms));
    };

    schedule(() => setLoadJeremy(true), JEREMY_PRELOAD_MS);
    schedule(() => {
      setShowJeremy(true);
      requestAnimationFrame(() => setFadeJeremyIn(true));
    }, RICKROLL_MS);
    schedule(() => setHideRickroll(true), RICKROLL_MS + FADE_MS);

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
      setBackgroundMusicOverlay(false);
    };
  }, [open, readyToPlay, hasJeremy]);

  useEffect(() => {
    if (!fadeJeremyIn || !needsTapToPlay) return;
    const unmuteId = window.setTimeout(() => {
      postYoutubeEmbedCommand(jeremyRef.current, "unMute");
      postYoutubeEmbedCommand(jeremyRef.current, "playVideo");
    }, 400);
    return () => window.clearTimeout(unmuteId);
  }, [fadeJeremyIn, needsTapToPlay]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/90 p-2 sm:p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="free-ticket-title"
      onClick={onClose}
    >
      <div
        className="flex h-[min(92vh,720px)] w-full max-w-lg flex-col rounded-2xl border border-amber-500/30 bg-[#140a22] p-3 sm:p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">Explorer ticket</p>
        <h2 id="free-ticket-title" className="mt-1 text-lg font-semibold text-white sm:text-xl">
          {showJeremy ? (
            <>
              A word from <span className="text-amber-300">Coach Jeremy</span>
            </>
          ) : (
            <>
              Start small — <span className="text-amber-300">no strings</span>
            </>
          )}
        </h2>
        <p className="mt-1 text-xs text-[#9d8ab8] leading-relaxed sm:text-sm">
          {showJeremy
            ? "Explorer is real access to starter programs — no homework, no follow-up calls required."
            : needsTapToPlay && !playbackStarted
              ? "You tapped Free. Tap play below — then hear from your coach."
              : "You tapped Free. Enjoy the ride… then hear from your coach."}
        </p>

        <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-xl bg-black ring-1 ring-amber-500/20">
          {needsTapToPlay && !playbackStarted && hasRickroll && (
            <button
              type="button"
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center transition hover:bg-black/70 active:scale-[0.99]"
              onClick={() => setPlaybackStarted(true)}
            >
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-3xl text-amber-300 ring-2 ring-amber-400/50"
                aria-hidden
              >
                ▶
              </span>
              <span className="text-sm font-semibold text-white">Tap to play with sound</span>
              <span className="text-[11px] text-[#9d8ab8]">iPhone needs a tap inside the video</span>
            </button>
          )}

          {rickrollSrc && !hideRickroll && (
            <iframe
              ref={rickrollRef}
              key={`rickroll-${playbackStarted ? "on" : "off"}`}
              className={`absolute inset-0 h-full w-full transition-opacity duration-[1500ms] ease-in-out ${
                fadeJeremyIn ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
              src={rickrollSrc}
              title="You picked free"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}

          {jeremySrc && (
            <iframe
              ref={jeremyRef}
              key="jeremy"
              className={`absolute inset-0 h-full w-full transition-opacity duration-[1500ms] ease-in-out ${
                fadeJeremyIn ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              src={jeremySrc}
              title="Coach Jeremy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}

          {!hasRickroll && !hasJeremy && (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center p-4 text-center text-xs text-[#9d8ab8]">
              <p>Coach video coming soon.</p>
              <p className="mt-2 text-[#7c3aed]">
                <Link href="/admin/landing" className="underline">
                  Admin → Landing videos
                </Link>{" "}
                to paste your YouTube links.
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onUpgrade();
            }}
            className="h-11 rounded-full bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d2dd6] transition"
          >
            Show me Coach Class &amp; 1st Class →
          </button>
          <Link
            href={purchaseHref("explorer", purchaseAuth)}
            className="inline-flex h-11 items-center justify-center rounded-full border border-[#3d2660] text-sm font-semibold text-[#9d8ab8] hover:text-white hover:border-[#7c3aed]/40 transition"
            onClick={onClose}
          >
            OK fine — I really want free
          </Link>
          <button type="button" onClick={onClose} className="text-xs text-[#9d8ab8] hover:text-white py-1">
            Never mind
          </button>
        </div>
      </div>
    </div>
  );
}