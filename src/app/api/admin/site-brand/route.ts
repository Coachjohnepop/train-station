import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { resolveSiteBrand } from "@/lib/site-brand";
import { getSiteBrand, saveSiteBrand } from "@/lib/site-brand-store";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  brandName: z.string().max(80).optional(),
  brandTagline: z.string().max(200).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  logoIconUrl: z.string().max(500).nullable().optional(),
  faviconUrl: z.string().max(500).nullable().optional(),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

function formatResponse(config: Awaited<ReturnType<typeof getSiteBrand>>) {
  const resolved = resolveSiteBrand(config);
  return {
    ...resolved,
    storedBrandName: config.brandName,
    storedBrandTagline: config.brandTagline,
    storedLogoUrl: config.logoUrl,
    storedLogoIconUrl: config.logoIconUrl,
    storedFaviconUrl: config.faviconUrl,
  };
}

export async function GET() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }
  const config = await getSiteBrand();
  return NextResponse.json(formatResponse(config));
}

export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const config = await saveSiteBrand(parsed.data);
    return NextResponse.json(formatResponse(config));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}