import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { BLOB_TOKEN, isBlobConfigured } from "@/lib/demo-json-blob";
import {
  SITE_VIDEO_ALLOWED_MIME,
  SITE_VIDEO_MAX_BYTES,
  siteVideoExtFromMime,
  siteVideoMimeFromName,
  validateSiteVideoFile,
} from "@/lib/site-video";
import { storeSiteVideo } from "@/lib/site-video-storage";

export const dynamic = "force-dynamic";
/** Large coach intros — client upload is preferred; keep headroom for server fallback. */
export const maxDuration = 120;

/**
 * Coach intro / per-ticket video upload.
 *
 * - JSON body → Vercel Blob client-upload token flow (`handleUpload`) for files up to 200 MB.
 * - FormData `file` → server put (local dev or small files under ~4.5 MB on Vercel).
 */
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  // Client → Blob direct upload (token handshake)
  if (contentType.includes("application/json")) {
    if (!isBlobConfigured()) {
      return NextResponse.json(
        {
          error:
            "Blob storage is not configured. Use a smaller file in local mode, or set BLOB_READ_WRITE_TOKEN on Vercel.",
        },
        { status: 503 },
      );
    }

    try {
      const body = (await request.json()) as HandleUploadBody;
      const jsonResponse = await handleUpload({
        body,
        request,
        token: BLOB_TOKEN,
        onBeforeGenerateToken: async (pathname) => {
          // Only allow site-videos/* paths from our client.
          if (!pathname.startsWith("site-videos/")) {
            throw new Error("Invalid upload path.");
          }
          return {
            allowedContentTypes: Array.from(SITE_VIDEO_ALLOWED_MIME),
            maximumSizeInBytes: SITE_VIDEO_MAX_BYTES,
            addRandomSuffix: false,
            allowOverwrite: true,
            tokenPayload: JSON.stringify({ coachId: session.id }),
          };
        },
        onUploadCompleted: async () => {
          // URL is applied client-side into landing-media on Save.
        },
      });
      return NextResponse.json(jsonResponse);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload token failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // FormData server upload (local / small files)
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const mime = file.type || siteVideoMimeFromName(file.name);
    validateSiteVideoFile({ size: file.size, mimeType: mime, name: file.name });
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeSiteVideo(buffer, mime, file.name);
    return NextResponse.json({ ok: true, url: stored.url, kind: "video" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Helper for clients that need a suggested blob pathname before upload(). */
export async function GET() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    maxBytes: SITE_VIDEO_MAX_BYTES,
    allowedMime: Array.from(SITE_VIDEO_ALLOWED_MIME),
    clientUpload: isBlobConfigured(),
    suggestedPath: `site-videos/${crypto.randomUUID()}.mp4`,
    extForMime: {
      "video/mp4": siteVideoExtFromMime("video/mp4"),
      "video/webm": siteVideoExtFromMime("video/webm"),
      "video/quicktime": siteVideoExtFromMime("video/quicktime"),
    },
  });
}
