import { NextResponse } from "next/server";
import { resolveSiteBrand } from "@/lib/site-brand";
import { getSiteBrand } from "@/lib/site-brand-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getSiteBrand();
  const brand = resolveSiteBrand(config);
  return NextResponse.json(brand);
}