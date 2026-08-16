"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import {
  FREE_TICKET_FULL_SRC,
  FREE_TICKET_GAG_POSTER,
  FREE_TICKET_RICKROLL_DURATION_MS,
  JEREMY_FREE_INTRO_VIDEO_SRC,
  isRickrollVideoUrl,
  productFreeTicketGag,
} from "@/lib/landing-media";
import {
  applyMediaVolumeDb,
  clampVolumeDb,
  linearMultiplierToDb,
} from "@/lib/media-volume";
import { isDirectVideoUrl } from "@/lib/site-video";
import { isYoutubeUrl } from "@/lib/youtube";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";
import MembershipSeatArt from "@/components/MembershipSeatArt";
import ShareFreeTicketButton from "@/components/ShareFreeTicketButton";
import {
  FREE_TICKET_GAG_HOST_ID,
  FREE_TICKET_GAG_VIDEO_ID,
  stopFreeTicketGag,
  stripNativeVideoChrome,
} from "@/lib/play-free-ticket-gag";

/** Free-ticket Jeremy intro: 3× louder than admin content volume offset. */
const JEREMY_WORD_VOLUME_MULT = 3;

/**
 * Free / Explorer ticket open:
 *
 * Guests (not signed in):
 *   One local file (Never Gonna Give You Up hook + Jeremy intro). No YouTube.
 *
 * Signed-in members: skip gag → Jeremy intro file only.
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
  forceGag = false,
  alreadyPaid = false,
  gagFullSrc = FREE_TICKET_FULL_SRC,
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
  /** Play the chorus even if they are signed in. */
  forceGag?: boolean;
  /** Paid member testing Free. Do not send them down Explorer. */
  alreadyPaid?: boolean;
  /** Concat file (gag + current intro). Defaults to the site file. */
  gagFullSrc?: string;
}) {
  void _gagConfig;
  const [showJeremy, setShowJeremy] = useState(false);
  const timersRef = useRef<number[]>([]);
  const jeremyVideoRef = useRef<HTMLVideoElement>(null);
  const gagHostRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const signedIn = Boolean(purchaseAuth.signedIn);
  const gag = productFreeTicketGag({ signedIn, force: forceGag });
  const volumeDb = useUploadedContentVolumeDb();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.freeTicket = "open";
    return () => {
      document.body.style.overflow = prev;
      delete document.documentElement.dataset.freeTicket;
    };
  }, [open]);

  // Uploaded Jeremy clip only. YouTube intros are skipped so Free never waits on an embed.
  const jeremyVideoUrl = (() => {
    const pick = [freeChastiseVideoUrl, welcomeVideoUrl, JEREMY_FREE_INTRO_VIDEO_SRC]
      .map((u) => u?.trim() || "")
      .find((u) => u && !isRickrollVideoUrl(u) && !isYoutubeUrl(u) && isDirectVideoUrl(u));
    return pick || JEREMY_FREE_INTRO_VIDEO_SRC;
  })();
  const hasJeremy = Boolean(jeremyVideoUrl);

  function clearTimers() {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }

  function schedule(fn: () => void, ms: number) {
    timersRef.current.push(window.setTimeout(fn, ms));
  }

  const jeremyVolumeDb = clampVolumeDb(
    volumeDb + linearMultiplierToDb(JEREMY_WORD_VOLUME_MULT),
  );

  useEffect(() => {
    if (!open) {
      stopFreeTicketGag();
      setShowJeremy(false);
      setBackgroundMusicOverlay(false);
      return;
    }

    clearTimers();
    setBackgroundMusicOverlay(true);

    requestAnimationFrame(() => {
      panelRef.current?.scrollTo(0, 0);
    });

    if (!gag.enabled) {
      stopFreeTicketGag();
      queueMicrotask(() => setShowJeremy(true));
      return () => {
        clearTimers();
        setBackgroundMusicOverlay(false);
      };
    }

    requestAnimationFrame(() => {
      const el = document.getElementById(FREE_TICKET_GAG_VIDEO_ID) as HTMLVideoElement | null;
      if (el) stripNativeVideoChrome(el);
    });

    schedule(() => setShowJeremy(true), FREE_TICKET_RICKROLL_DURATION_MS);

    return () => {
      clearTimers();
      setBackgroundMusicOverlay(false);
    };
    // Do not stop the gag in this cleanup — Strict Mode remount would rewind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (gag.enabled || !open || !hasJeremy) return;
    const el = jeremyVideoRef.current;
    if (!el) return;
    el.muted = false;
    applyMediaVolumeDb(el, jeremyVolumeDb);
    void el.play().catch(() => {
      /* may need another tap */
    });
  }, [gag.enabled, open, hasJeremy, jeremyVolumeDb]);

  if (!open) return null;

  const freeHref = purchaseHref("explorer", purchaseAuth);

  function handleContinueFree() {
    stopFreeTicketGag();
    onClose();
    onContinueFree?.();
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/92 sm:items-center sm:p-6"
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
        className="flex max-h-[100dvh] w-full max-w-xl flex-col overflow-y-auto overscroll-contain rounded-t-2xl border border-amber-500/30 bg-[var(--surface)] shadow-2xl sm:max-h-[min(94vh,820px)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full shrink-0 bg-black aspect-[9/16] max-h-[min(62dvh,36rem)] sm:max-h-[min(66vh,38rem)]">
          {gag.enabled ? (
            <div
              id={FREE_TICKET_GAG_HOST_ID}
              ref={gagHostRef}
              className="absolute inset-0 bg-black"
              style={{
                backgroundImage: `url(${FREE_TICKET_GAG_POSTER})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <video
                id={FREE_TICKET_GAG_VIDEO_ID}
                className="ts-inapp-video absolute inset-0 h-full w-full object-cover bg-black"
                src={gagFullSrc}
                poster={FREE_TICKET_GAG_POSTER}
                title="The Train Station — Free ticket"
                playsInline
                preload="auto"
                disablePictureInPicture
                controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
                onLoadedMetadata={(e) => {
                  stripNativeVideoChrome(e.currentTarget);
                  e.currentTarget.muted = false;
                }}
              />
            </div>
          ) : hasJeremy && jeremyVideoUrl ? (
            <video
              ref={jeremyVideoRef}
              key="jeremy-file"
              className="ts-inapp-video absolute inset-0 h-full w-full object-cover bg-black"
              src={jeremyVideoUrl}
              title="Coach Jeremy"
              playsInline
              muted={false}
              autoPlay
              preload="auto"
              disablePictureInPicture
              controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
              onLoadedMetadata={(e) => {
                stripNativeVideoChrome(e.currentTarget);
                e.currentTarget.muted = false;
                applyMediaVolumeDb(e.currentTarget, jeremyVolumeDb);
              }}
              onPlay={(e) => {
                e.currentTarget.muted = false;
                applyMediaVolumeDb(e.currentTarget, jeremyVolumeDb);
              }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center text-sm text-[var(--muted)]">
              <p className="text-base font-medium text-white">Coach intro coming soon</p>
              <p className="mt-2 max-w-xs leading-relaxed">
                Free / Explorer still opens real access. Scroll for your ticket.
              </p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent px-3 pb-10 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">
              Explorer ticket
            </p>
            <button
              type="button"
              onClick={() => {
                stopFreeTicketGag();
                onClose();
              }}
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-lg leading-none text-white/90 ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/75"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-5">
          <div className="flex items-start gap-3">
            <div className="w-[100px] shrink-0 overflow-hidden rounded-xl border border-amber-500/25 shadow-lg sm:w-[112px]">
              <MembershipSeatArt ticketId="free" priority className="w-full" alt="Free Explorer ticket" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="free-ticket-title" className="text-xl font-semibold leading-snug text-[var(--text)] sm:text-2xl">
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
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                {showJeremy
                  ? alreadyPaid
                    ? "That's the joke. You're still on your paid ticket. Close this and tap that seat."
                    : "Gotcha. It's a real Free ticket. Send it to a friend (our link, not YouTube)."
                  : "Five-second joke, then Coach Jeremy. Nothing enrolls until you tap below."}
              </p>
            </div>
          </div>

          <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-amber-400/90">
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
            className="h-14 rounded-full bg-[#7c3aed] text-base font-semibold text-white transition hover:bg-[#6d2dd6]"
          >
            Show me Coach Class &amp; 1st Class →
          </button>

          {alreadyPaid ? null : onContinueFree ? (
            <button
              type="button"
              onClick={handleContinueFree}
              className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--border)] text-base font-medium text-[var(--muted)] transition hover:border-[#7c3aed]/40 hover:text-[var(--text)]"
            >
              Continue with Free / Explorer
            </button>
          ) : (
            <Link
              href={freeHref}
              className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--border)] text-base font-medium text-[var(--muted)] transition hover:border-[#7c3aed]/40 hover:text-[var(--text)]"
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
            className="py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            Never mind — back to tickets
          </button>
        </div>
      </div>
    </div>
  );
}
