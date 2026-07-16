import { NextResponse } from "next/server";
import {
  fetchFirstWorkingImage,
  isAllowedEquipmentImageHost,
  resolveEquipmentImageCandidates,
} from "@/lib/equipment-image";
import { isDemoMode, listDemoEquipmentCatalog } from "@/lib/demo-equipment";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Same-origin product photo proxy.
 * Browsers often block Amazon hotlinks; we fetch server-side and stream.
 *
 * ?id=equipmentId  — resolve from catalog (imageUrl + product ASIN fallbacks)
 * ?url=https://…   — allowlisted host only (admin preview before save)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  const rawUrl = searchParams.get("url")?.trim();

  let candidates: string[] = [];

  if (id) {
    let imageUrl: string | null = null;
    let productUrl: string | null = null;
    if (isDemoMode()) {
      const items = await listDemoEquipmentCatalog();
      const item = items.find((row) => row.id === id);
      if (!item) return new NextResponse("Not found", { status: 404 });
      imageUrl = item.imageUrl ?? null;
      productUrl = item.productUrl ?? null;
    } else {
      const item = await prisma.equipment.findUnique({
        where: { id },
        select: { imageUrl: true, productUrl: true },
      });
      if (!item) return new NextResponse("Not found", { status: 404 });
      imageUrl = item.imageUrl;
      productUrl = item.productUrl;
    }
    candidates = resolveEquipmentImageCandidates(imageUrl, productUrl);
  } else if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return new NextResponse("Invalid URL", { status: 400 });
      }
      // Free-form URL must be Amazon/CDN (or known shop host) — not an open proxy.
      if (!isAllowedEquipmentImageHost(u.hostname) && !/amazon\./i.test(u.hostname)) {
        return new NextResponse("Host not allowed", { status: 400 });
      }
      // Product page URL → ASIN photo candidates; direct image URL tried first.
      candidates = resolveEquipmentImageCandidates(rawUrl, rawUrl);
    } catch {
      return new NextResponse("Invalid URL", { status: 400 });
    }
  } else {
    return new NextResponse("Missing id or url", { status: 400 });
  }

  if (candidates.length === 0) {
    return new NextResponse("No image", { status: 404 });
  }

  // Catalog ?id= may use any stored image host; free-form ?url= stays on allowlisted CDNs.
  const image = await fetchFirstWorkingImage(candidates, {
    strictHostAllowlist: !id,
  });
  if (!image) {
    return new NextResponse("Image unavailable", { status: 404 });
  }

  return new NextResponse(image.body, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Equipment-Image-Source": image.sourceUrl.slice(0, 200),
    },
  });
}
