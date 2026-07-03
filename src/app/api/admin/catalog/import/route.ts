import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import {
  importCatalogSnapshot,
  loadCatalogSnapshotFromDemoSources,
} from "@/lib/import-catalog-snapshot";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  if (isCoachCatalogDemo()) {
    return NextResponse.json(
      {
        error: "Catalog import requires a real DATABASE_URL (not dummy).",
        skipped: true,
      },
      { status: 409 },
    );
  }

  const { snapshot, source } = await loadCatalogSnapshotFromDemoSources();
  const { prisma } = await import("@/lib/prisma");
  const result = await importCatalogSnapshot(prisma, snapshot, source);

  return NextResponse.json({
    ok: true,
    importedAt: new Date().toISOString(),
    ...result,
  });
}