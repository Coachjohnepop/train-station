"use client";

import Link from "next/link";
import PlayableVideoFrame from "@/components/PlayableVideoFrame";
import { useIntroTrim } from "@/hooks/useIntroTrim";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";

export default function MeasurementsHowToClient({ videoUrl }: { videoUrl: string | null }) {
  const url = videoUrl?.trim() || "";
  const volumeDb = useUploadedContentVolumeDb();
  const trim = useIntroTrim("measurements");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">How to</p>
        <h1 className="mt-1 text-xl font-bold">How to do Measurements</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tap play when you&apos;re ready. Then enter your sheet — the video stays available there
          too.
        </p>
      </div>

      {url ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
          <PlayableVideoFrame
            className="aspect-video w-full"
            videoUrl={url}
            title="How to take measurements"
            volumeDb={volumeDb}
            autoplay={false}
            duckBackgroundMusic
            startSec={trim.startSec}
            endSec={trim.endSec}
          />
        </div>
      ) : (
        <p className="card text-sm text-[var(--muted)]">
          Jeremy hasn&apos;t posted the measurements how-to yet. You can still enter your tape
          sheet.
        </p>
      )}

      <Link href="/member/measurements/enter" className="btn-primary flex min-h-11 w-full items-center justify-center text-sm font-bold">
        Enter Measurements →
      </Link>
      <Link href="/member/measurements" className="btn-ghost flex min-h-10 w-full items-center justify-center text-xs">
        Back
      </Link>
    </div>
  );
}
