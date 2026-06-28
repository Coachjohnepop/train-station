import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { processAndStoreBrandLogo } from "@/lib/brand-asset-storage";
import { resolveSiteBrand } from "@/lib/site-brand";
import { saveSiteBrand } from "@/lib/site-brand-store";

export const dynamic = "force-dynamic";

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const assets = await processAndStoreBrandLogo(buffer, file.type || "image/png");
    const config = await saveSiteBrand({
      ...assets,
      logoTransform: { scale: 1, rotation: 0, offsetX: 0, offsetY: 0, cropInset: 0 },
    });
    const brand = resolveSiteBrand(config);

    return NextResponse.json({
      ok: true,
      ...brand,
      logoTransform: config.logoTransform,
      storedLogoUrl: config.logoUrl,
      storedLogoIconUrl: config.logoIconUrl,
      storedFaviconUrl: config.faviconUrl,
      storedLogoSourceUrl: config.logoSourceUrl,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}