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
  HERO_IMAGE_MAX_BYTES,
  HERO_VIDEO_MAX_BYTES,
  isHeroVideoSrc,
} from "@/lib/hero-slides";
import { storeHeroBuffer, storeHeroImage, validateHeroImageFile } from "@/lib/hero-image-storage";
import {
  SITE_VIDEO_UPLOAD_CONTENT_TYPES,
  clientSiteVideoMime,
  siteVideoExtFromMime,
  validateSiteVideoFile,
} from "@/lib/site-video";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TOKEN_TTL_MS = 60 * 60 * 1000;

function assertHeroPath(pathname: string) {
  if (!pathname.startsWith("hero/")) {
    throw new Error("Invalid upload path.");
  }
}

async function issueClientToken(pathname: string): Promise<string> {
  assertHeroPath(pathname);
  const isVideo = isHeroVideoSrc(pathname);
  const constraints = {
    pathname,
    allowedContentTypes: isVideo
      ? SITE_VIDEO_UPLOAD_CONTENT_TYPES
      : ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/*"],
    maximumSizeInBytes: isVideo ? HERO_VIDEO_MAX_BYTES : HERO_IMAGE_MAX_BYTES,
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
 * Landing hero carousel upload (JPEG/PNG/WebP or MP4/MOV).
 * JSON body → Blob client-upload token for large videos.
 * FormData `file` → server put (images, or small files under ~4.5 MB).
 */
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    if (!isBlobConfigured()) {
      return NextResponse.json(
        {
          error:
            "Blob storage is not configured. Use a smaller file, or set BLOB_READ_WRITE_TOKEN on Vercel.",
        },
        { status: 503 },
      );
    }
    try {
      const body = (await request.json()) as HandleUploadBody;
      if (body.type === "blob.generate-client-token") {
        const clientToken = await issueClientToken(body.payload.pathname);
        return NextResponse.json({ type: "blob.generate-client-token", clientToken });
      }
      if (body.type === "blob.upload-completed") {
        return NextResponse.json({ type: "blob.upload-completed", response: "ok" });
      }
      const jsonResponse = await handleUpload({
        body,
        request,
        ...(BLOB_TOKEN ? { token: BLOB_TOKEN } : {}),
        onBeforeGenerateToken: async (pathname) => {
          assertHeroPath(pathname);
          const isVideo = isHeroVideoSrc(pathname);
          return {
            allowedContentTypes: isVideo
              ? SITE_VIDEO_UPLOAD_CONTENT_TYPES
              : ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/*"],
            maximumSizeInBytes: isVideo ? HERO_VIDEO_MAX_BYTES : HERO_IMAGE_MAX_BYTES,
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

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const video = isHeroVideoSrc(file.name) || file.type.startsWith("video/");
    if (video) {
      const mime = clientSiteVideoMime(file);
      validateSiteVideoFile({ size: file.size, mimeType: mime, name: file.name });
      if (file.size > HERO_VIDEO_MAX_BYTES) {
        throw new Error(
          `Video too large (max ${Math.round(HERO_VIDEO_MAX_BYTES / 1024 / 1024)} MB). Trim or export 1080p.`,
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = siteVideoExtFromMime(mime);
      const url = await storeHeroBuffer(`hero/${crypto.randomUUID()}.${ext}`, buffer, mime);
      return NextResponse.json({ ok: true, url, kind: "video" });
    }

    const mime = file.type || "image/jpeg";
    validateHeroImageFile({ size: file.size, mimeType: mime, name: file.name });
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeHeroImage(buffer, mime, file.name);
    return NextResponse.json({
      ok: true,
      url: stored.url,
      kind: "image",
      maxBytes: HERO_IMAGE_MAX_BYTES,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    imageMaxBytes: HERO_IMAGE_MAX_BYTES,
    videoMaxBytes: HERO_VIDEO_MAX_BYTES,
    clientUpload: isBlobConfigured(),
  });
}
