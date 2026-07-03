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

/** Shared pg Pool for Prisma adapter (Supabase / remote Postgres). */
export function createPgPool(connectionString: string): pg.Pool {
  const cleaned = stripSslModeParams(connectionString);
  const config: pg.PoolConfig = { connectionString: cleaned };
  if (needsRemoteSsl(connectionString)) {
    config.ssl = { rejectUnauthorized: false };
  }
  return new pg.Pool(config);
}