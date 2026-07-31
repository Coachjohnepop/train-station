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
import {
  applyMediaVolumeDb,
  clampVolumeDb,
  linearMultiplierToDb,
  volumeDbToYoutubePercent,
} from "@/lib/media-volume";
import { isDirectVideoUrl } from "@/lib/site-video";
import { isYoutubeUrl } from "@/lib/youtube";
import {
  ensureYoutubeAudible,
  kickYoutubeAudible,
  killYoutubeEmbed,
  postYoutubeEmbedCommand,
} from "@/lib/youtube-embed-control";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";
import { requestBackgroundMusicPlay } from "@/lib/background-music-control";

/** Free-ticket Jeremy intro: 3× louder than admin content volume offset. */
const JEREMY_WORD_VOLUME_MULT = 3;

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
  /** After handoff, never send another command to the gag iframe. */
  const gagLiveRef = useRef(false);

  const signedIn = Boolean(purchaseAuth.signedIn);
  const gag = productFreeTicketGag({ signedIn });
  const volumeDb = useUploadedContentVolumeDb();

  useEffect(() => {
    setEmbedOrigin(window.location.origin);
  }, []);

  // One Free Explorer clip: free-ticket slot (synced with plan explorer) → overall welcome.
  // Never use rickroll as Jeremy.
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
   * Embed autoplays once (user just tapped Free). We never postMessage playVideo
   * on the gag — only unMute/volume. At handoff we kill + unmount the iframe so
   * YouTube cannot restart the chorus (~:49) for a few bars.
   */
  const rickrollSrc =
    gag.enabled && embedOrigin
      ? landingVideoEmbedSrc(gag.videoUrl, true, {
          mute: false,
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

  function killGagNow() {
    gagLiveRef.current = false;
    killYoutubeEmbed(rickrollRef.current);
    setHideRickroll(true);
  }

  /** Admin content dB × 3 for “A word from Jeremy” (HTML5 can exceed 1.0 via GainNode). */
  const jeremyVolumeDb = clampVolumeDb(
    volumeDb + linearMultiplierToDb(JEREMY_WORD_VOLUME_MULT),
  );

  // Open / close lifecycle — only re-run when `open` or gag on/off flips (not volume/hasJeremy)
  useEffect(() => {
    clearTimers();

    if (!open) {
      gagLiveRef.current = false;
      setShowJeremy(false);
      setFadeJeremyIn(false);
      setHideRickroll(false);
      setLoadJeremy(false);
      setBackgroundMusicOverlay(false);
      requestBackgroundMusicPlay();
      return;
    }

    setBackgroundMusicOverlay(true);
    setShowJeremy(false);
    setFadeJeremyIn(false);
    setHideRickroll(false);
    setLoadJeremy(false);
    gagLiveRef.current = gag.enabled;

    if (!gag.enabled) {
      setLoadJeremy(true);
      setShowJeremy(true);
      setFadeJeremyIn(true);
      setHideRickroll(true);
      gagLiveRef.current = false;
      return () => {
        clearTimers();
        setBackgroundMusicOverlay(false);
      };
    }

    // Preload Jeremy under gag (no audio commands to gag iframe)
    if (hasJeremy) {
      schedule(() => setLoadJeremy(true), preloadMs);
    }

    // Handoff: hard-kill gag iframe immediately, then fade Jeremy in.
    // Volume fade while iframe still live was letting YT re-cue a few bars (~:49).
    schedule(() => {
      killGagNow();
      setShowJeremy(true);
      requestAnimationFrame(() => setFadeJeremyIn(true));
    }, gagDurationMs);

    return () => {
      clearTimers();
      gagLiveRef.current = false;
      killYoutubeEmbed(rickrollRef.current);
      setBackgroundMusicOverlay(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only restart gag schedule when modal opens
  }, [open, gag.enabled, gagDurationMs, hasJeremy, preloadMs]);

  // Gag: autoplay already running. UnMute/volume only while gag is live — never after handoff.
  useEffect(() => {
    if (!open || !rickrollSrc || !gag.enabled) return;
    const gen = ++rickrollKickGen.current;
    gagLiveRef.current = true;

    const audibleOnly = () => {
      if (gen !== rickrollKickGen.current || !gagLiveRef.current) return;
      ensureYoutubeAudible(rickrollRef.current);
    };

    const ids = [150, 500].map((ms) => window.setTimeout(audibleOnly, ms));

    const onMsg = (e: MessageEvent) => {
      if (gen !== rickrollKickGen.current || !gagLiveRef.current) return;
      let data: unknown = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      if ((data as { event?: string }).event === "onReady") {
        audibleOnly();
      }
    };
    window.addEventListener("message", onMsg);

    return () => {
      ids.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("message", onMsg);
    };
  }, [open, rickrollSrc, gag.enabled]);

  // Jeremy: play + unMute once he fades in; 3× louder than admin content volume.
  useEffect(() => {
    if (!fadeJeremyIn || !hasJeremy) return;
    const kick = () => {
      if (jeremyIsYoutube) {
        const iframe = jeremyIframeRef.current;
        kickYoutubeAudible(iframe);
        const pct = volumeDbToYoutubePercent(jeremyVolumeDb);
        postYoutubeEmbedCommand(iframe, "setVolume", pct);
      } else if (jeremyVideoRef.current) {
        const el = jeremyVideoRef.current;
        el.muted = false;
        applyMediaVolumeDb(el, jeremyVolumeDb);
        void el.play().catch(() => {
          /* may need another tap on locked-down browsers */
        });
      }
    };
    const t1 = window.setTimeout(kick, 200);
    const t2 = window.setTimeout(kick, 600);
    const t3 = window.setTimeout(kick, 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [fadeJeremyIn, hasJeremy, jeremyIsYoutube, jeremyVolumeDb]);

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
              : "Coach intro not uploaded yet — Free still works. Continue below, or coach can set Free Explorer under Admin → Videos."
            : "You tapped Free. Enjoy the chorus… then hear from your coach."}
        </p>

        <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-xl bg-black ring-1 ring-amber-500/20">
          {rickrollSrc && !hideRickroll && (
            <iframe
              ref={rickrollRef}
              // One stable iframe for this open — remount = second play
              key="free-gag-rickroll"
              className={`absolute inset-0 h-full w-full transition-opacity ease-in-out ${
                fadeJeremyIn ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
              style={{ transitionDuration: `${FREE_TICKET_RICKROLL_FADE_MS}ms` }}
              src={rickrollSrc}
              title="You picked free"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              onLoad={() => {
                if (!gagLiveRef.current) return;
                // Autoplay already running — unmute only, never playVideo
                ensureYoutubeAudible(rickrollRef.current);
              }}
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
              muted={false}
              autoPlay
              preload="auto"
              onLoadedMetadata={(e) => {
                e.currentTarget.muted = false;
                applyMediaVolumeDb(e.currentTarget, jeremyVolumeDb);
              }}
              onPlay={(e) => {
                e.currentTarget.muted = false;
                applyMediaVolumeDb(e.currentTarget, jeremyVolumeDb);
              }}
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
