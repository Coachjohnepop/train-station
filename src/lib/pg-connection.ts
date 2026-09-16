import pg from "pg";

/** Remove sslmode from URL — pg v8+ treats require as verify-full and ignores pool.ssl. */
export function stripSslModeParams(connectionString: string): string {
  try {
    const normalized = connectionString.replace(/^postgres:/, "postgresql:");
    const url = new URL(normalized);
    url.searchParams.delete("sslmode");
    return url.toString().replace(/^postgresql:/, "postgres:");
  } catch {
    return connectionString
      .replace(/([?&])sslmode=[^&]*/g, "$1")
      .replace(/[?&]$/, "");
  }
}

function needsRemoteSsl(connectionString: string): boolean {
  return /supabase\.co|pooler\.supabase\.com|amazonaws\.com/i.test(
    connectionString,
  );
}

const pools = new Map<string, pg.Pool>();

/** Shared pg Pool for Prisma adapter (Supabase / remote Postgres). */
export function createPgPool(connectionString: string): pg.Pool {
  const cleaned = stripSslModeParams(connectionString);
  const existing = pools.get(cleaned);
  if (existing) return existing;

  const config: pg.PoolConfig = {
    connectionString: cleaned,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    allowExitOnIdle: true,
  };
  if (needsRemoteSsl(connectionString)) {
    config.ssl = { rejectUnauthorized: false };
  }
  const pool = new pg.Pool(config);
  pool.on("error", (err) => {
    console.error("[pg-pool]", err.message);
  });
  pools.set(cleaned, pool);
  return pool;
}