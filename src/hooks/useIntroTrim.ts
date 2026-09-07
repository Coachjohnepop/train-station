"use client";

import { useEffect, useState } from "react";
import type { CoachIntroSlotId } from "@/lib/coach-intro-slots";
import {
  EMPTY_INTRO_TRIM,
  introTrimForSlot,
  normalizeIntroTrims,
  type IntroTrim,
  type IntroTrims,
} from "@/lib/intro-trim";

/**
 * Loads Admin → Videos trim window for one intro slot (members hear this cut).
 */
export function useIntroTrim(
  slotId: CoachIntroSlotId,
  initial?: IntroTrim | null,
): IntroTrim {
  const [trim, setTrim] = useState<IntroTrim>(() =>
    initial ? introTrimForSlot({ [slotId]: initial }, slotId) : { ...EMPTY_INTRO_TRIM },
  );

  useEffect(() => {
    if (initial) {
      setTrim(introTrimForSlot({ [slotId]: initial }, slotId));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/landing-media", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { introTrims?: IntroTrims };
        if (cancelled) return;
        setTrim(introTrimForSlot(normalizeIntroTrims(body.introTrims), slotId));
      } catch {
        /* keep default = full clip */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial, slotId]);

  return trim;
}
