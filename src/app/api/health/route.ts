import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/database-config";

export const dynamic = "force-dynamic";

/**
 * Uptime probe. Does not leak connection strings or member data.
 * 200 = site process is up; db=ok means Postgres answered SELECT 1.
 */
export async function GET() {
  const started = Date.now();
  let db: "ok" | "skip" | "error" = "skip";
  if (isDatabaseConfigured()) {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
      db = "ok";
    } catch {
      db = "error";
    }
  }
  const ok = db !== "error";
  return NextResponse.json(
    { ok, db, ms: Date.now() - started },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
