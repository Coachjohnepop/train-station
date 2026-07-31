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
      beforePhotoCrop: {
        focusX: identity.beforePhotoFocusX ?? 50,
        focusY: identity.beforePhotoFocusY ?? 25,
        zoom: identity.beforePhotoZoom ?? 1,
      },
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

/** Persist before-photo crop only (does not create a check-in). */
export async function PATCH(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      beforePhotoCrop?: { focusX?: number; focusY?: number; zoom?: number };
    };
    if (!body.beforePhotoCrop) {
      return NextResponse.json({ error: "beforePhotoCrop is required." }, { status: 400 });
    }
    const { setMemberBeforePhotoCrop } = await import("@/lib/measurements-store");
    await setMemberBeforePhotoCrop(auth.session.id, {
      focusX: Number(body.beforePhotoCrop.focusX ?? 50),
      focusY: Number(body.beforePhotoCrop.focusY ?? 25),
      zoom: Number(body.beforePhotoCrop.zoom ?? 1),
    });
    const identity = await getMeasurementSheetIdentity(auth.session.id);
    return NextResponse.json({
      ok: true,
      beforePhotoCrop: {
        focusX: identity.beforePhotoFocusX ?? 50,
        focusY: identity.beforePhotoFocusY ?? 25,
        zoom: identity.beforePhotoZoom ?? 1,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not save crop.";
    return NextResponse.json({ error: message }, { status: 400 });
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
      beforePhotoCrop: {
        focusX: identity.beforePhotoFocusX ?? 50,
        focusY: identity.beforePhotoFocusY ?? 25,
        zoom: identity.beforePhotoZoom ?? 1,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not save measurement.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
