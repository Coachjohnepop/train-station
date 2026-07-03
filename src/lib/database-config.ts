/** True when a real Postgres DATABASE_URL is configured (not demo/dummy). */
export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return false;
  if (url.includes("dummy")) return false;
  if (/user:pass@localhost/i.test(url)) return false;
  return true;
}