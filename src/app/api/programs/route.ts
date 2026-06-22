import { NextResponse } from "next/server";
import { listPrograms } from "@/lib/program-data";
import { filterMemberCatalogPrograms } from "@/lib/programs";

export async function GET() {
  const programs = filterMemberCatalogPrograms(await listPrograms());
  return NextResponse.json(programs);
}