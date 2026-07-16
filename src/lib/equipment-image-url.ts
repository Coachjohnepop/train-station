/**
 * Client-safe helpers for equipment product images.
 * (Proxy fetch lives in equipment-image.ts — server only.)
 */

/** Same-origin img src so Amazon hotlink blocks don't blank the Gear grid. */
export function equipmentImageProxyPath(opts: {
  equipmentId?: string | null;
  imageUrl?: string | null;
}): string | null {
  if (opts.equipmentId?.trim()) {
    return `/api/equipment/image?id=${encodeURIComponent(opts.equipmentId.trim())}`;
  }
  if (opts.imageUrl?.trim()) {
    return `/api/equipment/image?url=${encodeURIComponent(opts.imageUrl.trim())}`;
  }
  return null;
}
