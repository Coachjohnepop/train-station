"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import {
  FREE_TICKET_RICKROLL_CHORUS_START_SEC,
  FREE_TICKET_RICKROLL_DURATION_MS,
  FREE_TICKET_RICKROLL_FADE_MS,
  FREE_TICKET_RICKROLL_URL,
  isRickrollVideoUrl,
  landingVideoEmbedSrc,
} from "@/lib/landing-media";
import { postYoutubeEmbedCommand } from "@/lib/youtube-embed-control";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";

/**
 * Free / Explorer ticket open:
 * 1) Always play Rickroll from the chorus for ~10s (hard-coded gag).
 * 2) Crossfade to Jeremy’s free-tier intro (admin free-chastise URL, else welcome).
 */
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
  /** Jeremy free-tier intro (after gag). Not the rickroll. */
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

  // Prefer free-ticket intro; fall back to general welcome (never use rickroll as Jeremy).
  const jeremyVideoUrl = (() => {
    const free = freeChastiseVideoUrl?.trim();
    if (free && !isRickrollVideoUrl(free)) return free;
    const welcome = welcomeVideoUrl?.trim();
    if (welcome && !isRickrollVideoUrl(welcome)) return welcome;
    return null;
  })();
  const hasJeremy = Boolean(jeremyVideoUrl);

  const rickrollSrc = landingVideoEmbedSrc(FREE_TICKET_RICKROLL_URL, true, {
    mute: false,
    origin: embedOrigin,
    startSeconds: FREE_TICKET_RICKROLL_CHORUS_START_SEC,
  });

  const jeremySrc =
    loadJeremy && hasJeremy
      ? landingVideoEmbedSrc(jeremyVideoUrl, true, { mute: false, origin: embedOrigin })
      : null;

  // Preload Jeremy iframe a few seconds before the crossfade.
  const preloadMs = Math.max(0, FREE_TICKET_RICKROLL_DURATION_MS - 3_000);

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
    setShowJeremy(false);
    setFadeJeremyIn(false);
    setHideRickroll(false);
    setLoadJeremy(false);

    const schedule = (fn: () => void, ms: number) => {
      timersRef.current.push(window.setTimeout(fn, ms));
    };

    if (hasJeremy) {
      schedule(() => setLoadJeremy(true), preloadMs);
    }

    // 10s gag → crossfade to Jeremy (or empty state copy).
    schedule(() => {
      setShowJeremy(true);
      requestAnimationFrame(() => setFadeJeremyIn(true));
    }, FREE_TICKET_RICKROLL_DURATION_MS);

    schedule(
      () => setHideRickroll(true),
      FREE_TICKET_RICKROLL_DURATION_MS + FREE_TICKET_RICKROLL_FADE_MS,
    );

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
      setBackgroundMusicOverlay(false);
    };
  }, [open, hasJeremy, preloadMs]);

  useEffect(() => {
    if (!open || !rickrollSrc) return;
    const kick = () => {
      postYoutubeEmbedCommand(rickrollRef.current, "playVideo");
      postYoutubeEmbedCommand(rickrollRef.current, "unMute");
      // Seek to chorus in case embed ignored start= on some devices.
      postYoutubeEmbedCommand(
        rickrollRef.current,
        "seekTo",
        FREE_TICKET_RICKROLL_CHORUS_START_SEC,
        true,
      );
    };
    const t1 = window.setTimeout(kick, 200);
    const t2 = window.setTimeout(kick, 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, rickrollSrc]);

  useEffect(() => {
    if (!fadeJeremyIn || !hasJeremy) return;
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
  }, [fadeJeremyIn, hasJeremy]);

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
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
          Explorer ticket
        </p>
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
            ? hasJeremy
              ? "Explorer is real access to starter programs — no homework, no follow-up calls required."
              : "Paste Jeremy’s free-tier intro under Admin → Landing (free-ticket video)."
            : "You tapped Free. Enjoy the chorus… then hear from your coach."}
        </p>

        <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-xl bg-black ring-1 ring-amber-500/20">
          {rickrollSrc && !hideRickroll && (
            <iframe
              ref={rickrollRef}
              key="rickroll"
              className={`absolute inset-0 h-full w-full transition-opacity ease-in-out ${
                fadeJeremyIn ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
              style={{ transitionDuration: `${FREE_TICKET_RICKROLL_FADE_MS}ms` }}
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
              className={`absolute inset-0 h-full w-full transition-opacity ease-in-out ${
                fadeJeremyIn ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              style={{ transitionDuration: `${FREE_TICKET_RICKROLL_FADE_MS}ms` }}
              src={jeremySrc}
              title="Coach Jeremy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}

          {showJeremy && !hasJeremy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center text-xs text-[#9d8ab8]">
              <p className="font-medium text-white">Coach intro not set yet</p>
              <p className="mt-2">
                <Link href="/admin/landing" className="text-[#7c3aed] underline">
                  Admin → Landing
                </Link>{" "}
                → free-ticket video (Jeremy&apos;s free-tier intro). The 10s chorus gag is built-in.
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
