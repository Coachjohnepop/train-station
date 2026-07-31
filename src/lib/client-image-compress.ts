/**
 * Browser-side image compress for mobile camera uploads (HEIC/large JPEG).
 * Always prefers JPEG under ~2MB so Safari can display and Vercel accepts the body.
 */

const MAX_EDGE = 1400;
const MAX_BYTES = 2 * 1024 * 1024;
const JPEG_QUALITY_START = 0.82;

async function loadImageFromFile(file: File): Promise<CanvasImageSource> {
  // Prefer createImageBitmap — better EXIF orientation on mobile Safari/Chrome
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
      return bitmap;
    } catch {
      /* fall through to Image() */
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo in the browser."));
    };
    (img as HTMLImageElement & { decoding?: string }).decoding = "async";
    img.src = url;
  });
}

function sourceSize(src: CanvasImageSource): { width: number; height: number } {
  if (src instanceof HTMLImageElement) {
    return { width: src.naturalWidth || src.width, height: src.naturalHeight || src.height };
  }
  if (typeof ImageBitmap !== "undefined" && src instanceof ImageBitmap) {
    return { width: src.width, height: src.height };
  }
  // HTMLCanvasElement / OffscreenCanvas
  const anySrc = src as { width?: number; height?: number };
  return { width: Number(anySrc.width) || 0, height: Number(anySrc.height) || 0 };
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
 * Prefer always converting so iPhone HEIC becomes a displayable JPEG.
 */
export async function compressImageForUpload(
  file: File,
  opts?: { maxEdge?: number; maxBytes?: number },
): Promise<File> {
  const maxEdge = opts?.maxEdge ?? MAX_EDGE;
  const maxBytes = opts?.maxBytes ?? MAX_BYTES;

  // Tiny JPEGs already fine
  if (
    file.size > 0 &&
    file.size <= 400 * 1024 &&
    (file.type === "image/jpeg" || file.type === "image/jpg")
  ) {
    return file;
  }

  let img: CanvasImageSource;
  try {
    img = await loadImageFromFile(file);
  } catch {
    if (file.size > 0 && file.size <= maxBytes) {
      // Last resort: send as-is (server may store HEIC; iOS can still show it)
      return file;
    }
    throw new Error(
      "Could not process this photo. Use Library and pick a JPEG, or take a new photo.",
    );
  }

  let { width, height } = sourceSize(img);
  if (width < 1 || height < 1) {
    if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) img.close();
    throw new Error("Invalid photo dimensions.");
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) img.close();
    throw new Error("Could not process photo.");
  }
  // White background (avoids black transparency for PNG→JPEG)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = JPEG_QUALITY_START;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }

  if (blob.size > maxBytes) {
    const s2 = Math.sqrt(maxBytes / blob.size) * 0.85;
    canvas.width = Math.max(1, Math.round(width * s2));
    canvas.height = Math.max(1, Math.round(height * s2));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    blob = await canvasToBlob(canvas, 0.7);
  }

  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) {
    img.close();
  }

  if (blob.size > maxBytes) {
    throw new Error("Photo is still too large after compress. Try a lower-resolution shot.");
  }

  const base =
    (file.name || "photo").replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
