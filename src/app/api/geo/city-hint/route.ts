import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { cityHintFromCoordinates, cityHintFromRequest } from "@/lib/geo-city-hint";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  const hint =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? await cityHintFromCoordinates(lat, lng)
      : await cityHintFromRequest(request);

  if (!hint) {
    return NextResponse.json({ city: null, state: null, source: "none" });
  }

  return NextResponse.json(hint, {
    headers: { "Cache-Control": "private, no-store" },
  });
}