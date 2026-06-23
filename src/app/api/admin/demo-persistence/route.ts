import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-exercises";
import { demoPersistenceHealth } from "@/lib/demo-persistence";

export async function GET() {
  if (!isDemoMode()) {
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