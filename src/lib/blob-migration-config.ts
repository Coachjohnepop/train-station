import { isDatabaseConfigured } from "@/lib/database-config";

function isDemoMode(): boolean {
  return !isDatabaseConfigured();
}

/** Vercel Blob JSON stores targeted for Postgres migration (Tiers 1–3). */
export type BlobStoreKey =
  | "registered-accounts"
  | "member-profiles"
  | "sms-workouts"
  | "oauth-identities"
  | "password-reset-tokens"
  | "coach-chat"
  | "live-workout-sessions"
  | "coach-settings"
  | "member-coach-prefs"
  | "commission-ledger"
  | "commission-partners"
  | "referral-codes"
  | "stripe-webhook-events"
  | "waitlist"
  | "custom-training-offers";

export type StoreReadMode = "blob" | "db" | "db_with_blob_fallback";
export type StoreWriteMode = "blob" | "db" | "dual";

/** All migratable blob stores (stable iteration order). */
export const BLOB_STORE_KEYS: readonly BlobStoreKey[] = [
  "registered-accounts",
  "member-profiles",
  "sms-workouts",
  "oauth-identities",
  "password-reset-tokens",
  "coach-chat",
  "live-workout-sessions",
  "coach-settings",
  "member-coach-prefs",
  "commission-ledger",
  "commission-partners",
  "referral-codes",
  "stripe-webhook-events",
  "waitlist",
  "custom-training-offers",
] as const;

const DEFAULT_READ_MODE: StoreReadMode = "blob";
const DEFAULT_WRITE_MODE: StoreWriteMode = "blob";

const READ_MODE_VALUES: readonly StoreReadMode[] = [
  "blob",
  "db",
  "db_with_blob_fallback",
] as const;

const WRITE_MODE_VALUES: readonly StoreWriteMode[] = ["blob", "db", "dual"] as const;

function envKeyForStore(store: BlobStoreKey, kind: "READ" | "WRITE"): string {
  const slug = store.replace(/-/g, "_").toUpperCase();
  return `BLOB_MIGRATION_${slug}_${kind}`;
}

function parseReadMode(raw: string | undefined): StoreReadMode | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return READ_MODE_VALUES.includes(normalized as StoreReadMode)
    ? (normalized as StoreReadMode)
    : null;
}

function parseWriteMode(raw: string | undefined): StoreWriteMode | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return WRITE_MODE_VALUES.includes(normalized as StoreWriteMode)
    ? (normalized as StoreWriteMode)
    : null;
}

/** Effective read mode for a store. Demo mode always uses blob. */
export function readMode(store: BlobStoreKey): StoreReadMode {
  if (isDemoMode()) return "blob";
  const override = parseReadMode(process.env[envKeyForStore(store, "READ")]);
  return override ?? DEFAULT_READ_MODE;
}

/** Effective write mode for a store. Demo mode always uses blob. */
export function writeMode(store: BlobStoreKey): StoreWriteMode {
  if (isDemoMode()) return "blob";
  const override = parseWriteMode(process.env[envKeyForStore(store, "WRITE")]);
  return override ?? DEFAULT_WRITE_MODE;
}

/** True when reads should hit Postgres (with optional blob fallback). */
export function readsFromDatabase(store: BlobStoreKey): boolean {
  const mode = readMode(store);
  return mode === "db" || mode === "db_with_blob_fallback";
}

/** True when writes should hit Postgres (dual-write or db-only). */
export function writesToDatabase(store: BlobStoreKey): boolean {
  const mode = writeMode(store);
  return mode === "db" || mode === "dual";
}

/** True when blob remains the write path (blob-only or dual-write). */
export function writesToBlob(store: BlobStoreKey): boolean {
  const mode = writeMode(store);
  return mode === "blob" || mode === "dual";
}

/** True when DB read failures may fall back to blob. */
export function blobReadFallbackEnabled(store: BlobStoreKey): boolean {
  return !isDemoMode() && readMode(store) === "db_with_blob_fallback";
}

export type BlobMigrationStoreStatus = {
  store: BlobStoreKey;
  read: StoreReadMode;
  write: StoreWriteMode;
  envReadKey: string;
  envWriteKey: string;
};

/** Snapshot of migration phase per store (admin diagnostics / smoke tests). */
export function getBlobMigrationStatus(): BlobMigrationStoreStatus[] {
  return BLOB_STORE_KEYS.map((store) => ({
    store,
    read: readMode(store),
    write: writeMode(store),
    envReadKey: envKeyForStore(store, "READ"),
    envWriteKey: envKeyForStore(store, "WRITE"),
  }));
}