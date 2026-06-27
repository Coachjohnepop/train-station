"use client";

import { createContext, useContext } from "react";
import type { ResolvedSiteBrand } from "@/lib/site-brand";

const SiteBrandContext = createContext<ResolvedSiteBrand | null>(null);

export function SiteBrandProvider({
  brand,
  children,
}: {
  brand: ResolvedSiteBrand;
  children: React.ReactNode;
}) {
  return (
    <SiteBrandContext.Provider value={brand}>{children}</SiteBrandContext.Provider>
  );
}

export function useSiteBrand(): ResolvedSiteBrand | null {
  return useContext(SiteBrandContext);
}