"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import {
  FREE_TICKET_GAG_POSTER,
  FREE_TICKET_RICKROLL_DURATION_MS,
  FREE_TICKET_RICKROLL_FADE_MS,
  isFreeTicketGagYoutube,
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
import ShareFreeTicketButton from "@/components/ShareFreeTicketButton";
import {
  attachFreeTicketGag,
  fadeStopFreeTicketGag,
  parkFreeTicketGag,
  stopFreeTicketGag,
} from "@/lib/play-free-ticket-gag";

/** Free-ticket Jeremy intro: 3× louder than admin content volume offset. */
const JEREMY_WORD_VOLUME_MULT = 3;

/**
 * Free / Explorer ticket open:
 *
 * Guests (not signed in):
 *   1) In-app ~5s chorus file (started on the Free tap)
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
  const [jeremyEmbedSrc, setJeremyEmbedSrc] = useState<string | null>(null);
  const [gagEmbedSrc, setGagEmbedSrc] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);
  const cancelFadeRef = useRef<(() => void) | null>(null);
  const jeremyIframeRef = useRef<HTMLIFrameElement>(null);
  const jeremyVideoRef = useRef<HTMLVideoElement>(null);
  const gagHostRef = useRef<HTMLDivElement>(null);
  const gagIframeRef = useRef<HTMLIFrameElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const signedIn = Boolean(purchaseAuth.signedIn);
  const gag = productFreeTicketGag({ signedIn });
  const gagIsYoutube = isFreeTicketGagYoutube();
  const volumeDb = useUploadedContentVolumeDb();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // One Free Explorer clip: free-ticket slot → overall welcome. Never use gag as Jeremy.
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
    cancelFadeRef.current?.();
    cancelFadeRef.current = null;
  }

  function schedule(fn: () => void, ms: number) {
    timersRef.current.push(window.setTimeout(fn, ms));
  }

  const jeremyVolumeDb = clampVolumeDb(
    volumeDb + linearMultiplierToDb(JEREMY_WORD_VOLUME_MULT),
  );

  useEffect(() => {
    if (!open) return undefined;

    clearTimers();
    const origin = window.location.origin;
    setBackgroundMusicOverlay(true);

    requestAnimationFrame(() => {
      panelRef.current?.scrollTo(0, 0);
    });

    if (!gag.enabled) {
      stopFreeTicketGag();
      const jeremySrc =
        hasJeremy && jeremyIsYoutube
          ? landingVideoEmbedSrc(jeremyVideoUrl, true, { mute: true, origin })
          : null;
      queueMicrotask(() => {
        setJeremyEmbedSrc(jeremySrc);
        setLoadJeremy(true);
        setShowJeremy(true);
        setFadeJeremyIn(true);
        setHideRickroll(true);
      });
      return () => {
        clearTimers();
        setBackgroundMusicOverlay(false);
      };
    }

    if (gagIsYoutube) {
      stopFreeTicketGag();
      const pinned = landingVideoEmbedSrc(gag.videoUrl, true, {
        mute: true,
        origin,
        startSeconds: gag.startSec,
      });
      queueMicrotask(() => setGagEmbedSrc(pinned));
    } else {
      requestAnimationFrame(() => {
        if (gagHostRef.current) attachFreeTicketGag(gagHostRef.current);
      });
    }

    const fadeAt = Math.max(0, FREE_TICKET_RICKROLL_DURATION_MS - FREE_TICKET_RICKROLL_FADE_MS);
    schedule(() => {
      if (gagIsYoutube) {
        killYoutubeEmbed(gagIframeRef.current);
      } else {
        cancelFadeRef.current = fadeStopFreeTicketGag(FREE_TICKET_RICKROLL_FADE_MS);
      }
    }, fadeAt);

    schedule(() => {
      setHideRickroll(true);
      setGagEmbedSrc(null);
      parkFreeTicketGag();
      killYoutubeEmbed(gagIframeRef.current);
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
    }, FREE_TICKET_RICKROLL_DURATION_MS);

    const gagFrame = gagIframeRef.current;
    return () => {
      clearTimers();
      stopFreeTicketGag();
      killYoutubeEmbed(gagFrame);
      setBackgroundMusicOverlay(false);
    };
    // Mounted only while open (parent unmounts on close).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !gagIsYoutube || !gagEmbedSrc || !gag.enabled) return;
    const t = window.setTimeout(() => ensureYoutubeAudible(gagIframeRef.current), 400);
    return () => window.clearTimeout(t);
  }, [open, gagIsYoutube, gagEmbedSrc, gag.enabled]);

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
    const t2 = window.setTimeout(kick, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [fadeJeremyIn, hasJeremy, jeremyIsYoutube, jeremyVolumeDb]);

  if (!open) return null;

  const freeHref = purchaseHref("explorer", purchaseAuth);

  function handleContinueFree() {
    stopFreeTicketGag();
    onClose();
    onContinueFree?.();
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/90 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="free-ticket-title"
      onClick={() => {
        stopFreeTicketGag();
        onClose();
      }}
    >
      <div
        ref={panelRef}
        className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-y-auto overscroll-contain rounded-t-2xl border border-amber-500/30 bg-[var(--surface)] shadow-2xl sm:max-h-[min(92vh,760px)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-[var(--surface)]/95 px-3 py-2 backdrop-blur-md sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
            Explorer ticket
          </p>
          <button
            type="button"
            onClick={() => {
              stopFreeTicketGag();
              onClose();
            }}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="relative aspect-video w-full shrink-0 bg-black sm:mt-0">
          {gag.enabled && !hideRickroll && !showJeremy && gagIsYoutube && gagEmbedSrc ? (
            <iframe
              ref={gagIframeRef}
              key="free-gag-youtube"
              className="absolute inset-0 h-full w-full"
              src={gagEmbedSrc}
              title="You picked free"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : null}

          {gag.enabled && !hideRickroll && !showJeremy && !gagIsYoutube ? (
            <div
              ref={gagHostRef}
              className="absolute inset-0 bg-black"
              style={{
                backgroundImage: `url(${FREE_TICKET_GAG_POSTER})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ) : null}

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
                    ? "Gotcha — it's a real Free ticket. Send it to a friend (our link, not YouTube)."
                    : "Gotcha — Free still works. Send this ticket to a friend. Coach intro comes later."
                  : "You tapped Free. Enjoy the chorus… then hear from your coach."}
              </p>
            </div>
          </div>

          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">
            Scroll for ticket · nothing enrolls until you tap below
          </p>

          {showJeremy ? (
            <ShareFreeTicketButton label="Send this Free ticket to a friend" />
          ) : null}

          <button
            type="button"
            onClick={() => {
              stopFreeTicketGag();
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
              onClick={() => {
                stopFreeTicketGag();
                onClose();
              }}
              tabIndex={0}
            >
              Continue with Free / Explorer
            </Link>
          )}

          <button
            type="button"
            onClick={() => {
              stopFreeTicketGag();
              onClose();
            }}
            className="py-2 text-xs text-[var(--muted)] hover:text-[var(--text)]"
          >
            Never mind — back to tickets
          </button>
        </div>
      </div>
    </div>
  );
}
