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
  onLeft: _onLeft,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<ZoomClient | null>(null);
  const onJoinedRef = useRef(onJoined);
  const onErrorRef = useRef(onError);
  const credsRef = useRef(credentials);
  onJoinedRef.current = onJoined;
  onErrorRef.current = onError;
  credsRef.current = credentials;
  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const credKey = [
    credentials.signature,
    credentials.meetingNumber,
    credentials.password ?? "",
    credentials.userName,
    credentials.userEmail ?? "",
    credentials.zak ?? "",
    String(credentials.role),
    credentials.speakerView ? "1" : "0",
  ].join("|");

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

        const creds = credsRef.current;
        await client.init({
          zoomAppRoot: rootRef.current,
          language: "en-US",
          patchJsMedia: true,
          leaveOnPageUnload: true,
          customize: creds.speakerView
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
          signature: creds.signature,
          meetingNumber: creds.meetingNumber,
          password: creds.password || "",
          userName: creds.userName,
        };
        if (creds.userEmail) joinArgs.userEmail = creds.userEmail;
        if (creds.zak && creds.role === 1) joinArgs.zak = creds.zak;

        await client.join(joinArgs);
        if (cancelled) return;
        setStatus("joined");
        onJoinedRef.current?.();
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not join Zoom meeting.";
        setStatus("error");
        setErrorMessage(message);
        onErrorRef.current?.(message);
      }
    }

    void run();

    return () => {
      cancelled = true;
      const client = clientRef.current;
      clientRef.current = null;
      if (client) {
        // Leave the meeting only. Do not call onLeft here — parent re-renders
        // (live-floor SSE) used to treat cleanup as "user left" and unmount Join.
        void client.leaveMeeting().catch(() => undefined);
      }
    };
    // Primitive key so a new credentials object with the same join does not rejoin.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- credKey covers credentials
  }, [credKey]);

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