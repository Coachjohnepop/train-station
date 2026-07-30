"use client";

import { useEffect, useState } from "react";
import {
  clampVolumeDb,
  DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
} from "@/lib/media-volume";

/**
 * Loads Admin → Videos volume offset for uploaded intros (relative dB from native).
 */
export function useUploadedContentVolumeDb(
  initial?: number | null,
): number {
  const [db, setDb] = useState(() =>
    clampVolumeDb(
      initial ?? DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
      DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
    ),
  );

  useEffect(() => {
    if (initial != null && Number.isFinite(initial)) {
      setDb(clampVolumeDb(initial, DEFAULT_UPLOADED_CONTENT_VOLUME_DB));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/landing-media", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { uploadedContentVolumeDb?: number };
        if (cancelled) return;
        if (body.uploadedContentVolumeDb != null) {
          setDb(
            clampVolumeDb(
              body.uploadedContentVolumeDb,
              DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
            ),
          );
        }
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return db;
}
