import fs from "fs";
import path from "path";
import { head, put } from "@vercel/blob";

// BLOB_READ_WRITE_TOKEN is a Vercel-reserved name tied to the Blob integration;
// on this project it isn't injected into the function runtime, so we also accept
// a plain TS_BLOB_TOKEN and pass it explicitly to the SDK.
export const BLOB_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN || process.env.TS_BLOB_TOKEN;

export async function readBlobJson<T>(blobPath: string): Promise<T | null> {
  if (!BLOB_TOKEN) return null;
  try {
    const meta = await head(blobPath, { token: BLOB_TOKEN });
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type BlobWriteFailure = {
  ok: false;
  reason: "no_token" | "suspended" | "error";
  message: string;
};

export async function probeBlobWrite(): Promise<
  { ok: true } | BlobWriteFailure
> {
  if (!BLOB_TOKEN) {
    return {
      ok: false,
      reason: "no_token",
      message: "Set TS_BLOB_TOKEN or BLOB_READ_WRITE_TOKEN on Vercel.",
    };
  }
  const probePath = "demo/_write-probe.json";
  const payload = JSON.stringify({ probe: Date.now() });
  try {
    await put(probePath, payload, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: BLOB_TOKEN,
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/suspended/i.test(message)) {
      return {
        ok: false,
        reason: "suspended",
        message:
          "Vercel Blob store is suspended — reactivate it in Vercel → Storage → Blob, or create a new store and update TS_BLOB_TOKEN.",
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
  if (!BLOB_TOKEN) return false;
  try {
    await put(blobPath, JSON.stringify(data, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: BLOB_TOKEN,
    });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/suspended/i.test(msg)) {
      console.warn(`Vercel Blob store suspended — cannot persist ${blobPath}`);
    } else {
      console.warn(`Could not persist blob ${blobPath}`, e);
    }
    return false;
  }
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
  /** Skip in-memory cache — use on read paths so serverless instances see latest Blob writes. */
  preferFresh?: boolean;
}): Promise<T> {
  if (opts.preferFresh && BLOB_TOKEN) {
    const fromBlob = await readBlobJson<T>(opts.blobPath);
    blobCheckedAt.set(opts.blobPath, Date.now());
    if (fromBlob) {
      opts.setMemory(fromBlob);
      return fromBlob;
    }
  }

  const now = Date.now();
  const lastCheck = blobCheckedAt.get(opts.blobPath) ?? 0;
  const shouldRefreshBlob = BLOB_TOKEN && now - lastCheck >= BLOB_REFRESH_MS;

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
  // Force the next preferFresh read to pull this write (not a stale cached head).
  blobCheckedAt.delete(opts.blobPath);
  return { blobSaved };
}