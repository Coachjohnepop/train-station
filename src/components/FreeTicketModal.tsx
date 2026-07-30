"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import {
  FREE_TICKET_RICKROLL_FADE_MS,
  isRickrollVideoUrl,
  landingVideoEmbedSrc,
  productFreeTicketGag,
} from "@/lib/landing-media";
import { applyMediaVolumeDb, volumeDbToYoutubePercent } from "@/lib/media-volume";
import { isDirectVideoUrl } from "@/lib/site-video";
import { isYoutubeUrl } from "@/lib/youtube";
import { postYoutubeEmbedCommand } from "@/lib/youtube-embed-control";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";

/**
 * Free / Explorer ticket open:
 *
 * Guests (not signed in):
 *   1) Hard-coded ~10s Rickroll from chorus (product fixed — not admin Shorts)
 *   2) Crossfade to Jeremy’s free-tier intro (Admin free-ticket slot, else welcome)
 *
 * Signed-in members: skip gag → Jeremy intro only (or empty CTA if not uploaded).
 *
 * Free is a real product path (Explorer), not a joke-only dead end.
 */
export default function FreeTicketModal({
  open,
  onClose,
  onUpgrade,
  onContinueFree,
  freeChastiseVideoUrl = null,
  welcomeVideoUrl = null,
  /** @deprecated Product gag is fixed; prop ignored for URL/duration. */
  gagConfig: _gagConfig = null,
  purchaseAuth = { signedIn: false },
}: {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  /** If set, Free continue stays in parent flow (e.g. tour) instead of navigating. */
  onContinueFree?: () => void;
  /** Jeremy free-tier intro (after gag). Not the rickroll. */
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
  gagConfig?: unknown;
  purchaseAuth?: PurchaseAuth;
}) {
  void _gagConfig;
  const [showJeremy, setShowJeremy] = useState(false);
  const [fadeJeremyIn, setFadeJeremyIn] = useState(false);
  const [hideRickroll, setHideRickroll] = useState(false);
  const [loadJeremy, setLoadJeremy] = useState(false);
  /** Stable after mount so iframe src does not change (remount = restart hitch). */
  const [embedOrigin, setEmbedOrigin] = useState<string | undefined>(undefined);
  const timersRef = useRef<number[]>([]);
  const rickrollRef = useRef<HTMLIFrameElement>(null);
  const jeremyIframeRef = useRef<HTMLIFrameElement>(null);
  const jeremyVideoRef = useRef<HTMLVideoElement>(null);
  const rickrollKickGen = useRef(0);

  const signedIn = Boolean(purchaseAuth.signedIn);
  const gag = productFreeTicketGag({ signedIn });
  const volumeDb = useUploadedContentVolumeDb();

  useEffect(() => {
    setEmbedOrigin(window.location.origin);
  }, []);

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

  /**
   * Mute + start= in the embed URL (chorus once). Do NOT re-seek via postMessage —
   * repeated seekTo was the hitch/restart. Only play + unMute after load.
   */
  const rickrollSrc =
    gag.enabled && embedOrigin
      ? landingVideoEmbedSrc(gag.videoUrl, true, {
          mute: true,
          origin: embedOrigin,
          startSeconds: gag.startSec,
        })
      : null;

  const jeremyYtSrc =
    loadJeremy && hasJeremy && jeremyIsYoutube && embedOrigin
      ? landingVideoEmbedSrc(jeremyVideoUrl, true, {
          mute: true,
          origin: embedOrigin,
        })
      : null;
  const showJeremyFile = loadJeremy && hasJeremy && jeremyIsDirect && Boolean(jeremyVideoUrl);

  const gagDurationMs = gag.enabled ? gag.durationMs : 0;
  const preloadMs = Math.max(0, gagDurationMs - 3_000);

  function clearTimers() {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }

  function schedule(fn: () => void, ms: number) {
    timersRef.current.push(window.setTimeout(fn, ms));
  }

  /** Play + unMute only — never seek (start= is already on the embed). */
  function kickYoutubePlay(iframe: HTMLIFrameElement | null) {
    if (!iframe) return;
    postYoutubeEmbedCommand(iframe, "playVideo");
    postYoutubeEmbedCommand(iframe, "unMute");
  }

  useEffect(() => {
    clearTimers();

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

    if (!gag.enabled) {
      // Signed-in path (or kill switch): Jeremy immediately.
      setLoadJeremy(true);
      setShowJeremy(true);
      setFadeJeremyIn(true);
      setHideRickroll(true);
      return () => {
        clearTimers();
        setBackgroundMusicOverlay(false);
      };
    }

    if (hasJeremy) {
      schedule(() => setLoadJeremy(true), preloadMs);
    }

    schedule(() => {
      setShowJeremy(true);
      requestAnimationFrame(() => setFadeJeremyIn(true));
    }, gagDurationMs);

    schedule(() => setHideRickroll(true), gagDurationMs + FREE_TICKET_RICKROLL_FADE_MS);

    return () => {
      clearTimers();
      setBackgroundMusicOverlay(false);
    };
  }, [open, hasJeremy, preloadMs, gag.enabled, gagDurationMs]);

  // Gag: one smooth start — play/unmute only (no seek). Light retry if player was slow.
  useEffect(() => {
    if (!open || !rickrollSrc) return;
    const gen = ++rickrollKickGen.current;
    const kick = () => {
      if (gen !== rickrollKickGen.current) return;
      kickYoutubePlay(rickrollRef.current);
    };
    // Wait for iframe paint; second try if still muted/not playing (no seek).
    const t1 = window.setTimeout(kick, 350);
    const t2 = window.setTimeout(kick, 900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, rickrollSrc]);

  // Jeremy: play + unMute once he fades in (no seek); apply admin volume offset.
  useEffect(() => {
    if (!fadeJeremyIn || !hasJeremy) return;
    const kick = () => {
      if (jeremyIsYoutube) {
        kickYoutubePlay(jeremyIframeRef.current);
        const iframe = jeremyIframeRef.current;
        if (iframe?.contentWindow) {
          const pct = volumeDbToYoutubePercent(volumeDb);
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "setVolume", args: [pct] }),
            "*",
          );
        }
      } else if (jeremyVideoRef.current) {
        const el = jeremyVideoRef.current;
        el.muted = false;
        applyMediaVolumeDb(el, volumeDb);
        void el.play().catch(() => {
          /* may need another tap on locked-down browsers */
        });
      }
    };
    const t1 = window.setTimeout(kick, 400);
    const t2 = window.setTimeout(kick, 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [fadeJeremyIn, hasJeremy, jeremyIsYoutube, volumeDb]);

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
              ? "Explorer is real access — starter programs, about 20% of Coach Class power. No homework required."
              : "Coach intro not uploaded yet — Free still works. Continue below, or coach can set the free-ticket video under Admin → Videos."
            : "You tapped Free. Enjoy the chorus… then hear from your coach."}
        </p>

        <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-xl bg-black ring-1 ring-amber-500/20">
          {rickrollSrc && !hideRickroll && (
            <iframe
              ref={rickrollRef}
              // Stable key for this open cycle — do not remount on parent re-renders.
              key={`rickroll-${open ? "on" : "off"}`}
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
              autoPlay
              preload="auto"
              onLoadedMetadata={(e) => applyMediaVolumeDb(e.currentTarget, volumeDb)}
              onPlay={(e) => applyMediaVolumeDb(e.currentTarget, volumeDb)}
            />
          )}

          {showJeremy && !hasJeremy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center text-xs text-[#9d8ab8]">
              <p className="font-medium text-white">Coach intro coming soon</p>
              <p className="mt-2 max-w-xs leading-relaxed">
                Free / Explorer still opens real access. Grab your ticket below — Jeremy will add his
                free-tier intro under{" "}
                <Link href="/admin/videos" className="text-[#7c3aed] underline">
                  Admin → Videos
                </Link>
                .
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
          {onContinueFree ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onContinueFree();
              }}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#3d2660] text-sm font-semibold text-[#9d8ab8] hover:text-white hover:border-[#7c3aed]/40 transition"
            >
              Continue with Free / Explorer
            </button>
          ) : (
            <Link
              href={purchaseHref("explorer", purchaseAuth)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#3d2660] text-sm font-semibold text-[#9d8ab8] hover:text-white hover:border-[#7c3aed]/40 transition"
              onClick={onClose}
            >
              Continue with Free / Explorer
            </Link>
          )}
          <button type="button" onClick={onClose} className="text-xs text-[#9d8ab8] hover:text-white py-1">
            Never mind
          </button>
        </div>
      </div>
    </div>
  );
}
