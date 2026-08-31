/** Coach intro / per-ticket clips stored on Blob (or local uploads). */
export const SITE_VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const SITE_VIDEO_ALLOWED_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/hevc",
  "video/h264",
]);

/** iPhone Photos often omits a MIME type or sends octet-stream. */
export const SITE_VIDEO_CLIENT_ACCEPT =
  "video/*,.mp4,.mov,.m4v,.webm,video/quicktime,video/mp4";

export const SITE_VIDEO_UPLOAD_CONTENT_TYPES = [
  "video/*",
  "application/octet-stream",
  ...Array.from(SITE_VIDEO_ALLOWED_MIME),
];

const STORED_PATH_PREFIX = "/uploads/site-videos/";
const BLOB_HOST_RE = /\.public\.blob\.vercel-storage\.com$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v)(?:$|\?)/i;

/**
 * True for coach-uploaded site intro files (Vercel Blob public URLs or local uploads).
 */
export function isStoredSiteVideoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const trimmed = url.trim();

  if (trimmed.startsWith(STORED_PATH_PREFIX)) return true;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (BLOB_HOST_RE.test(parsed.hostname)) return true;
    // Explicit site-videos path on any host (custom CDN / future).
    if (parsed.pathname.includes("/site-videos/")) return true;
    return false;
  } catch {
    return false;
  }
}

/** Direct file URL that can play in an HTML5 video element. */
export function isDirectVideoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  if (isStoredSiteVideoUrl(url)) return true;
  const trimmed = url.trim();
  if (VIDEO_EXT_RE.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return trimmed.startsWith("/");
    }
  }
  return false;
}

/**
 * Coach intro + per-ticket-class slots: site file only (public/videos,
 * Blob upload, or another direct MP4/WebM/MOV). YouTube is not allowed.
 */
export function isAllowedCoachIntroVideoUrl(url: string | null | undefined): boolean {
  return isDirectVideoUrl(url);
}

export function siteVideoMimeFromName(name: string, fallback = "video/mp4"): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return fallback;
}

/** MIME the Blob client should send — iPhone Camera/Photos often leave file.type empty. */
export function clientSiteVideoMime(file: { name: string; type?: string }): string {
  const raw = (file.type || "").trim().toLowerCase();
  if (raw && SITE_VIDEO_ALLOWED_MIME.has(raw)) return raw;
  const fromName = siteVideoMimeFromName(file.name, "");
  if (fromName) return fromName;
  if (raw.startsWith("video/")) return raw;
  return "video/mp4";
}

export function siteVideoExtFromMime(mimeType: string): string {
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/x-m4v") return "m4v";
  return "mp4";
}

export function validateSiteVideoFile(params: { size: number; mimeType: string; name?: string }) {
  const mime =
    params.mimeType && SITE_VIDEO_ALLOWED_MIME.has(params.mimeType)
      ? params.mimeType
      : params.name
        ? siteVideoMimeFromName(params.name, params.mimeType)
        : params.mimeType;

  if (!SITE_VIDEO_ALLOWED_MIME.has(mime) && !params.name?.match(/\.(mp4|webm|mov|m4v)$/i)) {
    throw new Error("Unsupported video type — use MP4, WebM, or MOV.");
  }
  if (params.size > SITE_VIDEO_MAX_BYTES) {
    const mb = Math.round(SITE_VIDEO_MAX_BYTES / (1024 * 1024));
    throw new Error(`Video too large (max ${mb} MB). Compress or use a shorter clip.`);
  }
}
