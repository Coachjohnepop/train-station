"use client";

import { useEffect, useRef, useState } from "react";

export type ZoomEmbedCredentials = {
  signature: string;
  meetingNumber: string;
  password?: string;
  userName: string;
  userEmail?: string;
  zak?: string;
  role: 0 | 1;
  speakerView?: boolean;
};

type ZoomClient = {
  init: (args: {
    zoomAppRoot: HTMLElement;
    language?: string;
    patchJsMedia?: boolean;
    leaveOnPageUnload?: boolean;
    customize?: Record<string, unknown>;
  }) => Promise<unknown>;
  join: (args: Record<string, unknown>) => Promise<unknown>;
  leaveMeeting: () => Promise<unknown>;
};

type Props = {
  credentials: ZoomEmbedCredentials;
  height?: number;
  onJoined?: () => void;
  onError?: (message: string) => void;
  onLeft?: () => void;
};

export default function ZoomMeetingEmbed({
  credentials,
  height = 360,
  onJoined,
  onError,
  onLeft,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<ZoomClient | null>(null);
  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!rootRef.current) return;
      setStatus("joining");
      setErrorMessage(null);

      try {
        const mod = await import("@zoom/meetingsdk/embedded");
        const ZoomMtgEmbedded = mod.default;
        const client = ZoomMtgEmbedded.createClient() as unknown as ZoomClient;
        clientRef.current = client;

        await client.init({
          zoomAppRoot: rootRef.current,
          language: "en-US",
          patchJsMedia: true,
          leaveOnPageUnload: true,
          customize: credentials.speakerView
            ? {
                video: {
                  defaultViewType: "speaker",
                  isResizable: true,
                },
              }
            : undefined,
        });

        if (cancelled) return;

        const joinArgs: Record<string, unknown> = {
          signature: credentials.signature,
          meetingNumber: credentials.meetingNumber,
          password: credentials.password || "",
          userName: credentials.userName,
        };
        if (credentials.userEmail) joinArgs.userEmail = credentials.userEmail;
        if (credentials.zak && credentials.role === 1) joinArgs.zak = credentials.zak;

        await client.join(joinArgs);
        if (cancelled) return;
        setStatus("joined");
        onJoined?.();
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not join Zoom meeting.";
        setStatus("error");
        setErrorMessage(message);
        onError?.(message);
      }
    }

    void run();

    return () => {
      cancelled = true;
      const client = clientRef.current;
      clientRef.current = null;
      if (client) {
        void client.leaveMeeting().catch(() => undefined).finally(() => onLeft?.());
      }
    };
  }, [credentials, onJoined, onError, onLeft]);

  return (
    <div className="zoom-embed-shell overflow-hidden rounded-xl border border-[var(--border)] bg-black/90">
      <div
        ref={rootRef}
        className="zoom-embed-root w-full"
        style={{ minHeight: height, height }}
        data-zoom-status={status}
      />
      {status === "joining" ? (
        <p className="px-3 py-2 text-center text-xs text-[var(--muted)]">Connecting to Zoom…</p>
      ) : null}
      {errorMessage ? (
        <p className="px-3 py-2 text-center text-xs text-red-300">{errorMessage}</p>
      ) : null}
    </div>
  );
}