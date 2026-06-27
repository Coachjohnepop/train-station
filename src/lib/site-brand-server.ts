import "server-only";

import { resolveSiteBrand } from "@/lib/site-brand";
import { getSiteBrand } from "@/lib/site-brand-store";

export async function getResolvedSiteBrand() {
  const config = await getSiteBrand();
  return resolveSiteBrand(config);
}