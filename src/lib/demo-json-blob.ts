import fs from "fs";
import path from "path";
import { head, put, type PutCommandOptions } from "@vercel/blob";

// Static read-write token — used locally or when OIDC is unavailable.
// On Vercel, prefer OIDC (VERCEL_OIDC_TOKEN + BLOB_STORE_ID) after plan upgrades
// because legacy static tokens can remain tied to a suspended billing state.
export const BLOB_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN || process.env.TS_BLOB_TOKEN;

export function blobStoreId(): string | undefined {
  const raw = process.env.BLOB_STORE_ID?.trim();
  if (!raw) return undefined;
  return raw.startsWith("store_") ? raw : `store_${raw}`;
}

export function useBlobOidc(): boolean {
  return Boolean(
    process.env.VERCEL && blobStoreId() && process.env.VERCEL_OIDC_TOKEN,
  );
}

export function isBlobConfigured(): boolean {
  return useBlobOidc() || Boolean(BLOB_TOKEN);
}

/** SDK options: OIDC on Vercel when connected, else static token, else env auto-resolve. */
export function blobSdkOptions(): PutCommandOptions {
  return blobSdkOptionVariants()[0] ?? { access: "public" };
}

/** Try OIDC first, then static token — avoids reset/login reads failing when OIDC is flaky. */
export function blobSdkOptionVariants(): PutCommandOptions[] {
  const access = "public" as const;
  const variants: PutCommandOptions[] = [];
  const storeId = blobStoreId();
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  if (process.env.VERCEL && storeId && oidcToken) {
    variants.push({ access, storeId, oidcToken });
  }
  if (BLOB_TOKEN) {
    const tokenOpt = { access, token: BLOB_TOKEN };
    const duplicate = variants.some(
      (v) => "token" in v && (v as { token?: string }).token === BLOB_TOKEN,
    );
    if (!duplicate) variants.push(tokenOpt);
  }
  if (variants.length === 0) variants.push({ access });
  return variants;
}

function blobPublicHost(): string | null {
  const fromEnv = process.env.BLOB_PUBLIC_HOST?.trim();
  if (fromEnv) {
    return fromEnv.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  // Derive from vercel_blob_rw_<storeId>… token when env host is unset on Vercel.
  const token = BLOB_TOKEN;
  if (!token) return null;
  const match = token.match(/^vercel_blob_rw_([A-Za-z0-9]+)/);
  if (!match) return null;
  return `${match[1].toLowerCase()}.public.blob.vercel-storage.com`;
}

function publicBlobFetchUrl(blobPath: string): string | null {
  const host = blobPublicHost();
  if (!host) return null;
  return `https://${host}/${blobPath}`;
}

async function readBlobJsonViaPublicUrl<T>(blobPath: string): Promise<T | null> {
  const url = publicBlobFetchUrl(blobPath);
  if (!url) return null;
  try {
    const bust = `_ts=${Date.now()}`;
    const res = await fetch(`${url}?${bust}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function readBlobJson<T>(blobPath: string): Promise<T | null> {
  const viaPublic = await readBlobJsonViaPublicUrl<T>(blobPath);
  if (viaPublic) return viaPublic;

  if (!isBlobConfigured()) {
    return null;
  }
  for (const opts of blobSdkOptionVariants()) {
    try {
      const meta = await head(blobPath, opts);
      const bust = `_ts=${Date.now()}`;
      const url = meta.url.includes("?") ? `${meta.url}&${bust}` : `${meta.url}?${bust}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      return (await res.json()) as T;
    } catch {
      continue;
    }
  }
  const viaPublic = await readBlobJsonViaPublicUrl<T>(blobPath);
  if (viaPublic) return viaPublic;
  return null;
}

export type BlobWriteFailure = {
  ok: false;
  reason: "no_token" | "suspended" | "error";
  message: string;
};

export async function probeBlobWrite(): Promise<
  { ok: true } | BlobWriteFailure
> {
  if (!isBlobConfigured()) {
    return {
      ok: false,
      reason: "no_token",
      message:
        "Connect the Blob store to this project (BLOB_STORE_ID + OIDC on Vercel) or set TS_BLOB_TOKEN.",
    };
  }
  const probePath = "demo/_write-probe.json";
  const payload = JSON.stringify({ probe: Date.now() });
  try {
    await put(probePath, payload, {
      ...blobSdkOptions(),
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/suspended/i.test(message)) {
      return {
        ok: false,
        reason: "suspended",
        message:
          "Vercel Blob store is suspended — reactivate it in Vercel → Storage → Blob, or connect the store to this project for OIDC auth.",
      };
    }
    return {
      ok: false,
      reason: "error",
      message: message || "Blob write failed.",
    };
  }
}

export async function writeBlobJson(blobPath: string, data: unknown): Promise<boolean> {
  if (!isBlobConfigured()) return false;
  let lastError: unknown;
  for (const opts of blobSdkOptionVariants()) {
    try {
      await put(blobPath, JSON.stringify(data, null, 2), {
        ...opts,
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return true;
    } catch (e) {
      lastError = e;
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  if (/suspended/i.test(msg)) {
    console.warn(`Vercel Blob store suspended — cannot persist ${blobPath}`);
  } else {
    console.warn(`Could not persist blob ${blobPath}`, lastError);
  }
  return false;
}

export function readLocalJson<T>(localPath: string): T | null {
  try {
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, "utf8")) as T;
    }
  } catch (e) {
    console.warn(`Could not read ${localPath}`, e);
  }
  return null;
}

export function writeLocalJson(localPath: string, data: unknown): void {
  try {
    fs.writeFileSync(localPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn(`Could not write ${localPath}`, e);
  }
}

const blobCheckedAt = new Map<string, number>();
const BLOB_REFRESH_MS = 8_000;

export async function hydrateJsonStore<T>(opts: {
  blobPath: string;
  localPath: string;
  memory: T | null;
  setMemory: (v: T) => void;
  fallback: () => T;
  /** Skip in-memory cache — use on read paths so serverless instances see latest Blob/disk writes. */
  preferFresh?: boolean;
}): Promise<T> {
  if (opts.preferFresh) {
    if (isBlobConfigured()) {
      const fromBlob = await readBlobJson<T>(opts.blobPath);
      blobCheckedAt.set(opts.blobPath, Date.now());
      if (fromBlob) {
        opts.setMemory(fromBlob);
        return fromBlob;
      }
    }
    const fromDisk = readLocalJson<T>(opts.localPath);
    if (fromDisk) {
      opts.setMemory(fromDisk);
      return fromDisk;
    }
  }

  const now = Date.now();
  const lastCheck = blobCheckedAt.get(opts.blobPath) ?? 0;
  const shouldRefreshBlob = isBlobConfigured() && now - lastCheck >= BLOB_REFRESH_MS;

  if (shouldRefreshBlob) {
    blobCheckedAt.set(opts.blobPath, now);
    const fromBlob = await readBlobJson<T>(opts.blobPath);
    if (fromBlob) {
      opts.setMemory(fromBlob);
      return fromBlob;
    }
  }

  // Prefer instance memory so read-after-write on the same warm lambda stays consistent.
  if (opts.memory) return opts.memory;

  const fromBlob = await readBlobJson<T>(opts.blobPath);
  blobCheckedAt.set(opts.blobPath, Date.now());
  if (fromBlob) {
    opts.setMemory(fromBlob);
    return fromBlob;
  }

  const fromDisk = readLocalJson<T>(opts.localPath);
  if (fromDisk) {
    opts.setMemory(fromDisk);
    void writeBlobJson(opts.blobPath, fromDisk);
    return fromDisk;
  }

  const empty = opts.fallback();
  opts.setMemory(empty);
  return empty;
}

export async function persistJsonStore<T>(opts: {
  blobPath: string;
  localPath: string;
  data: T;
  setMemory: (v: T) => void;
}): Promise<{ blobSaved: boolean }> {
  opts.setMemory(opts.data);
  writeLocalJson(opts.localPath, opts.data);
  const blobSaved = await writeBlobJson(opts.blobPath, opts.data);
  // Mark blob as fresh so the next hydrate on this instance prefers in-memory data
  // (avoids read-after-write races where CDN/blob head lags behind a just-written profile).
  blobCheckedAt.set(opts.blobPath, Date.now());
  return { blobSaved };
}