"use client";

import { useEffect } from "react";
import {
  THEME_MODE_STORAGE_KEY,
  type MembershipThemeTier,
  type ThemeMode,
} from "@/lib/membership-theme";

export default function ThemeAttributesSync({
  membershipTier = "explorer",
}: {
  membershipTier?: MembershipThemeTier;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    const mode: ThemeMode = stored === "light" ? "light" : "dark";
    root.setAttribute("data-theme-mode", mode);
    root.setAttribute("data-membership-tier", membershipTier);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_MODE_STORAGE_KEY) return;
      const next: ThemeMode = event.newValue === "light" ? "light" : "dark";
      root.setAttribute("data-theme-mode", next);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [membershipTier]);

  return null;
}