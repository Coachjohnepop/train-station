"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EnrollButton({
  slug,
  isEnrolled,
}: {
  slug: string;
  isEnrolled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/programs/${slug}/enroll`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Failed to enroll");
      }
    } catch {
      alert("Error enrolling");
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async () => {
    if (!confirm("Unenroll from this program? Your progress will be kept but you will lose access to the schedule.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/programs/${slug}/enroll`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Failed to unenroll");
      }
    } catch {
      alert("Error");
    } finally {
      setLoading(false);
    }
  };

  if (isEnrolled) {
    return (
      <button
        onClick={handleUnenroll}
        disabled={loading}
        className="text-xs text-[var(--danger)] hover:underline disabled:opacity-50"
      >
        {loading ? "..." : "Unenroll"}
      </button>
    );
  }

  return (
    <button
      onClick={handleEnroll}
      disabled={loading}
      className="rounded bg-accent px-3 py-1 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
    >
      {loading ? "Enrolling..." : "Enroll (free)"}
    </button>
  );
}
