import type { BlobStoreKey } from "@/lib/blob-migration-config";

export type ParityMismatch = {
  path: string;
  blobValue: unknown;
  dbValue: unknown;
};

export type ParityReport = {
  store: BlobStoreKey;
  matched: boolean;
  blobCount: number | null;
  dbCount: number | null;
  mismatches: ParityMismatch[];
  checkedAt: string;
};

const MAX_MISMATCHES = 25;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function collectMismatches(
  blob: unknown,
  db: unknown,
  basePath: string,
  out: ParityMismatch[],
): void {
  if (out.length >= MAX_MISMATCHES) return;
  if (valuesEqual(blob, db)) return;

  if (isPlainObject(blob) && isPlainObject(db)) {
    const keys = new Set([...Object.keys(blob), ...Object.keys(db)]);
    for (const key of [...keys].sort()) {
      collectMismatches(blob[key], db[key], basePath ? `${basePath}.${key}` : key, out);
      if (out.length >= MAX_MISMATCHES) return;
    }
    return;
  }

  if (Array.isArray(blob) && Array.isArray(db)) {
    const max = Math.max(blob.length, db.length);
    for (let i = 0; i < max; i++) {
      collectMismatches(blob[i], db[i], `${basePath}[${i}]`, out);
      if (out.length >= MAX_MISMATCHES) return;
    }
    return;
  }

  out.push({ path: basePath || "(root)", blobValue: blob, dbValue: db });
}

/** Deep-compare blob vs DB snapshots; caps mismatch list for logging. */
export function compareBlobAndDbSnapshots(
  store: BlobStoreKey,
  blobSnapshot: unknown,
  dbSnapshot: unknown,
): ParityReport {
  const mismatches: ParityMismatch[] = [];
  collectMismatches(blobSnapshot, dbSnapshot, "", mismatches);

  const blobCount = Array.isArray(blobSnapshot)
    ? blobSnapshot.length
    : isPlainObject(blobSnapshot)
      ? Object.keys(blobSnapshot).length
      : blobSnapshot == null
        ? 0
        : null;

  const dbCount = Array.isArray(dbSnapshot)
    ? dbSnapshot.length
    : isPlainObject(dbSnapshot)
      ? Object.keys(dbSnapshot).length
      : dbSnapshot == null
        ? 0
        : null;

  return {
    store,
    matched: mismatches.length === 0,
    blobCount,
    dbCount,
    mismatches,
    checkedAt: new Date().toISOString(),
  };
}

/** Structured log for dual-write verification (grep: migration-parity-mismatch). */
export function logParityReport(report: ParityReport): void {
  if (report.matched) {
    console.info(
      "[migration-parity] store=%s matched blobCount=%s dbCount=%s",
      report.store,
      report.blobCount,
      report.dbCount,
    );
    return;
  }

  console.warn(
    "[migration-parity-mismatch] store=%s blobCount=%s dbCount=%s mismatchCount=%s",
    report.store,
    report.blobCount,
    report.dbCount,
    report.mismatches.length,
  );

  for (const mismatch of report.mismatches) {
    console.warn(
      "[migration-parity-mismatch] store=%s path=%s blob=%s db=%s",
      report.store,
      mismatch.path,
      stableStringify(mismatch.blobValue),
      stableStringify(mismatch.dbValue),
    );
  }
}