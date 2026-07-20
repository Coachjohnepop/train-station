import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/web-push";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "Push not configured", configured: false },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { publicKey, configured: true },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
