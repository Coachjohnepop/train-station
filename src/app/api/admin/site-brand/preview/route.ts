import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { fetchBrandSourceBuffer } from "@/lib/brand-asset-storage";
import { applyLogoTransform } from "@/lib/optimize-brand-logo";
import { normalizeLogoTransform } from "@/lib/logo-transform";
import { getSiteBrand } from "@/lib/site-brand-store";

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
    const preview = await applyLogoTransform(sourceBuffer, transform, 480);
    const dataUrl = `data:image/png;base64,${preview.toString("base64")}`;

    return NextResponse.json({ ok: true, previewUrl: dataUrl, logoTransform: transform });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}