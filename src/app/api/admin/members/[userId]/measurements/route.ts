import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { isDatabaseConfigured } from "@/lib/database-config";
import {
  createUserMeasurement,
  deleteUserMeasurement,
  getMemberBeforePhotoUrl,
  listUserMeasurements,
} from "@/lib/measurements-store";
import { awardMeasurementCheckInPoints } from "@/lib/member-gamification-store";
import { localTodayIso } from "@/lib/program-calendar";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;
  if (!userId?.trim()) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const limit = Math.min(
    100,
    Math.max(1, Number(new URL(request.url).searchParams.get("limit") || "40")),
  );

  try {
    const uid = userId.trim();
    const [measurements, beforePhotoUrl] = await Promise.all([
      listUserMeasurements(uid, limit),
      getMemberBeforePhotoUrl(uid),
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

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;
  if (!userId?.trim()) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const measurement = await createUserMeasurement({
      userId: userId.trim(),
      body,
      source: "coach",
      recordedByUserId: auth.session.id,
    });
    let gamification = { awarded: false, pointsEarned: 0, totalPoints: 0 };
    try {
      gamification = await awardMeasurementCheckInPoints({
        userId: userId.trim(),
        dayIso: localTodayIso(),
      });
    } catch (e) {
      console.warn("Measurement points award failed", e);
    }
    return NextResponse.json({
      ok: true,
      measurement,
      pointsEarned: gamification.pointsEarned,
      totalPoints: gamification.totalPoints,
      awarded: gamification.awarded,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not save measurement.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;
  const id = new URL(request.url).searchParams.get("id")?.trim() || "";
  if (!userId?.trim() || !id) {
    return NextResponse.json({ error: "userId and id are required." }, { status: 400 });
  }

  try {
    const ok = await deleteUserMeasurement({ id, userId: userId.trim() });
    if (!ok) {
      return NextResponse.json({ error: "Measurement not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
