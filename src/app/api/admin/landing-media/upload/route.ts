import { NextResponse } from "next/server";
import {
  generateClientTokenFromReadWriteToken,
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  BLOB_TOKEN,
  blobSdkOptionVariants,
  isBlobConfigured,
} from "@/lib/demo-json-blob";
import {
  SITE_VIDEO_MAX_BYTES,
  SITE_VIDEO_UPLOAD_CONTENT_TYPES,
  siteVideoExtFromMime,
  siteVideoMimeFromName,
  validateSiteVideoFile,
} from "@/lib/site-video";
import { storeSiteVideo } from "@/lib/site-video-storage";

export const dynamic = "force-dynamic";
/** Large coach intros — client upload is preferred; keep headroom for server fallback. */
export const maxDuration = 120;

const TOKEN_TTL_MS = 60 * 60 * 1000;

function assertSiteVideoPath(pathname: string) {
  if (!pathname.startsWith("site-videos/")) {
    throw new Error("Invalid upload path.");
  }
}

async function issueClientToken(pathname: string): Promise<string> {
  assertSiteVideoPath(pathname);
  const constraints = {
    pathname,
    allowedContentTypes: SITE_VIDEO_UPLOAD_CONTENT_TYPES,
    maximumSizeInBytes: SITE_VIDEO_MAX_BYTES,
    addRandomSuffix: false,
    allowOverwrite: true,
    validUntil: Date.now() + TOKEN_TTL_MS,
  };
  let lastError: unknown;
  for (const auth of blobSdkOptionVariants()) {
    try {
      return await generateClientTokenFromReadWriteToken({
        ...constraints,
        ...auth,
      });
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not start cloud upload. Retry on Wi-Fi.");
}

/**
 * Coach intro / per-ticket video upload.
 *
 * - JSON body → Vercel Blob client-upload token (OIDC first, then static token).
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
      if (body.type === "blob.generate-client-token") {
        const clientToken = await issueClientToken(body.payload.pathname);
        return NextResponse.json({
          type: "blob.generate-client-token",
          clientToken,
        });
      }
      if (body.type === "blob.upload-completed") {
        // Client already has the URL. Do not require a session-gated webhook.
        return NextResponse.json({ type: "blob.upload-completed", response: "ok" });
      }

      // Older Blob client versions still POST handleUpload shapes.
      const jsonResponse = await handleUpload({
        body,
        request,
        ...(BLOB_TOKEN ? { token: BLOB_TOKEN } : {}),
        onBeforeGenerateToken: async (pathname) => {
          assertSiteVideoPath(pathname);
          return {
            allowedContentTypes: SITE_VIDEO_UPLOAD_CONTENT_TYPES,
            maximumSizeInBytes: SITE_VIDEO_MAX_BYTES,
            addRandomSuffix: false,
            allowOverwrite: true,
            validUntil: Date.now() + TOKEN_TTL_MS,
          };
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
    allowedMime: SITE_VIDEO_UPLOAD_CONTENT_TYPES,
    clientUpload: isBlobConfigured(),
    suggestedPath: `site-videos/${crypto.randomUUID()}.mp4`,
    extForMime: {
      "video/mp4": siteVideoExtFromMime("video/mp4"),
      "video/webm": siteVideoExtFromMime("video/webm"),
      "video/quicktime": siteVideoExtFromMime("video/quicktime"),
    },
  });
}
