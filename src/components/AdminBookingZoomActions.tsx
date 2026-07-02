"use client";

import { useState } from "react";

export default function AdminBookingZoomActions({
  bookingId,
  initialJoinUrl,
  initialHostUrl,
}: {
  bookingId: string;
  initialJoinUrl?: string | null;
  initialHostUrl?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [joinUrl, setJoinUrl] = useState(initialJoinUrl || "");
  const [hostUrl, setHostUrl] = useState(initialHostUrl || "");
  const [note, setNote] = useState<string | null>(null);

  async function createZoom() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/zoom`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setNote(data.error || "Failed");
        return;
      }
      setJoinUrl(data.zoom.joinUrl);
      setHostUrl(data.zoom.hostUrl);
      setNote(data.demo ? "Demo link (set Zoom env vars for real meetings)" : "Zoom link created");
    } catch {
      setNote("Failed to create Zoom link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-primary px-3 py-1 text-xs"
        disabled={busy}
        onClick={() => void createZoom()}
      >
        {busy ? "Creating…" : joinUrl ? "Regenerate Zoom" : "Create Zoom link"}
      </button>
      {hostUrl ? (
        <a
          href={hostUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost px-3 py-1 text-xs"
        >
          Start as host
        </a>
      ) : null}
      {note ? <span className="text-[10px] text-[var(--muted)]">{note}</span> : null}
    </div>
  );
}