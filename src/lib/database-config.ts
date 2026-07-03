/** Pooled Postgres URL (Prisma client + serverless). */
export function resolveDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    ""
  );
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
  const url = resolveDatabaseUrl();
  if (!url) return false;
  if (url.includes("dummy")) return false;
  if (/user:pass@localhost/i.test(url)) return false;
  return true;
}