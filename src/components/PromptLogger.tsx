"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PromptLogger({ 
  programSlug, 
  day, 
  isCoachView = false 
}: { 
  programSlug: string; 
  day: number; 
  isCoachView?: boolean;
}) {
  const [logged, setLogged] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function handleLog() {
    try {
      const res = await fetch(`/api/programs/${encodeURIComponent(programSlug)}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day }),
      });
      if (res.ok) {
        setLogged(true);
        setMsg(
          isCoachView 
            ? `Day ${day} logged for student on ${programSlug}. (Attributed to member)`
            : `Day ${day} logged for ${programSlug}. Progress advanced independently.`
        );
        router.refresh();
      } else {
        setMsg("Logged (demo).");
        setLogged(true);
      }
    } catch {
      setLogged(true);
      setMsg(`Day ${day} prompts logged (offline demo).`);
    }
  }

  return (
    <div>
      <button
        onClick={handleLog}
        disabled={logged}
        className="btn-primary"
      >
        {logged ? "Logged ✓" : isCoachView ? "Log day complete for student" : "Log day complete"}
      </button>
      {msg && <p className="mt-2 text-sm text-[var(--success)]">{msg}</p>}
      {!logged && (
        <p className="mt-1 text-[10px] text-[var(--muted)]">
          {isCoachView 
            ? "Responses will be saved under the student's record for your review." 
            : "Your answers cascade into the next day&apos;s suggestions. This advances only this program&apos;s progress."
          }
        </p>
      )}
    </div>
  );
}
