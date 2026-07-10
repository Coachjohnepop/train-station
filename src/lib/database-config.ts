function isUsableDatabaseUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes("dummy")) return false;
  if (/user:pass@localhost/i.test(url)) return false;
  return true;
}

/** Pooled Postgres URL (Prisma client + serverless). */
export function resolveDatabaseUrl(): string {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
  ];
  for (const url of candidates) {
    if (url && isUsableDatabaseUrl(url)) return url;
  }
  return candidates.find(Boolean) ?? "";
}

/** Direct Postgres URL (migrations / DDL). */
export function resolveDirectUrl(): string {
  return (
    process.env.DIRECT_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    resolveDatabaseUrl()
  );
}

/** True when a real Postgres DATABASE_URL is configured (not demo/dummy). */
export function isDatabaseConfigured(): boolean {
  return isUsableDatabaseUrl(resolveDatabaseUrl());
}