"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import {
  FREE_TICKET_RICKROLL_DURATION_MS,
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
import MembershipSeatArt from "@/components/MembershipSeatArt";

/** Free-ticket Jeremy intro: 3× louder than admin content volume offset. */
const JEREMY_WORD_VOLUME_MULT = 3;

/**
 * Free / Explorer ticket open:
 *
 * Guests (not signed in):
 *   1) Hard-coded ~5s Rickroll from chorus (product fixed — not admin Shorts)
 *   2) Crossfade to Jeremy’s free-tier intro (Admin free-ticket slot, else welcome)
 *
 * Signed-in members: skip gag → Jeremy intro only (or empty CTA if not uploaded).
 *
 * Mobile layout: **video on top**, free ticket art + CTAs scroll below.
 * Free enroll is an explicit secondary action (not auto, not primary).
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
  /**
   * Pin gag embed URL for this open session only. Changing iframe `src` remounts
   * YouTube and restarts the chorus — never rebuild this string mid-gag.
   */
  const [gagEmbedSrc, setGagEmbedSrc] = useState<string | null>(null);
  const [jeremyEmbedSrc, setJeremyEmbedSrc] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);
  const rickrollRef = useRef<HTMLIFrameElement>(null);
  const jeremyIframeRef = useRef<HTMLIFrameElement>(null);
  const jeremyVideoRef = useRef<HTMLVideoElement>(null);
  const rickrollKickGen = useRef(0);
  /** After handoff, never send another command to the gag iframe. */
  const gagLiveRef = useRef(false);
  /** One unMute for the gag per open — more kicks restart audio on iOS. */
  const gagUnmutedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const signedIn = Boolean(purchaseAuth.signedIn);
  const gag = productFreeTicketGag({ signedIn });
  const volumeDb = useUploadedContentVolumeDb();

  // Lock body scroll while open (mobile sheet)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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

  const showJeremyFile = loadJeremy && hasJeremy && jeremyIsDirect && Boolean(jeremyVideoUrl);

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

  // Open / close — only arm when `open` flips. Never rebuild gag mid-session.
  useEffect(() => {
    clearTimers();
    rickrollKickGen.current += 1;
    gagUnmutedRef.current = false;

    if (!open) {
      gagLiveRef.current = false;
      setShowJeremy(false);
      setFadeJeremyIn(false);
      setHideRickroll(false);
      setLoadJeremy(false);
      setGagEmbedSrc(null);
      setJeremyEmbedSrc(null);
      setBackgroundMusicOverlay(false);
      // Do not force theme song back — user may have muted; video just finished.
      return;
    }

    const origin = window.location.origin;
    setBackgroundMusicOverlay(true);
    setShowJeremy(false);
    setFadeJeremyIn(false);
    setHideRickroll(false);
    setLoadJeremy(false);
    setJeremyEmbedSrc(null);
    gagLiveRef.current = gag.enabled;

    // Scroll panel to top so video is first thing visible
    requestAnimationFrame(() => {
      panelRef.current?.scrollTo(0, 0);
    });

    if (!gag.enabled) {
      // Signed-in / gag off: Jeremy only, one load.
      if (hasJeremy && jeremyIsYoutube) {
        setJeremyEmbedSrc(
          landingVideoEmbedSrc(jeremyVideoUrl, true, {
            mute: true,
            origin,
          }),
        );
      }
      setLoadJeremy(true);
      setShowJeremy(true);
      setFadeJeremyIn(true);
      setHideRickroll(true);
      setGagEmbedSrc(null);
      gagLiveRef.current = false;
      return () => {
        clearTimers();
        setBackgroundMusicOverlay(false);
      };
    }

    /**
     * Mobile-clean gag:
     * - Start muted autoplay from chorus (reliable after the Free tap).
     * - UnMute once (onReady or single fallback) — never playVideo (restarts).
     * - Do NOT mount Jeremy while gag is live (second YT iframe restarts the gag on iOS).
     * - Pin src once in state so re-renders cannot remount the iframe.
     */
    const pinnedGag = landingVideoEmbedSrc(gag.videoUrl, true, {
      mute: true,
      origin,
      startSeconds: gag.startSec,
    });
    setGagEmbedSrc(pinnedGag);

    const duration = FREE_TICKET_RICKROLL_DURATION_MS;

    // Handoff: kill gag completely, then mount Jeremy once (never both YT embeds).
    schedule(() => {
      killGagNow();
      setGagEmbedSrc(null);
      if (hasJeremy && jeremyIsYoutube) {
        setJeremyEmbedSrc(
          landingVideoEmbedSrc(jeremyVideoUrl, true, {
            mute: true,
            origin,
          }),
        );
      }
      setLoadJeremy(true);
      setShowJeremy(true);
      requestAnimationFrame(() => setFadeJeremyIn(true));
    }, duration);

    return () => {
      clearTimers();
      gagLiveRef.current = false;
      killYoutubeEmbed(rickrollRef.current);
      setBackgroundMusicOverlay(false);
    };
    // Intentionally only `open` — do not re-arm gag when props re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Gag audio: one unMute after autoplay — never playVideo (that restarts from start=).
  useEffect(() => {
    if (!open || !gagEmbedSrc || !gag.enabled) return;
    const gen = ++rickrollKickGen.current;
    gagLiveRef.current = true;
    gagUnmutedRef.current = false;

    const unmuteOnce = () => {
      if (gen !== rickrollKickGen.current || !gagLiveRef.current) return;
      if (gagUnmutedRef.current) return;
      gagUnmutedRef.current = true;
      ensureYoutubeAudible(rickrollRef.current);
    };

    // Single fallback if onReady is late; do not stack 150/500/onLoad kicks.
    const fallbackId = window.setTimeout(unmuteOnce, 400);

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
        unmuteOnce();
      }
    };
    window.addEventListener("message", onMsg);

    return () => {
      window.clearTimeout(fallbackId);
      window.removeEventListener("message", onMsg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gagEmbedSrc]);

  // Jeremy: one play/unMute after fade-in (stacked playVideo restarts on mobile).
  useEffect(() => {
    if (!fadeJeremyIn || !hasJeremy) return;
    let cancelled = false;
    let playSent = false;

    const kick = () => {
      if (cancelled || playSent) return;
      if (jeremyIsYoutube) {
        const iframe = jeremyIframeRef.current;
        if (!iframe?.contentWindow) return;
        playSent = true;
        kickYoutubeAudible(iframe);
        postYoutubeEmbedCommand(iframe, "setVolume", volumeDbToYoutubePercent(jeremyVolumeDb));
        return;
      }
      if (jeremyVideoRef.current) {
        playSent = true;
        const el = jeremyVideoRef.current;
        el.muted = false;
        applyMediaVolumeDb(el, jeremyVolumeDb);
        void el.play().catch(() => {
          /* may need another tap on locked-down browsers */
        });
      }
    };

    const t1 = window.setTimeout(kick, 350);
    const t2 = window.setTimeout(kick, 900); // only runs if t1 found no iframe yet
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [fadeJeremyIn, hasJeremy, jeremyIsYoutube, jeremyVolumeDb]);

  if (!open) return null;

  const freeHref = purchaseHref("explorer", purchaseAuth);

  function handleContinueFree() {
    onClose();
    onContinueFree?.();
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/90 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="free-ticket-title"
      onClick={onClose}
    >
      {/* Full-height mobile sheet; scroll so video stays first, ticket + CTAs below */}
      <div
        ref={panelRef}
        className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-y-auto overscroll-contain rounded-t-2xl border border-amber-500/30 bg-[var(--surface)] shadow-2xl sm:max-h-[min(92vh,760px)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Safe area top on notched phones */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-[var(--surface)]/95 px-3 py-2 backdrop-blur-md sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
            Explorer ticket
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        {/* VIDEO FIRST — always at top of scroll content on phone */}
        <div className="relative aspect-video w-full shrink-0 bg-black sm:mt-0">
          {gagEmbedSrc && !hideRickroll && !showJeremy && (
            <iframe
              ref={rickrollRef}
              key="free-gag-rickroll"
              className="absolute inset-0 h-full w-full"
              src={gagEmbedSrc}
              title="You picked free"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              // No onLoad unMute — stacked kicks restart the gag on mobile.
            />
          )}

          {jeremyEmbedSrc && loadJeremy && jeremyIsYoutube && (
            <iframe
              ref={jeremyIframeRef}
              key="jeremy-yt"
              className={`absolute inset-0 h-full w-full transition-opacity ease-in-out ${
                fadeJeremyIn ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              style={{ transitionDuration: `${FREE_TICKET_RICKROLL_FADE_MS}ms` }}
              src={jeremyEmbedSrc}
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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center text-xs text-[var(--muted)]">
              <p className="font-medium text-white">Coach intro coming soon</p>
              <p className="mt-2 max-w-xs leading-relaxed">
                Free / Explorer still opens real access. Scroll for your ticket — Jeremy will add
                his free-tier intro under{" "}
                <Link href="/admin/videos" className="text-[#7c3aed] underline">
                  Admin → Videos
                </Link>
                .
              </p>
            </div>
          )}
        </div>

        {/* Ticket + copy + CTAs — scroll into view under the video */}
        <div className="flex flex-col gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-5">
          <div className="flex items-start gap-3">
            <div className="w-[88px] shrink-0 overflow-hidden rounded-xl border border-amber-500/25 shadow-lg sm:w-[104px]">
              <MembershipSeatArt ticketId="free" priority className="w-full" alt="Free Explorer ticket" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="free-ticket-title" className="text-lg font-semibold leading-snug text-[var(--text)] sm:text-xl">
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
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
                {showJeremy
                  ? hasJeremy
                    ? "Explorer is real access — starter programs, about 20% of Coach Class. Scroll for your ticket."
                    : "Coach intro not uploaded yet — Free still works. Your ticket is below."
                  : "You tapped Free. Enjoy the chorus… then hear from your coach."}
              </p>
            </div>
          </div>

          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">
            Scroll for ticket · nothing enrolls until you tap below
          </p>

          <button
            type="button"
            onClick={() => {
              onClose();
              onUpgrade();
            }}
            className="h-12 rounded-full bg-[#7c3aed] text-sm font-semibold text-white transition hover:bg-[#6d2dd6]"
          >
            Show me Coach Class &amp; 1st Class →
          </button>

          {onContinueFree ? (
            <button
              type="button"
              onClick={handleContinueFree}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] text-sm font-medium text-[var(--muted)] transition hover:border-[#7c3aed]/40 hover:text-[var(--text)]"
            >
              Continue with Free / Explorer
            </button>
          ) : (
            <Link
              href={freeHref}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] text-sm font-medium text-[var(--muted)] transition hover:border-[#7c3aed]/40 hover:text-[var(--text)]"
              onClick={onClose}
              // Avoid accidental form/Enter activation from parent focus
              tabIndex={0}
            >
              Continue with Free / Explorer
            </Link>
          )}

          <button
            type="button"
            onClick={onClose}
            className="py-2 text-xs text-[var(--muted)] hover:text-[var(--text)]"
          >
            Never mind — back to tickets
          </button>
        </div>
      </div>
    </div>
  );
}
