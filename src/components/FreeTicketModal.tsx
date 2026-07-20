"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import {
  FREE_TICKET_RICKROLL_CHORUS_START_SEC,
  FREE_TICKET_RICKROLL_URL,
  landingVideoEmbedSrc,
} from "@/lib/landing-media";
import { postYoutubeEmbedCommand } from "@/lib/youtube-embed-control";
import { youtubeStartSecondsFromUrl } from "@/lib/youtube";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";

const RICKROLL_MS = 20_000;
const FADE_MS = 1_500;
const JEREMY_PRELOAD_MS = 17_000;

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
  const [showJeremy, setShowJeremy] = useState(false);
  const [fadeJeremyIn, setFadeJeremyIn] = useState(false);
  const [hideRickroll, setHideRickroll] = useState(false);
  const [loadJeremy, setLoadJeremy] = useState(false);
  const timersRef = useRef<number[]>([]);
  const rickrollRef = useRef<HTMLIFrameElement>(null);
  const jeremyRef = useRef<HTMLIFrameElement>(null);

  const embedOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
  // Always play free-tier gag (default Rickroll at chorus) unless admin clears with empty override.
  const freeVideoUrl = freeChastiseVideoUrl?.trim() || FREE_TICKET_RICKROLL_URL;
  const hasRickroll = Boolean(freeVideoUrl);
  const hasJeremy = Boolean(welcomeVideoUrl?.trim());
  const freeStartSec =
    youtubeStartSecondsFromUrl(freeVideoUrl) ?? FREE_TICKET_RICKROLL_CHORUS_START_SEC;

  const rickrollSrc = hasRickroll
    ? landingVideoEmbedSrc(freeVideoUrl, true, {
        mute: false,
        origin: embedOrigin,
        // Force chorus if URL has no t= (e.g. bare rickroll id stored in admin)
        startSeconds: freeStartSec,
      })
    : null;
  const jeremySrc =
    loadJeremy && hasJeremy
      ? landingVideoEmbedSrc(welcomeVideoUrl, true, { mute: false, origin: embedOrigin })
      : null;

  useEffect(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    if (!open) {
      setShowJeremy(false);
      setFadeJeremyIn(false);
      setHideRickroll(false);
      setLoadJeremy(false);
      setBackgroundMusicOverlay(false);
      return;
    }

    setBackgroundMusicOverlay(true);

    if (!hasJeremy) return;

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
  }, [open, hasJeremy]);

  useEffect(() => {
    if (!open || !rickrollSrc) return;
    const kick = () => {
      postYoutubeEmbedCommand(rickrollRef.current, "playVideo");
      postYoutubeEmbedCommand(rickrollRef.current, "unMute");
    };
    const t1 = window.setTimeout(kick, 200);
    const t2 = window.setTimeout(kick, 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, rickrollSrc]);

  useEffect(() => {
    if (!fadeJeremyIn) return;
    const kick = () => {
      postYoutubeEmbedCommand(jeremyRef.current, "playVideo");
      postYoutubeEmbedCommand(jeremyRef.current, "unMute");
    };
    const t1 = window.setTimeout(kick, 400);
    const t2 = window.setTimeout(kick, 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [fadeJeremyIn]);

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
            : "You tapped Free. Enjoy the ride… then hear from your coach."}
        </p>

        <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-xl bg-black ring-1 ring-amber-500/20">
          {rickrollSrc && !hideRickroll && (
            <iframe
              ref={rickrollRef}
              key="rickroll"
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