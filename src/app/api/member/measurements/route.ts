import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { isDatabaseConfigured } from "@/lib/database-config";
import {
  createUserMeasurement,
  getMeasurementSheetIdentity,
  listUserMeasurements,
  saveMeasurementSheetIdentity,
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
    const [measurements, identity] = await Promise.all([
      listUserMeasurements(auth.session.id, limit),
      getMeasurementSheetIdentity(auth.session.id),
    ]);
    return NextResponse.json({
      ok: true,
      measurements,
      beforePhotoUrl: identity.beforePhotoUrl,
      identity: {
        name: identity.name,
        ageYears: identity.ageYears,
        gender: identity.gender,
      },
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

    // Optional identity fields on the same save (name / age / gender).
    if (
      body.name !== undefined ||
      body.ageYears !== undefined ||
      body.gender !== undefined
    ) {
      await saveMeasurementSheetIdentity(auth.session.id, {
        name: body.name === undefined ? undefined : (body.name as string | null),
        ageYears:
          body.ageYears === undefined
            ? undefined
            : body.ageYears === null || body.ageYears === ""
              ? null
              : Number(body.ageYears),
        gender: body.gender === undefined ? undefined : (body.gender as string | null),
      });
    }

    const measurement = await createUserMeasurement({
      userId: auth.session.id,
      body,
      source: "member",
      recordedByUserId: auth.session.id,
    });
    const identity = await getMeasurementSheetIdentity(auth.session.id);
    return NextResponse.json({
      ok: true,
      measurement,
      identity: {
        name: identity.name,
        ageYears: identity.ageYears,
        gender: identity.gender,
      },
      beforePhotoUrl: identity.beforePhotoUrl,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not save measurement.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
