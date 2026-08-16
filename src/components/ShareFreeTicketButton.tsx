"use client";

import { useState } from "react";
import { freeGagShareData } from "@/lib/free-gag-share";

type Props = {
  className?: string;
  label?: string;
};

export default function ShareFreeTicketButton({
  className,
  label = "Send this to a friend",
}: Props) {
  const [status, setStatus] = useState<"idle" | "sent" | "copied" | "fail">("idle");

  async function share() {
    const data = freeGagShareData();
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        const can =
          typeof navigator.canShare !== "function" || navigator.canShare(data);
        if (can) {
          await navigator.share(data);
          setStatus("sent");
          return;
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }

    try {
      const line = `${data.text} ${data.url}`;
      await navigator.clipboard.writeText(line);
      setStatus("copied");
    } catch {
      setStatus("fail");
    }
  }

  const statusLabel =
    status === "sent"
      ? "Sent — they'll get our ticket, not YouTube"
      : status === "copied"
        ? "Link copied — paste it anywhere"
        : status === "fail"
          ? "Copy failed — share thetrainstation.co/free"
          : null;

  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <button
        type="button"
        onClick={() => void share()}
        data-analytics-action="share-free-ticket"
        data-analytics-label="Send Free ticket gag"
        className={
          className ||
          "inline-flex h-14 items-center justify-center rounded-full bg-amber-400 text-base font-semibold text-black transition hover:bg-amber-300"
        }
      >
        {label}
      </button>
      {statusLabel ? (
        <p className="text-center text-sm text-amber-300/90">{statusLabel}</p>
      ) : null}
    </div>
  );
}
