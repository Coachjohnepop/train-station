import { NextResponse } from "next/server";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";

export type DemoSaveResult = {
  exercisesBlobSaved: boolean;
  seedBlobSaved: boolean;
};

export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

export function isDemoBlobConfigured(): boolean {
  return Boolean(BLOB_TOKEN);
}

export function demoPersistenceStatus() {
  const onVercel = isVercelRuntime();
  const blobConfigured = isDemoBlobConfigured();
  return {
    onVercel,
    blobConfigured,
    durable: !onVercel || blobConfigured,
    message: !onVercel
      ? "Changes save to local prisma/*.dev.json and seed-data.json."
      : blobConfigured
        ? "Changes save to cloud storage and survive redeploy."
        : "Cloud storage is not configured — edits may disappear after redeploy. Set TS_BLOB_TOKEN on Vercel, or run npm run db:export-seed and commit seed-data.json.",
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

export function demoPersistenceWarning(result: DemoSaveResult): string | null {
  if (isVercelRuntime() && !isDemoBlobConfigured()) {
    return "Saved for this session only. Set TS_BLOB_TOKEN on Vercel for permanent saves.";
  }
  if (isVercelRuntime() && (!result.exercisesBlobSaved || !result.seedBlobSaved)) {
    return "Cloud save may be incomplete — refresh and verify your change stuck.";
  }
  return null;
}