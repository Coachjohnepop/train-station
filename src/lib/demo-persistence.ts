import { NextResponse } from "next/server";
import { isBlobConfigured, probeBlobWrite, useBlobOidc } from "@/lib/demo-json-blob";

export type DemoSaveResult = {
  exercisesBlobSaved: boolean;
  seedBlobSaved: boolean;
};

export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

export function isDemoBlobConfigured(): boolean {
  return isBlobConfigured();
}

export function demoPersistenceStatus() {
  const onVercel = isVercelRuntime();
  const blobConfigured = isDemoBlobConfigured();
  return {
    onVercel,
    blobConfigured,
    blobAuth: useBlobOidc() ? "oidc" : blobConfigured ? "token" : "none",
    durable: !onVercel || blobConfigured,
    message: !onVercel
      ? "Changes save to local prisma/*.dev.json and seed-data.json."
      : blobConfigured
        ? useBlobOidc()
          ? "Changes save via OIDC to the connected Blob store."
          : "Changes save to cloud storage and survive redeploy."
        : "Cloud storage is not configured — connect the Blob store (BLOB_STORE_ID) or set TS_BLOB_TOKEN on Vercel, or run npm run db:export-seed and commit seed-data.json.",
  };
}

export async function demoPersistenceHealth() {
  const base = demoPersistenceStatus();
  if (!base.onVercel || !base.blobConfigured) {
    return { ...base, blobWritable: !base.onVercel, blobIssue: null as string | null };
  }
  const probe = await probeBlobWrite();
  if (probe.ok) {
    return {
      ...base,
      blobWritable: true,
      blobIssue: null,
      message: "Cloud storage is writable — admin edits will persist across redeploys.",
    };
  }
  return {
    ...base,
    durable: false,
    blobWritable: false,
    blobIssue: probe.reason,
    message: probe.message,
  };
}

/** Returns a 503 response when a Vercel deploy with blob configured failed to persist. */
export function demoPersistenceError(
  result: DemoSaveResult,
  action: string,
): NextResponse | null {
  if (!isVercelRuntime() || !isDemoBlobConfigured()) return null;

  if (!result.exercisesBlobSaved || !result.seedBlobSaved) {
    return NextResponse.json(
      {
        detail: `${action} could not be saved to cloud storage — retry in a moment.`,
        persistence: demoPersistenceStatus(),
      },
      { status: 503 },
    );
  }

  return null;
}

/** Throws when a demo JSON blob write failed on Vercel (chat, accounts, etc.). */
export function requireBlobPersisted(blobSaved: boolean, action: string): void {
  if (isVercelRuntime() && !blobSaved) {
    throw new Error(
      blobConfigured()
        ? `${action} could not be saved to cloud storage — retry in a moment.`
        : `${action} could not be saved — set TS_BLOB_TOKEN on Vercel for durable demo storage.`,
    );
  }
}

function blobConfigured(): boolean {
  return isDemoBlobConfigured();
}

export function demoPersistenceWarning(result: DemoSaveResult): string | null {
  if (isVercelRuntime() && !isDemoBlobConfigured()) {
    return "Saved for this session only. Set TS_BLOB_TOKEN on Vercel for permanent saves.";
  }
  if (isVercelRuntime() && (!result.exercisesBlobSaved || !result.seedBlobSaved)) {
    return "Cloud save may be incomplete — refresh and verify your change stuck.";
  }
  return null;
}