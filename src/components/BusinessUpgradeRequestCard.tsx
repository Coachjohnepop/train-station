"use client";

import { useEffect, useState } from "react";
import {
  BUSINESS_UPGRADE_REQUEST_COPY,
  businessUpgradeQueueDetail,
  businessUpgradeQueuePlace,
  ordinalPlace,
  type BusinessUpgradeQueuePlace,
  type BusinessUpgradeStatus,
} from "@/lib/business-upgrade";

export default function BusinessUpgradeRequestCard({
  canRequest,
  status,
  requestedAt,
  queuePosition,
  queueSize,
  onStatus,
}: {
  canRequest: boolean;
  status: BusinessUpgradeStatus | null;
  requestedAt?: string | null;
  queuePosition?: number | null;
  queueSize?: number | null;
  onStatus?: (
    status: BusinessUpgradeStatus,
    place?: BusinessUpgradeQueuePlace | null,
  ) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localStatus, setLocalStatus] = useState<BusinessUpgradeStatus | null>(status);
  const [place, setPlace] = useState<BusinessUpgradeQueuePlace | null>(() =>
    queuePosition
      ? businessUpgradeQueuePlace(queuePosition, queueSize || queuePosition)
      : null,
  );

  const shown = localStatus ?? status;
  const offerOpen = canRequest || shown === "pending" || shown === "declined";

  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  useEffect(() => {
    if (queuePosition) {
      setPlace(businessUpgradeQueuePlace(queuePosition, queueSize || queuePosition));
    }
  }, [queuePosition, queueSize]);

  if (!offerOpen) return null;

  async function requestUpgrade() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/member/business-upgrade-request", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body.error === "string"
            ? body.error
            : "Could not send the upgrade request.",
        );
        return;
      }
      const nextPlace =
        typeof body.position === "number"
          ? businessUpgradeQueuePlace(body.position, Number(body.size) || body.position)
          : null;
      setLocalStatus("pending");
      setPlace(nextPlace);
      onStatus?.("pending", nextPlace);
    } catch {
      setError("Could not send the upgrade request.");
    } finally {
      setBusy(false);
    }
  }

  const requestedLabel = requestedAt
    ? new Date(requestedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="card space-y-3 border border-accent/35 bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))]">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
        Seat upgrade
      </p>
      {shown === "pending" ? (
        <>
          {place ? (
            <div className="space-y-1">
              <p className="text-4xl font-semibold tracking-tight text-accent">
                {ordinalPlace(place.position)}
              </p>
              <h3 className="text-lg font-semibold">on the upgrade list</h3>
              <p className="text-sm text-[var(--text)]">{businessUpgradeQueueDetail(place)}</p>
            </div>
          ) : (
            <h3 className="text-lg font-semibold">Upgrade requested</h3>
          )}
          <p className="text-sm text-[var(--muted)]">
            Like a seat upgrade on a flight — we&apos;ll alert the crew. You&apos;ll hear back
            when it&apos;s approved.
            {requestedLabel ? ` Requested ${requestedLabel}.` : ""}
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold">Live Zooms are on Business Class</h3>
          <p className="text-sm text-[var(--muted)]">
            You&apos;re on Coach Class. Request an upgrade and we&apos;ll ping the crew to
            approve — not automatic, just like hoping for a better seat.
          </p>
          {shown === "declined" ? (
            <p className="text-xs text-amber-200">
              Last request wasn&apos;t approved. You can request again.
            </p>
          ) : null}
          <button
            type="button"
            className="btn-primary w-full text-sm"
            disabled={busy}
            onClick={() => void requestUpgrade()}
          >
            {busy ? "Sending request…" : BUSINESS_UPGRADE_REQUEST_COPY}
          </button>
        </>
      )}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
