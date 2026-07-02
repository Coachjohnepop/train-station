"use client";

import dynamic from "next/dynamic";
import type { ZoomEmbedCredentials } from "@/components/ZoomMeetingEmbed";

const ZoomMeetingEmbed = dynamic(() => import("@/components/ZoomMeetingEmbed"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-[var(--border)] bg-black/90 text-xs text-[var(--muted)]">
      Loading Zoom…
    </div>
  ),
});

type Props = {
  credentials: ZoomEmbedCredentials;
  height?: number;
  onJoined?: () => void;
  onError?: (message: string) => void;
  onLeft?: () => void;
};

export default function ZoomMeetingEmbedLazy(props: Props) {
  return <ZoomMeetingEmbed {...props} />;
}