/**
 * Browser-side image compress for mobile camera uploads (HEIC/large JPEG).
 * Targets under Vercel serverless body limits (~4.5MB) with headroom.
 */

const MAX_EDGE = 1600;
const MAX_BYTES = 2.5 * 1024 * 1024;
const JPEG_QUALITY_START = 0.85;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo. Try another image or take it again."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Could not compress photo."));
        else resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Resize + JPEG-compress a user photo for upload.
 * Returns a File ready for FormData (always image/jpeg).
 */
export async function compressImageForUpload(
  file: File,
  opts?: { maxEdge?: number; maxBytes?: number },
): Promise<File> {
  const maxEdge = opts?.maxEdge ?? MAX_EDGE;
  const maxBytes = opts?.maxBytes ?? MAX_BYTES;

  // Already small enough JPEG/PNG — still re-encode if > maxBytes or weird mobile types
  const needsWork =
    file.size > maxBytes ||
    !file.type ||
    /heic|heif|tiff|image\/$/i.test(file.type) ||
    file.size > 1.5 * 1024 * 1024;

  if (!needsWork && (file.type === "image/jpeg" || file.type === "image/jpg")) {
    return file;
  }

  let img: HTMLImageElement;
  try {
    img = await loadImageFromFile(file);
  } catch {
    // HEIC may fail to decode in some browsers — send raw and hope server accepts
    if (file.size <= maxBytes) return file;
    throw new Error(
      "This phone photo format is hard to process in the browser. Try Photo Library → JPEG, or a smaller image.",
    );
  }

  let { width, height } = img;
  if (width < 1 || height < 1) {
    throw new Error("Invalid photo dimensions.");
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process photo.");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = JPEG_QUALITY_START;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > maxBytes && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }

  if (blob.size > maxBytes) {
    // One more shrink
    const s2 = Math.sqrt(maxBytes / blob.size) * 0.9;
    canvas.width = Math.max(1, Math.round(width * s2));
    canvas.height = Math.max(1, Math.round(height * s2));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    blob = await canvasToBlob(canvas, 0.75);
  }

  if (blob.size > maxBytes) {
    throw new Error("Photo is still too large after compress. Try a lower-resolution shot.");
  }

  const base =
    (file.name || "photo").replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
