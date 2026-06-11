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
        // After enrolling, send user into the guided onboarding wizard (step 2 from client feedback)
        router.push('/member/onboard');
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
        onClick={(e) => {
          e.stopPropagation();
          handleUnenroll();
        }}
        disabled={loading}
        className="text-xs px-2.5 py-0.5 rounded border border-[var(--danger)]/70 text-[var(--danger)] hover:bg-[var(--danger)]/10 hover:border-[var(--danger)] transition disabled:opacity-50"
      >
        {loading ? "..." : "Unenroll"}
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleEnroll();
      }}
      disabled={loading}
      className="text-[10px] px-2.5 py-0.5 rounded bg-accent text-white font-medium hover:brightness-110 transition disabled:opacity-50"
    >
      {loading ? "..." : "Enroll & start setup"}
    </button>
  );
}
