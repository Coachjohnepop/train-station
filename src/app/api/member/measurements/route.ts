import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { isDatabaseConfigured } from "@/lib/database-config";
import {
  createUserMeasurement,
  getMemberBeforePhotoUrl,
  listUserMeasurements,
} from "@/lib/measurements-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const limit = Math.min(
    100,
    Math.max(1, Number(new URL(request.url).searchParams.get("limit") || "40")),
  );

  try {
    const [measurements, beforePhotoUrl] = await Promise.all([
      listUserMeasurements(auth.session.id, limit),
      getMemberBeforePhotoUrl(auth.session.id),
    ]);
    return NextResponse.json({
      ok: true,
      measurements,
      beforePhotoUrl,
      databaseConfigured: isDatabaseConfigured(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load measurements.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const measurement = await createUserMeasurement({
      userId: auth.session.id,
      body,
      source: "member",
      recordedByUserId: auth.session.id,
    });
    return NextResponse.json({ ok: true, measurement });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not save measurement.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
