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
        const data = await res.json().catch(() => ({}));
        router.push(typeof data.redirectTo === "string" ? data.redirectTo : "/member/today");
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
        className="text-xs px-3 py-1 rounded border border-[var(--danger)]/70 text-[var(--danger)] hover:bg-[var(--danger)]/10 hover:border-[var(--danger)] transition disabled:opacity-50"
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
      className="member-set-btn text-base px-5 py-2 min-w-[140px] bg-accent text-[var(--text)] border-accent font-semibold active:scale-[0.96] hover:border-accent/70"
    >
      <span className="member-set-btn__num text-base">{loading ? "..." : "Start"}</span>
      <span className="member-set-btn__label text-[10px] tracking-[0.5px]">Start program</span>
    </button>
  );
}
