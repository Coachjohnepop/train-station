"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  programSlug: string;
  initialLocation: "gym" | "home";
};

export default function MemberTrainingLocationToggle({ programSlug, initialLocation }: Props) {
  const router = useRouter();
  const [location, setLocation] = useState(initialLocation);
  const [saving, setSaving] = useState(false);

  async function select(next: "gym" | "home") {
    if (next === location || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/member/training-location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug, trainingLocation: next }),
      });
      if (res.ok) {
        setLocation(next);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs">
      <button
        type="button"
        className={`rounded-md px-3 py-1.5 font-medium transition ${
          location === "gym"
            ? "bg-accent text-[var(--text)] shadow-sm"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        }`}
        disabled={saving}
        onClick={() => void select("gym")}
      >
        Gym
      </button>
      <button
        type="button"
        className={`rounded-md px-3 py-1.5 font-medium transition ${
          location === "home"
            ? "bg-accent text-[var(--text)] shadow-sm"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        }`}
        disabled={saving}
        onClick={() => void select("home")}
      >
        Home
      </button>
    </div>
  );
}