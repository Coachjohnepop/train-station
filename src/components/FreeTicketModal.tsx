"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import {
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
  attachFreeTicketGag,
  stopFreeTicketGag,
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
    return () => {
      document.body.style.overflow = prev;
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
    if (!open) return undefined;

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
      if (gagHostRef.current) attachFreeTicketGag(gagHostRef.current);
    });

    schedule(() => setShowJeremy(true), FREE_TICKET_RICKROLL_DURATION_MS);

    return () => {
      clearTimers();
      stopFreeTicketGag();
      setBackgroundMusicOverlay(false);
    };
    // Mounted only while open (parent unmounts on close).
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
        className="flex max-h-[100dvh] w-full max-w-xl flex-col overflow-y-auto overscroll-contain rounded-t-2xl border border-amber-500/30 bg-[var(--surface)] shadow-2xl sm:max-h-[min(94vh,820px)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-[var(--surface)]/95 px-3 py-2.5 backdrop-blur-md sm:px-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">
            Explorer ticket
          </p>
          <button
            type="button"
            onClick={() => {
              stopFreeTicketGag();
              onClose();
            }}
            className="rounded-full px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="relative w-full shrink-0 bg-black aspect-[9/16] max-h-[min(58dvh,34rem)] sm:max-h-[min(62vh,36rem)]">
          {gag.enabled ? (
            <div
              ref={gagHostRef}
              className="absolute inset-0 bg-black"
              style={{
                backgroundImage: `url(${FREE_TICKET_GAG_POSTER})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ) : hasJeremy && jeremyVideoUrl ? (
            <video
              ref={jeremyVideoRef}
              key="jeremy-file"
              className="absolute inset-0 h-full w-full object-contain bg-black"
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
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center text-sm text-[var(--muted)]">
              <p className="text-base font-medium text-white">Coach intro coming soon</p>
              <p className="mt-2 max-w-xs leading-relaxed">
                Free / Explorer still opens real access. Scroll for your ticket.
              </p>
            </div>
          )}
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
                  : "You tapped Free. The joke and Jeremy play as one clip — stay here."}
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
