import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { normalizeAccountEmail } from "@/lib/account-email";
import { normalizeDeviceId } from "@/lib/quick-auth-device";
import { hashPin, verifyPin } from "@/lib/quick-auth-pin";

export type StoredWebAuthnCredential = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  createdAt: string;
};

export type StoredDeviceQuickAuth = {
  email: string;
  deviceId: string;
  pinHash?: string;
  pinUpdatedAt?: string;
  webauthn?: StoredWebAuthnCredential;
  updatedAt: string;
};

type QuickAuthStore = Record<string, StoredDeviceQuickAuth | StoredEmailQuickAuthPreset>;

export type StoredEmailQuickAuthPreset = {
  email: string;
  pinHash: string;
  pinUpdatedAt: string;
  updatedAt: string;
};

const BLOB_PATH = "demo/quick-auth-devices.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "quick-auth-devices.dev.json");

let memoryStore: QuickAuthStore | null = null;

function storeKey(email: string, deviceId: string): string {
  return `${email}:${deviceId}`;
}

function presetKey(email: string): string {
  return `_preset:${email}`;
}

function normalizeEmail(email: string): string | null {
  return normalizeAccountEmail(email);
}

async function getStore(opts?: { preferFresh?: boolean }): Promise<QuickAuthStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = v;
    },
    fallback: () => ({}),
    preferFresh: opts?.preferFresh,
  });
  memoryStore = hydrated;
  return hydrated;
}

async function saveStore(store: QuickAuthStore): Promise<void> {
  const { blobSaved } = await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v;
    },
  });
  if (process.env.VERCEL && !blobSaved) {
    throw new Error(
      "Could not persist quick-auth data to blob storage. PIN was not saved.",
    );
  }
}

export async function getDeviceQuickAuth(
  email: string,
  deviceId: string,
  opts?: { preferFresh?: boolean },
): Promise<StoredDeviceQuickAuth | null> {
  const normalizedEmail = normalizeAccountEmail(email);
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  if (!normalizedEmail || !normalizedDeviceId) return null;

  const store = await getStore(opts);
  const raw = store[storeKey(normalizedEmail, normalizedDeviceId)];
  if (!raw || !("deviceId" in raw)) return null;
  return raw;
}

export async function upsertDeviceQuickAuth(
  entry: StoredDeviceQuickAuth,
): Promise<StoredDeviceQuickAuth | null> {
  const normalizedEmail = normalizeAccountEmail(entry.email);
  const normalizedDeviceId = normalizeDeviceId(entry.deviceId);
  if (!normalizedEmail || !normalizedDeviceId) return null;

  const store = await getStore();
  const key = storeKey(normalizedEmail, normalizedDeviceId);
  const next: QuickAuthStore = { ...store };
  next[key] = {
    ...entry,
    email: normalizedEmail,
    deviceId: normalizedDeviceId,
    updatedAt: new Date().toISOString(),
  };
  await saveStore(next);
  const saved = next[key];
  return saved && "deviceId" in saved ? saved : null;
}

export async function removeDeviceQuickAuth(email: string, deviceId: string): Promise<void> {
  const normalizedEmail = normalizeAccountEmail(email);
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  if (!normalizedEmail || !normalizedDeviceId) return;

  const store = await getStore();
  const key = storeKey(normalizedEmail, normalizedDeviceId);
  if (!store[key]) return;

  const next = { ...store };
  delete next[key];
  await saveStore(next);
}

export async function clearPinForDevice(email: string, deviceId: string): Promise<void> {
  const existing = await getDeviceQuickAuth(email, deviceId);
  if (!existing) return;

  const { pinHash: _pin, pinUpdatedAt: _at, ...rest } = existing;
  if (!existing.webauthn) {
    await removeDeviceQuickAuth(email, deviceId);
    return;
  }

  await upsertDeviceQuickAuth(rest);
}

export async function clearWebAuthnForDevice(email: string, deviceId: string): Promise<void> {
  const existing = await getDeviceQuickAuth(email, deviceId);
  if (!existing) return;

  const { webauthn: _wa, ...rest } = existing;
  if (!existing.pinHash) {
    await removeDeviceQuickAuth(email, deviceId);
    return;
  }

  await upsertDeviceQuickAuth(rest);
}

export type QuickAuthStatus = {
  pin: boolean;
  webauthn: boolean;
};

export async function getEmailQuickAuthPreset(
  email: string,
  opts?: { preferFresh?: boolean },
): Promise<StoredEmailQuickAuthPreset | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const store = await getStore(opts);
  const raw = store[presetKey(normalizedEmail)];
  if (!raw || !("pinHash" in raw) || !raw.pinHash) return null;
  const preset = raw as StoredEmailQuickAuthPreset;
  return { ...preset, email: normalizedEmail };
}

export async function resolvePinHashForDevice(
  email: string,
  deviceId: string,
  preferFresh = false,
): Promise<{ pinHash: string; pinUpdatedAt?: string; fromPreset: boolean } | null> {
  const readOpts = preferFresh ? { preferFresh: true as const } : undefined;
  const entry = await getDeviceQuickAuth(email, deviceId, readOpts);
  if (entry?.pinHash) {
    return { pinHash: entry.pinHash, pinUpdatedAt: entry.pinUpdatedAt, fromPreset: false };
  }

  const preset = await getEmailQuickAuthPreset(email, readOpts);
  if (!preset?.pinHash) return null;
  return { pinHash: preset.pinHash, pinUpdatedAt: preset.pinUpdatedAt, fromPreset: true };
}

export async function materializePresetForDevice(email: string, deviceId: string): Promise<void> {
  const preset = await getEmailQuickAuthPreset(email);
  if (!preset) return;

  const existing = await getDeviceQuickAuth(email, deviceId);
  if (existing?.pinHash) return;

  await upsertDeviceQuickAuth({
    email,
    deviceId,
    pinHash: preset.pinHash,
    pinUpdatedAt: preset.pinUpdatedAt,
    webauthn: existing?.webauthn,
    updatedAt: new Date().toISOString(),
  });
}

export type QuickAuthDeviceSummary = {
  deviceId: string;
  pin: boolean;
  webauthn: boolean;
  updatedAt: string;
  pinUpdatedAt?: string;
};

export async function listQuickAuthDevicesForEmail(
  email: string,
): Promise<QuickAuthDeviceSummary[]> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];

  const store = await getStore();
  const prefix = `${normalizedEmail}:`;
  const devices: QuickAuthDeviceSummary[] = [];

  for (const [key, entry] of Object.entries(store)) {
    if (!key.startsWith(prefix) || key === presetKey(normalizedEmail)) continue;
    if (!("deviceId" in entry) || !entry.deviceId) continue;
    devices.push({
      deviceId: entry.deviceId,
      pin: Boolean(entry.pinHash),
      webauthn: Boolean(entry.webauthn?.credentialId),
      updatedAt: entry.updatedAt,
      pinUpdatedAt: entry.pinUpdatedAt,
    });
  }

  return devices.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function setAdminPinForEmail(
  email: string,
  pin: string,
  opts?: { deviceId?: string },
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const pinHash = hashPin(pin);
  const now = new Date().toISOString();
  const store = await getStore();
  const next: QuickAuthStore = { ...store };

  next[presetKey(normalizedEmail)] = {
    email: normalizedEmail,
    pinHash,
    pinUpdatedAt: now,
    updatedAt: now,
  };

  const prefix = `${normalizedEmail}:`;
  for (const [key, entry] of Object.entries(next)) {
    if (!key.startsWith(prefix) || key === presetKey(normalizedEmail)) continue;
    if (!("deviceId" in entry)) continue;
    next[key] = {
      ...entry,
      pinHash,
      pinUpdatedAt: now,
      updatedAt: now,
    };
  }

  const normalizedDeviceId = opts?.deviceId ? normalizeDeviceId(opts.deviceId) : null;
  if (normalizedDeviceId) {
    const deviceKey = storeKey(normalizedEmail, normalizedDeviceId);
    const existing = next[deviceKey];
    next[deviceKey] =
      existing && "deviceId" in existing
        ? {
            ...existing,
            pinHash,
            pinUpdatedAt: now,
            updatedAt: now,
          }
        : {
            email: normalizedEmail,
            deviceId: normalizedDeviceId,
            pinHash,
            pinUpdatedAt: now,
            updatedAt: now,
          };
  }

  await saveStore(next);
}

export async function clearAdminPinForEmail(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const store = await getStore();
  const next: QuickAuthStore = { ...store };
  delete next[presetKey(normalizedEmail)];

  const prefix = `${normalizedEmail}:`;
  for (const [key, entry] of Object.entries(next)) {
    if (!key.startsWith(prefix) || key === presetKey(normalizedEmail)) continue;
    if (!("deviceId" in entry) || !entry.pinHash) continue;

    const { pinHash: _pin, pinUpdatedAt: _at, ...rest } = entry;
    if (!entry.webauthn) {
      delete next[key];
    } else {
      next[key] = { ...rest, updatedAt: new Date().toISOString() };
    }
  }

  await saveStore(next);
}

export async function clearWebAuthnForEmail(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const store = await getStore();
  const next: QuickAuthStore = { ...store };
  const prefix = `${normalizedEmail}:`;

  for (const [key, entry] of Object.entries(next)) {
    if (!key.startsWith(prefix) || key === presetKey(normalizedEmail)) continue;
    if (!("deviceId" in entry) || !entry.webauthn) continue;

    const { webauthn: _wa, ...rest } = entry;
    if (!entry.pinHash) {
      delete next[key];
    } else {
      next[key] = { ...rest, updatedAt: new Date().toISOString() };
    }
  }

  await saveStore(next);
}

export async function clearAllQuickAuthForEmail(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const store = await getStore();
  const next: QuickAuthStore = { ...store };
  const prefix = `${normalizedEmail}:`;

  for (const key of Object.keys(next)) {
    if (key.startsWith(prefix)) {
      delete next[key];
    }
  }

  await saveStore(next);
}

/** Wait until blob read path sees the new PIN (serverless write propagation). */
export async function confirmPinPersisted(
  email: string,
  deviceId: string,
  pin: string,
  attempts = 16,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      memoryStore = null;
      await new Promise((r) => setTimeout(r, 300));
    }
    const record = await resolvePinHashForDevice(email, deviceId, i > 0);
    if (record && verifyPin(pin, record.pinHash)) return true;
  }
  return false;
}

export async function quickAuthStatusForDevice(
  email: string,
  deviceId: string,
  opts?: { preferFresh?: boolean },
): Promise<QuickAuthStatus | null> {
  const readOpts = opts?.preferFresh ? { preferFresh: true as const } : undefined;
  const entry = await getDeviceQuickAuth(email, deviceId, readOpts);
  const preset = await getEmailQuickAuthPreset(email, readOpts);
  const pin = Boolean(entry?.pinHash || preset?.pinHash);
  const webauthn = Boolean(entry?.webauthn?.credentialId);

  if (!pin && !webauthn) return null;
  return { pin, webauthn };
}

export async function getQuickAuthAdminSummary(email: string): Promise<{
  presetPin: boolean;
  devices: QuickAuthDeviceSummary[];
  summary: {
    deviceCount: number;
    pinDevices: number;
    webauthnDevices: number;
    presetPin: boolean;
  };
}> {
  const preset = await getEmailQuickAuthPreset(email);
  const devices = await listQuickAuthDevicesForEmail(email);

  return {
    presetPin: Boolean(preset?.pinHash),
    devices,
    summary: {
      deviceCount: devices.length,
      pinDevices: devices.filter((d) => d.pin).length,
      webauthnDevices: devices.filter((d) => d.webauthn).length,
      presetPin: Boolean(preset?.pinHash),
    },
  };
}