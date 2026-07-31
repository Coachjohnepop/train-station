import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import {
  isAllowedMeasurementPhotoUrl,
  MEASUREMENT_PHOTO_MAX_BYTES,
  storeMeasurementPhoto,
  validateMeasurementPhoto,
} from "@/lib/measurement-photo-storage";
import { setMemberBeforePhotoUrl } from "@/lib/measurements-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** App Router: allow larger multipart bodies for mobile photos (still compress client-side). */
export const runtime = "nodejs";

/**
 * Upload a measurements portrait.
 * - kind=before → saves baseline “before” on member profile (DB URL + Blob file)
 * - kind=now → returns URL only (attach via photoUrl on POST /measurements)
 *
 * Mobile: client compresses first. Server accepts JPEG/PNG/WebP/HEIC.
 */
export async function POST(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const kindRaw = String(form.get("kind") || "now").toLowerCase();
    const kind = kindRaw === "before" ? "before" : "now";

    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      return NextResponse.json(
        { error: "No photo received. Take a photo or choose one from your library." },
        { status: 400 },
      );
    }

    const blob = file as Blob & { name?: string; type?: string; size: number };
    const name =
      typeof blob.name === "string" && blob.name.trim()
        ? blob.name.trim()
        : "photo.jpg";
    // Mobile Safari often sends empty type — sniff from name, default JPEG after client compress
    let mime = (blob.type || "").trim().toLowerCase();
    if (!mime || mime === "application/octet-stream") {
      if (/\.png$/i.test(name)) mime = "image/png";
      else if (/\.webp$/i.test(name)) mime = "image/webp";
      else if (/\.heic$/i.test(name) || /\.heif$/i.test(name)) mime = "image/heic";
      else mime = "image/jpeg";
    }
    const size = typeof blob.size === "number" ? blob.size : 0;

    validateMeasurementPhoto({ size, mimeType: mime, name });

    if (size > MEASUREMENT_PHOTO_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Photo too large (${Math.round(size / 1024 / 1024)} MB). Max ${Math.round(MEASUREMENT_PHOTO_MAX_BYTES / 1024 / 1024)} MB after compress.`,
        },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Empty photo file." }, { status: 400 });
    }
    // Magic-byte sniff if client still lied about type
    if (
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      (mime === "image/heic" || mime === "application/octet-stream")
    ) {
      mime = "image/jpeg";
    }

    const stored = await storeMeasurementPhoto(
      buffer,
      mime,
      auth.session.id,
      kind,
      name,
    );

    if (!isAllowedMeasurementPhotoUrl(stored.url)) {
      console.error("[measurements/photo] rejected URL shape", stored.url);
      return NextResponse.json({ error: "Invalid photo URL returned from storage." }, { status: 500 });
    }

    if (kind === "before") {
      const beforePhotoUrl = await setMemberBeforePhotoUrl(auth.session.id, stored.url);
      return NextResponse.json({
        ok: true,
        kind: "before",
        url: stored.url,
        beforePhotoUrl: beforePhotoUrl || stored.url,
        persisted: true,
      });
    }

    return NextResponse.json({
      ok: true,
      kind: "now",
      url: stored.url,
      photoUrl: stored.url,
      persisted: false,
      hint: "Call Save check-in to store this photo on your measurement log.",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    console.error("[measurements/photo]", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
