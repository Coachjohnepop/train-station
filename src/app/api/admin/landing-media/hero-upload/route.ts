import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  HERO_IMAGE_MAX_BYTES,
  storeHeroImage,
  validateHeroImageFile,
} from "@/lib/hero-image-storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Upload a landing hero carousel image (JPEG/PNG/WebP…).
 * Returns a public URL — client assigns it to a slide and saves heroSlides.
 */
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const mime = file.type || "image/jpeg";
    validateHeroImageFile({ size: file.size, mimeType: mime, name: file.name });
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeHeroImage(buffer, mime, file.name);
    return NextResponse.json({
      ok: true,
      url: stored.url,
      maxBytes: HERO_IMAGE_MAX_BYTES,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
