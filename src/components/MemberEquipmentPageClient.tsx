"use client";

import { useCallback, useState } from "react";
import EquipmentIntroModal, {
  EquipmentIntroWatchAgainButton,
} from "@/components/EquipmentIntroModal";
import MemberEquipmentShop from "@/components/MemberEquipmentShop";

export default function MemberEquipmentPageClient({
  equipmentIntroVideoUrl = null,
}: {
  equipmentIntroVideoUrl?: string | null;
}) {
  const [forceOpen, setForceOpen] = useState(false);
  const hasVideo = Boolean(equipmentIntroVideoUrl?.trim());

  const onForceHandled = useCallback(() => setForceOpen(false), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gear</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Coach-recommended equipment. Tap a photo to open the store in a{" "}
            <strong>new tab</strong> — this app stays open here. Mark what you already own so
            workouts can match your home setup.
          </p>
        </div>
        <EquipmentIntroWatchAgainButton
          hasVideo={hasVideo}
          onClick={() => setForceOpen(true)}
        />
      </div>

      <MemberEquipmentShop />

      <EquipmentIntroModal
        videoUrl={equipmentIntroVideoUrl}
        forceOpen={forceOpen}
        onForceOpenHandled={onForceHandled}
      />
    </div>
  );
}
