import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-exercises";
import { demoPersistenceStatus } from "@/lib/demo-persistence";

export async function GET() {
  if (!isDemoMode()) {
    return NextResponse.json({
      demoMode: false,
      durable: true,
      message: "Using database — edits persist automatically.",
    });
  }

  return NextResponse.json({
    demoMode: true,
    ...demoPersistenceStatus(),
  });
}