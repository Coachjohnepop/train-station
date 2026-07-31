import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import {
  isAllowedMeasurementPhotoUrl,
  storeMeasurementPhoto,
  validateMeasurementPhoto,
} from "@/lib/measurement-photo-storage";
import { setMemberBeforePhotoUrl } from "@/lib/measurements-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Upload a measurements portrait.
 * - kind=before → saves baseline “before” on member profile
 * - kind=now → returns URL only (attach to check-in via photoUrl on POST /measurements)
 */
export async function POST(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const kindRaw = String(form.get("kind") || "now").toLowerCase();
    const kind = kindRaw === "before" ? "before" : "now";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const mime = file.type || "image/jpeg";
    validateMeasurementPhoto({ size: file.size, mimeType: mime, name: file.name });
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeMeasurementPhoto(buffer, mime, auth.session.id, kind);

    if (!isAllowedMeasurementPhotoUrl(stored.url)) {
      return NextResponse.json({ error: "Invalid photo URL returned." }, { status: 500 });
    }

    if (kind === "before") {
      const beforePhotoUrl = await setMemberBeforePhotoUrl(auth.session.id, stored.url);
      return NextResponse.json({
        ok: true,
        kind: "before",
        url: stored.url,
        beforePhotoUrl,
      });
    }

    return NextResponse.json({
      ok: true,
      kind: "now",
      url: stored.url,
      photoUrl: stored.url,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
