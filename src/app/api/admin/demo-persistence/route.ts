import { NextResponse } from "next/server";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { demoPersistenceHealth } from "@/lib/demo-persistence";

export async function GET() {
  if (!isCoachCatalogDemo()) {
    return NextResponse.json({
      demoMode: false,
      durable: true,
      blobWritable: true,
      message: "Using database — edits persist automatically.",
    });
  }

  return NextResponse.json({
    demoMode: true,
    ...(await demoPersistenceHealth()),
  });
}