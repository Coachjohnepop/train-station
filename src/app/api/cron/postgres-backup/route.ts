/** Weekly snapshot. Vercel cron: Mondays 15:00 UTC (8am PT). Bearer CRON_SECRET. */
import { NextResponse } from "next/server";
import { del, list, put } from "@vercel/blob";
import { blobSdkOptions, isBlobConfigured } from "@/lib/demo-json-blob";
import { isDatabaseConfigured } from "@/lib/database-config";
import { buildPostgresBackup } from "@/lib/postgres-backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PREFIX = "backups/postgres/weekly-";
const KEEP = 8;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, detail: "no database" }, { status: 503 });
  }
  if (!isBlobConfigured()) {
    return NextResponse.json({ ok: false, detail: "blob not configured" }, { status: 503 });
  }

  const backup = await buildPostgresBackup({ redactSecrets: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const pathname = `${PREFIX}${stamp}.json.gz`;
  const base = blobSdkOptions();
  // Private only — a public gzip is still a member roster + logs.
  const blob = await put(pathname, backup.gzip, {
    ...base,
    access: "private",
    contentType: "application/gzip",
    addRandomSuffix: false,
  });

  let pruned = 0;
  try {
    const listed = await list({ prefix: "backups/postgres/", ...blobSdkOptions() });
    const weekly = listed.blobs
      .filter((b) => b.pathname.startsWith(PREFIX))
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
    const extra = weekly.slice(KEEP);
    if (extra.length) {
      await del(
        extra.map((b) => b.url),
        blobSdkOptions(),
      );
      pruned = extra.length;
    }
  } catch (e) {
    console.warn("[postgres-backup] prune failed", e);
  }

  return NextResponse.json({
    ok: true,
    pathname: blob.pathname,
    bytes: backup.gzip.length,
    tables: Object.keys(backup.tables).length,
    skipped: backup.skipped,
    pruned,
  });
}
