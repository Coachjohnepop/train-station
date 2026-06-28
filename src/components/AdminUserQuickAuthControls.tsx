"use client";

import { useEffect, useState } from "react";

type QuickAuthDevice = {
  deviceId: string;
  pin: boolean;
  webauthn: boolean;
  updatedAt: string;
  pinUpdatedAt?: string;
};

type QuickAuthAdminData = {
  email: string;
  presetPin: boolean;
  devices: QuickAuthDevice[];
  summary: {
    deviceCount: number;
    pinDevices: number;
    webauthnDevices: number;
    presetPin: boolean;
  };
};

function shortDeviceId(deviceId: string): string {
  return `${deviceId.slice(0, 8)}…${deviceId.slice(-4)}`;
}

export default function AdminUserQuickAuthControls({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const [data, setData] = useState<QuickAuthAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/quick-auth`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not load quick sign-in status.");
        setData(null);
        return;
      }
      setData(body as QuickAuthAdminData);
    } catch {
      setError("Could not load quick sign-in status.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function runAction(payload: Record<string, string>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/quick-auth`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Action failed.");
        return;
      }
      setData(body as QuickAuthAdminData);
      setPin("");
      setMessage("Quick sign-in updated.");
    } catch {
      setError("Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const hasQuickAuth =
    Boolean(data?.summary.presetPin) ||
    (data?.summary.deviceCount ?? 0) > 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">Quick sign-in (PIN / biometrics)</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Manage alternate sign-in for <span className="font-mono">{userEmail}</span>. PINs are
          hashed and scoped per device; an admin PIN also applies before the member registers a
          device.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--muted)]">Loading quick sign-in status…</p>
      ) : (
        <>
          {data && (
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg border border-[var(--border)] px-2 py-1.5">
                <p className="text-[var(--muted)]">Devices</p>
                <p className="font-semibold tabular-nums">{data.summary.deviceCount}</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] px-2 py-1.5">
                <p className="text-[var(--muted)]">PIN enabled</p>
                <p className="font-semibold tabular-nums">{data.summary.pinDevices}</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] px-2 py-1.5">
                <p className="text-[var(--muted)]">Biometrics</p>
                <p className="font-semibold tabular-nums">{data.summary.webauthnDevices}</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] px-2 py-1.5">
                <p className="text-[var(--muted)]">Admin PIN</p>
                <p className="font-semibold">{data.summary.presetPin ? "Set" : "—"}</p>
              </div>
            </div>
          )}

          {data?.summary.presetPin && data.summary.deviceCount === 0 && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Admin PIN is active and will apply when this member signs in on a registered device.
            </p>
          )}

          {data && data.devices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--muted)]">Registered devices</p>
              <ul className="space-y-1.5">
                {data.devices.map((device) => (
                  <li
                    key={device.deviceId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs"
                  >
                    <div>
                      <span className="font-mono">{shortDeviceId(device.deviceId)}</span>
                      <span className="ml-2 text-[var(--muted)]">
                        {device.pin ? "PIN" : ""}
                        {device.pin && device.webauthn ? " · " : ""}
                        {device.webauthn ? "Biometrics" : ""}
                        {!device.pin && !device.webauthn ? "No methods" : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="rounded border border-[var(--danger)]/40 px-2 py-0.5 text-[var(--danger)] hover:bg-[var(--danger)]/10"
                      disabled={busy}
                      onClick={() =>
                        void runAction({
                          action: "removeDevice",
                          deviceId: device.deviceId,
                        })
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[8rem] flex-1">
              <span className="text-xs text-[var(--muted)]">Set / reset PIN</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="input mt-1 w-full font-mono tracking-widest"
                placeholder="4 digits"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={busy || pin.length !== 4}
              onClick={() => void runAction({ action: "setPin", pin })}
            >
              Save PIN
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {hasQuickAuth && (
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={busy}
                onClick={() => void runAction({ action: "clearPin" })}
              >
                Clear PIN
              </button>
            )}
            {(data?.summary.webauthnDevices ?? 0) > 0 && (
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={busy}
                onClick={() => void runAction({ action: "clearWebauthn" })}
              >
                Clear biometrics
              </button>
            )}
            {hasQuickAuth && (
              <button
                type="button"
                className="rounded border border-[var(--danger)]/40 px-3 py-1.5 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10"
                disabled={busy}
                onClick={() => {
                  if (
                    !confirm(
                      `Remove all quick sign-in for ${userEmail}?\n\nThey will need their password (and to re-enroll PIN/biometrics) on every device.`,
                    )
                  ) {
                    return;
                  }
                  void runAction({ action: "clearAll" });
                }}
              >
                Clear all quick sign-in
              </button>
            )}
          </div>
        </>
      )}

      {message && <p className="text-xs text-emerald-300">{message}</p>}
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}