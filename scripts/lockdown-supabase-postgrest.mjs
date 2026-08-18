#!/usr/bin/env node
/**
 * Close Supabase PostgREST (anon/authenticated) on the live catalog DB.
 * The app uses Prisma as postgres — not the JS client — so RLS with no
 * policies is the correct lock. Re-run after prisma migrate deploy.
 */
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.vercel.production", override: true, quiet: true });

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DIRECT_URL;
if (!url || url.includes("dummy")) {
  console.error("Need POSTGRES_URL_NON_POOLING / DIRECT_URL");
  process.exit(1);
}

const cleaned = url.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, "");
const client = new pg.Client({
  connectionString: cleaned,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

async function run(label, sql) {
  try {
    await client.query(sql);
    console.log("OK", label);
  } catch (e) {
    console.log("SKIP", label, e.message.split("\n")[0]);
  }
}

await client.connect();
await run("revoke tables", `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated`);
await run("revoke sequences", `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated`);
await run("revoke functions", `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated`);
await run("revoke schema", `REVOKE ALL ON SCHEMA public FROM anon, authenticated`);
await run(
  "defpriv tables",
  `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated`,
);
await run(
  "defpriv sequences",
  `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated`,
);
await run(
  "defpriv functions",
  `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated`,
);
await run(
  "enable rls",
  `DO $$
  DECLARE r record;
  BEGIN
    FOR r IN
      SELECT n.nspname, c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity
    LOOP
      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.nspname, r.relname);
    END LOOP;
  END $$;`,
);

const check = await client.query(`
  SELECT
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r') AS tables,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS rls_on,
    (SELECT count(*)::int FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')) AS leftover_grants,
    (SELECT count(*)::int FROM "User") AS users
`);
console.log("CHECK", JSON.stringify(check.rows[0]));
await client.end();
