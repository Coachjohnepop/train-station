import { NextResponse } from "next/server";
import { listPrograms } from "@/lib/program-data";

export async function GET() {
  const programs = await listPrograms();
  return NextResponse.json(programs);
}