import { NextResponse } from "next/server";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { demoPersistenceHealth, migrationPersistenceSnapshot } from "@/lib/demo-persistence";

export async function GET() {
  const snapshot = migrationPersistenceSnapshot();

  if (!isCoachCatalogDemo()) {
    return NextResponse.json({
      demoMode: false,
      durable: snapshot.databaseConfigured,
      blobWritable: true,
      catalogStorage: "database",
      ...snapshot,
      message: snapshot.databaseConfigured
        ? "Catalog and workouts save to Postgres. Per-store blob migration phase is in `migration`."
        : "Postgres is not configured — catalog uses demo file storage.",
    });
  }

  return NextResponse.json({
    demoMode: true,
    catalogStorage: "demo",
    ...snapshot,
    ...(await demoPersistenceHealth()),
  });
}