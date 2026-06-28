import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  fetchBrandSourceBuffer,
  renderBrandLogoFromSource,
} from "@/lib/brand-asset-storage";
import { normalizeLogoTransform } from "@/lib/logo-transform";
import { resolveSiteBrand } from "@/lib/site-brand";
import { getSiteBrand, saveSiteBrand } from "@/lib/site-brand-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  scale: z.number().min(0.4).max(2.5).optional(),
  rotation: z.number().min(-180).max(180).optional(),
  offsetX: z.number().min(-50).max(50).optional(),
  offsetY: z.number().min(-50).max(50).optional(),
  cropInset: z.number().min(0).max(45).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  try {
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
    }

    const config = await getSiteBrand();
    const sourceUrl = config.logoSourceUrl || "/images/logo-source.png";
    const sourceBuffer = await fetchBrandSourceBuffer(sourceUrl);
    const transform = normalizeLogoTransform(parsed.data);

    const assets = await renderBrandLogoFromSource(sourceBuffer, transform);
    const next = await saveSiteBrand({
      ...assets,
      logoTransform: transform,
      logoSourceUrl: config.logoSourceUrl || sourceUrl,
    });
    const brand = resolveSiteBrand(next);

    return NextResponse.json({
      ok: true,
      ...brand,
      logoTransform: next.logoTransform,
      storedLogoUrl: next.logoUrl,
      storedLogoIconUrl: next.logoIconUrl,
      storedFaviconUrl: next.faviconUrl,
      storedLogoSourceUrl: next.logoSourceUrl,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Render failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}