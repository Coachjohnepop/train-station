"use client";

import { useEffect, useState } from "react";

const DEVICE_ID_KEY = "ts_quick_auth_device_id";
const LOCAL_META_KEY = "ts_quick_auth_meta";
const SETUP_SKIP_KEY = "ts_quick_auth_setup_skipped";
export type QuickAuthLocalMeta = {
  email: string;
  pin: boolean;
  webauthn: boolean;
  updatedAt: string;
};

let deviceIdCache: string | null = null;
let deviceIdPromise: Promise<string> | null = null;

function canUseSessionStorage(): boolean {
  try {
    const probe = "__ts_qa_probe__";
    sessionStorage.setItem(probe, "1");
    sessionStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function canUseLocalStorage(): boolean {
  try {
    const probe = "__ts_qa_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function readStoredDeviceId(): string | null {
  if (typeof window === "undefined") return null;

  if (canUseSessionStorage()) {
    const sessionValue = sessionStorage.getItem(DEVICE_ID_KEY);
    if (sessionValue) return sessionValue;
  }

  if (canUseLocalStorage()) {
    const localValue = localStorage.getItem(DEVICE_ID_KEY);
    if (localValue) return localValue;
  }

  return null;
}

function writeStoredDeviceId(deviceId: string): void {
  if (typeof window === "undefined") return;

  if (canUseSessionStorage()) {
    try {
      sessionStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch {
      /* ignore */
    }
  }

  if (canUseLocalStorage()) {
    try {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch {
      /* ignore */
    }
  }
}

function readMetaStorage(): Storage | null {
  if (canUseSessionStorage()) return sessionStorage;
  if (canUseLocalStorage()) return localStorage;
  return null;
}

/** Ensures a stable device id for this browser profile / private session. */
export async function ensureDeviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  if (deviceIdPromise) return deviceIdPromise;

  deviceIdPromise = (async () => {
    const stored = readStoredDeviceId();
    const res = await fetch("/api/auth/quick-auth/device", {
      method: stored ? "POST" : "GET",
      headers: stored ? { "Content-Type": "application/json" } : undefined,
      body: stored ? JSON.stringify({ deviceId: stored }) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });

    const data = (await res.json().catch(() => ({}))) as { deviceId?: string };
    const deviceId = data.deviceId || stored || crypto.randomUUID();
    writeStoredDeviceId(deviceId);
    deviceIdCache = deviceId;
    return deviceId;
  })();

  try {
    return await deviceIdPromise;
  } finally {
    deviceIdPromise = null;
  }
}

/** Sync read — may be empty until `ensureDeviceId()` resolves. */
export function getOrCreateDeviceId(): string {
  if (deviceIdCache) return deviceIdCache;
  const stored = readStoredDeviceId();
  if (stored) {
    deviceIdCache = stored;
    void ensureDeviceId();
    return stored;
  }
  const generated = crypto.randomUUID();
  writeStoredDeviceId(generated);
  deviceIdCache = generated;
  void ensureDeviceId();
  return generated;
}

export function useQuickAuthDeviceId(): { deviceId: string; ready: boolean } {
  const [deviceId, setDeviceId] = useState(() => getOrCreateDeviceId());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ensureDeviceId().then((id) => {
      if (cancelled) return;
      setDeviceId(id);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { deviceId, ready };
}

export function quickAuthMetaForEmail(email: string): QuickAuthLocalMeta | null {
  const meta = readQuickAuthMeta();
  const normalized = email.trim().toLowerCase();
  if (!meta || !normalized || meta.email !== normalized) return null;
  if (!meta.pin && !meta.webauthn) return null;
  return meta;
}

export function readQuickAuthMeta(): QuickAuthLocalMeta | null {
  if (typeof window === "undefined") return null;
  const storage = readMetaStorage();
  if (!storage) return null;
  const raw = storage.getItem(LOCAL_META_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuickAuthLocalMeta;
    if (!parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeQuickAuthMeta(meta: QuickAuthLocalMeta): void {
  if (typeof window === "undefined") return;
  const storage = readMetaStorage();
  if (!storage) return;
  try {
    storage.setItem(LOCAL_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function clearQuickAuthMeta(): void {
  if (typeof window === "undefined") return;
  const storage = readMetaStorage();
  if (!storage) return;
  try {
    storage.removeItem(LOCAL_META_KEY);
  } catch {
    /* ignore */
  }
}

/** User chose "Skip for now" on setup-quick-auth — stop post-login redirects until they set a PIN. */
export function markQuickAuthSetupSkipped(): void {
  if (typeof window === "undefined") return;
  const storage = readMetaStorage();
  if (!storage) return;
  try {
    storage.setItem(SETUP_SKIP_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function hasSkippedQuickAuthSetup(): boolean {
  if (typeof window === "undefined") return false;
  const storage = readMetaStorage();
  if (!storage) return false;
  return Boolean(storage.getItem(SETUP_SKIP_KEY));
}

export function clearQuickAuthSetupSkipped(): void {
  if (typeof window === "undefined") return;
  const storage = readMetaStorage();
  if (!storage) return;
  try {
    storage.removeItem(SETUP_SKIP_KEY);
  } catch {
    /* ignore */
  }
}

export function webAuthnAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
  );
}

export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!webAuthnAvailable()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}