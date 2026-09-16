import "server-only";

import { resolveSiteBrand } from "@/lib/site-brand";
import { getSiteBrand } from "@/lib/site-brand-store";
import { DEFAULT_LOGO_TRANSFORM } from "@/lib/logo-transform";

export async function getResolvedSiteBrand() {
  try {
    const config = await getSiteBrand();
    return resolveSiteBrand(config);
  } catch (e) {
    console.error("[site-brand]", e instanceof Error ? e.message : e);
    return resolveSiteBrand({
      brandName: "",
      brandTagline: "",
      logoUrl: null,
      logoIconUrl: null,
      faviconUrl: null,
      logoSourceUrl: null,
      logoTransform: { ...DEFAULT_LOGO_TRANSFORM },
      updatedAt: new Date().toISOString(),
    });
  }
}