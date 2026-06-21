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
    console.warn(`Could not persist blob ${blobPath}`, e);
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

export async function hydrateJsonStore<T>(opts: {
  blobPath: string;
  localPath: string;
  memory: T | null;
  setMemory: (v: T) => void;
  fallback: () => T;
}): Promise<T> {
  // When Blob is configured, always read remote state so serverless instances
  // don't serve stale in-memory data from before another instance wrote.
  if (BLOB_TOKEN) {
    const fromBlob = await readBlobJson<T>(opts.blobPath);
    if (fromBlob) {
      opts.setMemory(fromBlob);
      return fromBlob;
    }
  } else if (opts.memory) {
    return opts.memory;
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
  return { blobSaved };
}