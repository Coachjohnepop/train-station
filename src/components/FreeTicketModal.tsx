"use client";

import Link from "next/link";
import { landingVideoEmbedSrc } from "@/lib/landing-media";

export default function FreeTicketModal({
  open,
  onClose,
  onUpgrade,
  freeChastiseVideoUrl = null,
}: {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  freeChastiseVideoUrl?: string | null;
}) {
  if (!open) return null;

  const embedSrc = landingVideoEmbedSrc(freeChastiseVideoUrl, true);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="free-ticket-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#140a22] p-4 sm:p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">Explorer ticket</p>
        <h2 id="free-ticket-title" className="mt-1 text-xl font-semibold text-white">
          Start small — <span className="text-amber-300">no strings</span>
        </h2>
        <p className="mt-2 text-sm text-[#9d8ab8] leading-relaxed">
          Explorer is real access to starter programs. No homework, no follow-up calls required — upgrade when you want Coach Class or 1st Class.
        </p>

        <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-amber-500/20">
          {embedSrc ? (
            <iframe
              className="h-full w-full"
              src={embedSrc}
              title="Coach message — you picked free"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center text-xs text-[#9d8ab8]">
              <p>Coach video coming soon.</p>
              <p className="mt-2 text-[#7c3aed]">
                <Link href="/admin/landing" className="underline">
                  Admin → Landing videos
                </Link>{" "}
                to paste your YouTube link.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2">
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
            href="/signup?plan=explorer"
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