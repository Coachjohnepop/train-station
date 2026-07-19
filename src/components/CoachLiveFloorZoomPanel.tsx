"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ZoomMeetingEmbedLazy from "@/components/ZoomMeetingEmbedLazy";
import type { ZoomEmbedCredentials } from "@/components/ZoomMeetingEmbed";
import { isDesktopEmbedViewport, useDesktopEmbed } from "@/lib/use-desktop-embed";

type ZoomSummary = {
  sessionDate: string;
  meetingNumber: string;
  joinUrl: string;
  hostUrl: string;
  topic: string;
  demo?: boolean;
  openUrl?: string;
  openAs?: "host" | "participant";
  isHost?: boolean;
  hostCoachEmail?: string | null;
};

export default function CoachLiveFloorZoomPanel({
  sessionDate,
  variant = "default",
}: {
  sessionDate: string;
  variant?: "default" | "floor";
}) {
  const isFloor = variant === "floor";
  const desktop = useDesktopEmbed();
  const [open, setOpen] = useState(isFloor);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomSummary | null>(null);
  const [embedCreds, setEmbedCreds] = useState<ZoomEmbedCredentials | null>(null);
  const [embedVisible, setEmbedVisible] = useState(false);
  const [zoomReady, setZoomReady] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [sdkConfigured, setSdkConfigured] = useState(false);
  const [messageIsError, setMessageIsError] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const [zoomRes, statusRes] = await Promise.all([
        fetch(`/api/admin/live-floor/zoom?date=${sessionDate}`, { cache: "no-store" }),
        fetch("/api/admin/zoom/status", { cache: "no-store" }),
      ]);
      const data = zoomRes.ok ? await zoomRes.json() : null;
      const status = statusRes.ok ? await statusRes.json() : null;
      // Prefer S2S-aware floor ready; fall back to coach status.
      const ready = Boolean(data?.ready ?? status?.ready);
      setZoomReady(ready);
      setSdkConfigured(Boolean(status?.sdkConfigured ?? data?.sdkConfigured));
      if (data?.zoom) setZoom(data.zoom);
    } catch {
      /* ignore */
    } finally {
      setStatusLoaded(true);
    }
  }, [sessionDate]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  function showMessage(text: string, isError = false) {
    setMessageIsError(isError);
    setMessage(text);
  }

  async function ensureRoom() {
    setBusy(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      const res = await fetch("/api/admin/live-floor/zoom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage(data.error || "Could not create Zoom room.", true);
        return null;
      }
      const notifyNote =
        data.notified > 0 ? ` Link sent to ${data.notified} attendee${data.notified === 1 ? "" : "s"}.` : "";
      if (data.demo) {
        setZoom(null);
        showMessage("Connect Zoom in Admin → Settings first.", true);
        return null;
      }
      setZoom(data.zoom);
      setSdkConfigured(Boolean(data.sdkConfigured));
      showMessage(`Live room ready.${notifyNote}`);
      setTimeout(() => setMessage(null), 4000);
      return data.zoom as ZoomSummary;
    } catch {
      showMessage("Could not create Zoom room.", true);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function startEmbedded() {
    if (!desktop) return;
    setBusy(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      const res = await fetch(
        `/api/admin/live-floor/zoom/credentials?date=${sessionDate}&ensure=1`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) {
        showMessage(data.error || "Could not start video.", true);
        return;
      }
      if (data.demo) {
        showMessage("Connect Zoom in Admin → Settings.", true);
        return;
      }
      setEmbedCreds({
        signature: data.signature,
        meetingNumber: data.meetingNumber,
        password: data.password,
        userName: data.userName,
        zak: data.zak,
        role: 1,
      });
      setEmbedVisible(true);
      setOpen(true);
    } catch {
      showMessage("Could not start video.", true);
    } finally {
      setBusy(false);
    }
  }

  async function startVideo() {
    let room = zoom;
    if (!room || room.demo) {
      room = await ensureRoom();
      if (!room || room.demo) return;
    }
    const wideEnough = isDesktopEmbedViewport();
    if (wideEnough && sdkConfigured) {
      await startEmbedded();
      return;
    }
    const openUrl =
      (room as { openUrl?: string }).openUrl ||
      ((room as { isHost?: boolean }).isHost === false ? room.joinUrl : room.hostUrl) ||
      room.hostUrl ||
      room.joinUrl;
    if (openUrl) {
      window.open(openUrl, "_blank", "noopener,noreferrer");
      if ((room as { isHost?: boolean }).isHost === false) {
        showMessage("Opened as participant — join Jeremy’s class (guest is OK if Zoom asks to sign in).");
      } else if (wideEnough && !sdkConfigured) {
        showMessage("Zoom opened in a new tab — connect Zoom in Settings to embed video on this page.");
      }
    }
  }

  function closeEmbed() {
    setEmbedVisible(false);
    setEmbedCreds(null);
  }

  return (
    <section
      className={`rounded-2xl border border-sky-500/35 bg-sky-500/8 ${
        isFloor ? "p-3" : "p-4"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isFloor ? (
            <p className="text-xs text-[var(--muted)]">
              {desktop && sdkConfigured
                ? "Start video embeds Zoom here so you can count sets on the same screen."
                : "Start video opens Zoom — members get the join link automatically."}
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-sky-200">Group video</p>
              <p className="text-xs text-[var(--muted)]">
                One Zoom room for today&apos;s class. Creating the room texts today&apos;s attendees
                automatically.
              </p>
            </>
          )}
        </div>
        {isFloor ? (
          zoomReady ? (
            <button
              type="button"
              className="btn-primary min-h-[48px] shrink-0 px-5 text-sm font-bold"
              disabled={busy || embedVisible}
              onClick={() => void startVideo()}
            >
              {busy ? "Starting…" : embedVisible ? "Video live" : "Start Video"}
            </button>
          ) : (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link
                href="/admin/settings"
                className="btn-primary min-h-[48px] px-5 text-sm font-bold"
              >
                {statusLoaded ? "Connect Zoom to start" : "Checking Zoom…"}
              </Link>
              {/* Always offer start attempt — S2S may still work even if status is stale. */}
              <button
                type="button"
                className="btn-ghost min-h-[48px] px-4 text-xs font-semibold"
                disabled={busy}
                onClick={() => void startVideo()}
              >
                {busy ? "Starting…" : "Try Start Video"}
              </button>
            </div>
          )
        ) : (
          <button
            type="button"
            className="btn-ghost min-h-[44px] px-3 py-2 text-xs"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide video" : "Show video"}
          </button>
        )}
      </div>

      {message ? (
        <p
          className={`mt-2 text-xs ${messageIsError ? "text-amber-200" : "text-[var(--success)]"}`}
        >
          {message}
        </p>
      ) : null}

      {!zoomReady ? (
        <p className="mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Zoom host not linked yet. Open{" "}
          <Link href="/admin/settings" className="font-semibold text-amber-50 underline">
            Settings
          </Link>{" "}
          → Connect as <strong>jeremy@thetrainstation.co</strong>, or tap{" "}
          <strong>Try Start Video</strong> if server Zoom is configured.
        </p>
      ) : null}

      {/* Host link always visible once a room exists (floor + expanded). */}
      {zoom && !zoom.demo && zoom.hostUrl ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
          <a
            href={zoom.hostUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary min-h-[44px] px-4 text-sm font-bold"
          >
            Open host Zoom link ↗
          </a>
          {zoom.joinUrl ? (
            <button
              type="button"
              className="btn-ghost min-h-[40px] px-3 text-xs"
              onClick={() => {
                void navigator.clipboard.writeText(zoom.joinUrl);
                showMessage("Member join link copied.");
                setTimeout(() => setMessage(null), 2500);
              }}
            >
              Copy member link
            </button>
          ) : null}
        </div>
      ) : null}

      {(open || !isFloor) && zoomReady ? (
        <div className={`${isFloor ? "mt-2" : "mt-3"} space-y-3`}>
          {!isFloor ? (
            <div className="flex flex-wrap gap-2">
              {!zoom ? (
                <button
                  type="button"
                  className="btn-primary min-h-[44px] px-4 py-2 text-sm"
                  disabled={busy}
                  onClick={() => void ensureRoom()}
                >
                  {busy ? "Creating…" : "Create class Zoom room"}
                </button>
              ) : (
                <>
                  {desktop && sdkConfigured ? (
                    <button
                      type="button"
                      className="btn-primary min-h-[44px] px-4 py-2 text-sm"
                      disabled={busy || embedVisible}
                      onClick={() => void startEmbedded()}
                    >
                      {busy ? "Starting…" : embedVisible ? "Video live" : "Embed video here"}
                    </button>
                  ) : null}
                  {!zoom.demo && zoom.hostUrl ? (
                    <a
                      href={zoom.hostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary min-h-[44px] px-4 py-2 text-sm"
                    >
                      Start Video
                    </a>
                  ) : null}
                  {!zoom.demo && zoom.joinUrl ? (
                    <button
                      type="button"
                      className="btn-ghost min-h-[44px] px-3 py-2 text-xs"
                      onClick={() => void navigator.clipboard.writeText(zoom.joinUrl)}
                    >
                      Copy member link
                    </button>
                  ) : null}
                  {embedVisible ? (
                    <button
                      type="button"
                      className="btn-ghost min-h-[44px] px-3 py-2 text-xs"
                      onClick={closeEmbed}
                    >
                      Leave video
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {embedVisible ? (
                <button
                  type="button"
                  className="btn-ghost min-h-[40px] px-3 text-xs"
                  onClick={closeEmbed}
                >
                  Leave video
                </button>
              ) : desktop && sdkConfigured ? (
                <button
                  type="button"
                  className="btn-ghost min-h-[40px] px-3 text-xs"
                  disabled={busy}
                  onClick={() => void startEmbedded()}
                >
                  {busy ? "Connecting…" : "Show video here"}
                </button>
              ) : null}
              {zoom?.hostUrl && !zoom.demo && !embedVisible ? (
                <a
                  href={zoom.hostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost min-h-[40px] px-3 text-xs"
                >
                  Open in Zoom app
                </a>
              ) : null}
              {zoom?.joinUrl && !zoom.demo ? (
                <button
                  type="button"
                  className="btn-ghost min-h-[40px] px-3 text-xs"
                  onClick={() => void navigator.clipboard.writeText(zoom.joinUrl)}
                >
                  Copy member link
                </button>
              ) : null}
            </div>
          )}

          {desktop && embedVisible && embedCreds ? (
            <div className={isFloor ? "sticky top-2 z-20" : undefined}>
              <ZoomMeetingEmbedLazy
                credentials={embedCreds}
                height={isFloor ? 280 : 400}
                onLeft={closeEmbed}
                onError={(msg) => showMessage(msg, true)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}