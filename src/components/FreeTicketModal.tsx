"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import {
  FREE_TICKET_RICKROLL_FADE_MS,
  isRickrollVideoUrl,
  landingVideoEmbedSrc,
  resolveFreeTicketGag,
  type FreeTicketGagConfig,
} from "@/lib/landing-media";
import { isDirectVideoUrl } from "@/lib/site-video";
import { isYoutubeUrl } from "@/lib/youtube";
import { postYoutubeEmbedCommand } from "@/lib/youtube-embed-control";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";

/**
 * Free / Explorer ticket open:
 * 1) Play gag (default Rickroll ~10s from chorus; admin-configurable).
 * 2) Crossfade to Jeremy’s free-tier intro (admin free-ticket video, else welcome).
 */
export default function FreeTicketModal({
  open,
  onClose,
  onUpgrade,
  freeChastiseVideoUrl = null,
  welcomeVideoUrl = null,
  gagConfig = null,
  purchaseAuth = { signedIn: false },
}: {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  /** Jeremy free-tier intro (after gag). Not the rickroll. */
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
  /** From Admin → Videos (optional). Accepts FreeTicketGagConfig or API shape with durationSec. */
  gagConfig?:
    | (Partial<FreeTicketGagConfig> & { durationSec?: number })
    | null;
  purchaseAuth?: PurchaseAuth;
}) {
  const [showJeremy, setShowJeremy] = useState(false);
  const [fadeJeremyIn, setFadeJeremyIn] = useState(false);
  const [hideRickroll, setHideRickroll] = useState(false);
  const [loadJeremy, setLoadJeremy] = useState(false);
  const timersRef = useRef<number[]>([]);
  const rickrollRef = useRef<HTMLIFrameElement>(null);
  const jeremyIframeRef = useRef<HTMLIFrameElement>(null);
  const jeremyVideoRef = useRef<HTMLVideoElement>(null);

  const embedOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
  const durationSecFromConfig =
    gagConfig && "durationSec" in gagConfig && gagConfig.durationSec != null
      ? gagConfig.durationSec
      : gagConfig?.durationMs != null
        ? Math.round(gagConfig.durationMs / 1000)
        : undefined;
  const gag = resolveFreeTicketGag({
    gagEnabled: gagConfig?.enabled,
    gagVideoUrl: gagConfig?.videoUrl,
    gagStartSec: gagConfig?.startSec,
    gagDurationSec: durationSecFromConfig,
  });

  // Prefer free-ticket intro; fall back to general welcome (never use rickroll as Jeremy).
  const jeremyVideoUrl = (() => {
    const free = freeChastiseVideoUrl?.trim();
    if (free && !isRickrollVideoUrl(free)) return free;
    const welcome = welcomeVideoUrl?.trim();
    if (welcome && !isRickrollVideoUrl(welcome)) return welcome;
    return null;
  })();
  const hasJeremy = Boolean(jeremyVideoUrl);
  const jeremyIsYoutube = Boolean(jeremyVideoUrl && isYoutubeUrl(jeremyVideoUrl));
  const jeremyIsDirect = Boolean(
    jeremyVideoUrl && !jeremyIsYoutube && isDirectVideoUrl(jeremyVideoUrl),
  );

  const rickrollSrc = gag.enabled
    ? landingVideoEmbedSrc(gag.videoUrl, true, {
        mute: false,
        origin: embedOrigin,
        startSeconds: gag.startSec,
      })
    : null;

  const jeremyYtSrc =
    loadJeremy && hasJeremy && jeremyIsYoutube
      ? landingVideoEmbedSrc(jeremyVideoUrl, true, { mute: false, origin: embedOrigin })
      : null;
  const showJeremyFile = loadJeremy && hasJeremy && jeremyIsDirect && Boolean(jeremyVideoUrl);

  // Preload Jeremy iframe a few seconds before the crossfade.
  const gagDurationMs = gag.enabled ? gag.durationMs : 0;
  const preloadMs = Math.max(0, gagDurationMs - 3_000);

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

    if (!gag.enabled) {
      // Skip gag — load Jeremy immediately.
      setLoadJeremy(true);
      setShowJeremy(true);
      setFadeJeremyIn(true);
      setHideRickroll(true);
      return () => {
        timersRef.current.forEach((id) => window.clearTimeout(id));
        timersRef.current = [];
        setBackgroundMusicOverlay(false);
      };
    }

    if (hasJeremy) {
      schedule(() => setLoadJeremy(true), preloadMs);
    }

    // Gag duration → crossfade to Jeremy (or empty state copy).
    schedule(() => {
      setShowJeremy(true);
      requestAnimationFrame(() => setFadeJeremyIn(true));
    }, gagDurationMs);

    schedule(
      () => setHideRickroll(true),
      gagDurationMs + FREE_TICKET_RICKROLL_FADE_MS,
    );

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
      setBackgroundMusicOverlay(false);
    };
  }, [open, hasJeremy, preloadMs, gag.enabled, gagDurationMs]);

  useEffect(() => {
    if (!open || !rickrollSrc) return;
    const kick = () => {
      postYoutubeEmbedCommand(rickrollRef.current, "playVideo");
      postYoutubeEmbedCommand(rickrollRef.current, "unMute");
      // Seek to chorus in case embed ignored start= on some devices.
      postYoutubeEmbedCommand(rickrollRef.current, "seekTo", gag.startSec, true);
    };
    const t1 = window.setTimeout(kick, 200);
    const t2 = window.setTimeout(kick, 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, rickrollSrc, gag.startSec]);

  useEffect(() => {
    if (!fadeJeremyIn || !hasJeremy) return;
    const kick = () => {
      if (jeremyIsYoutube) {
        postYoutubeEmbedCommand(jeremyIframeRef.current, "playVideo");
        postYoutubeEmbedCommand(jeremyIframeRef.current, "unMute");
      } else if (jeremyVideoRef.current) {
        void jeremyVideoRef.current.play().catch(() => {
          /* gesture may be required */
        });
      }
    };
    const t1 = window.setTimeout(kick, 400);
    const t2 = window.setTimeout(kick, 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [fadeJeremyIn, hasJeremy, jeremyIsYoutube]);

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
              : "Paste Jeremy’s free-tier intro under Admin → Videos (free-ticket intro)."
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

          {jeremyYtSrc && (
            <iframe
              ref={jeremyIframeRef}
              key="jeremy-yt"
              className={`absolute inset-0 h-full w-full transition-opacity ease-in-out ${
                fadeJeremyIn ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              style={{ transitionDuration: `${FREE_TICKET_RICKROLL_FADE_MS}ms` }}
              src={jeremyYtSrc}
              title="Coach Jeremy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}

          {showJeremyFile && jeremyVideoUrl && (
            <video
              ref={jeremyVideoRef}
              key="jeremy-file"
              className={`absolute inset-0 h-full w-full object-contain bg-black transition-opacity ease-in-out ${
                fadeJeremyIn ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              style={{ transitionDuration: `${FREE_TICKET_RICKROLL_FADE_MS}ms` }}
              src={jeremyVideoUrl}
              title="Coach Jeremy"
              playsInline
              controls
              preload="auto"
            />
          )}

          {showJeremy && !hasJeremy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center text-xs text-[#9d8ab8]">
              <p className="font-medium text-white">Coach intro not set yet</p>
              <p className="mt-2">
                <Link href="/admin/videos" className="text-[#7c3aed] underline">
                  Admin → Videos
                </Link>{" "}
                → free-ticket intro (upload Jeremy&apos;s free-tier clip). The 10s chorus gag is
                built-in.
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
