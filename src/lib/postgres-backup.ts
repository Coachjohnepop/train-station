import { gzipSync } from "node:zlib";
import { prisma } from "@/lib/prisma";

const SKIP_TABLES = new Set([
  "_prisma_migrations",
]);

/** Never put these columns in a Blob backup. Local Desktop dump may keep them. */
const REDACT_COLUMNS = new Set([
  "passwordHash",
  "passwordhash",
  "tokenHash",
  "tokenhash",
  "hashedPassword",
]);

const ANALYTICS_CAP = 20_000;

type TableRow = { tablename: string };

export type BackupResult = {
  at: string;
  tables: Record<string, number>;
  skipped: string[];
  bytesUncompressed: number;
  gzip: Buffer;
};

function redact(row: Record<string, unknown>, redactSecrets: boolean) {
  if (!redactSecrets) return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = REDACT_COLUMNS.has(k) ? "[redacted]" : v;
  }
  return out;
}

export async function buildPostgresBackup(opts?: {
  redactSecrets?: boolean;
}): Promise<BackupResult> {
  const redactSecrets = opts?.redactSecrets !== false;
  const tables = await prisma.$queryRaw<TableRow[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  const payload: Record<string, unknown> = {
    at: new Date().toISOString(),
    host: "train-station-catalog",
    redactSecrets,
  };
  const counts: Record<string, number> = {};
  const skipped: string[] = [];

  for (const { tablename } of tables) {
    if (SKIP_TABLES.has(tablename)) {
      skipped.push(tablename);
      continue;
    }
    const ident = tablename.replace(/"/g, "");
    if (ident === "AnalyticsEvent") {
      const n = await prisma.analyticsEvent.count();
      if (n > ANALYTICS_CAP) {
        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const rows = await prisma.analyticsEvent.findMany({
          where: { occurredAt: { gte: since } },
        });
        payload[ident] = rows;
        counts[ident] = rows.length;
        skipped.push(`${ident} (kept last 14d of ${n})`);
        continue;
      }
    }
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${ident}"`,
    );
    payload[ident] = rows.map((r) => redact(r, redactSecrets));
    counts[ident] = rows.length;
  }

  payload.counts = counts;
  payload.skipped = skipped;
  const json = JSON.stringify(payload);
  return {
    at: String(payload.at),
    tables: counts,
    skipped,
    bytesUncompressed: Buffer.byteLength(json),
    gzip: gzipSync(Buffer.from(json)),
  };
}
