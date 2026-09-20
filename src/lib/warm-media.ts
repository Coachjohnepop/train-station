/** Warm HTTP + media buffers so tour/intro clips start on the first tap. */

const warmed = new Set<string>();

export function warmUrl(url: string | null | undefined, as: "video" | "audio" | "image" | "fetch"): void {
  if (typeof document === "undefined") return;
  const href = (url || "").trim();
  if (!href || warmed.has(`${as}:${href}`)) return;
  warmed.add(`${as}:${href}`);

  if (as === "image") {
    const img = new Image();
    img.src = href;
    return;
  }

  if (as === "fetch") {
    void fetch(href, { cache: "force-cache", mode: "no-cors" }).catch(() => undefined);
    return;
  }

  const el = document.createElement(as === "video" ? "video" : "audio");
  el.preload = "auto";
  el.muted = true;
  if (as === "video") {
    (el as HTMLVideoElement).playsInline = true;
  }
  el.src = href;
  el.load();
}

export function warmLandingPlayback(): void {
  if (typeof window === "undefined") return;
  warmUrl("/videos/jeremy-welcome.mp4", "video");
  warmUrl("/videos/jeremy-welcome.mp4?v=20260920a", "video");
  warmUrl("/videos/jeremy-welcome-ready.mp4", "video");
  warmUrl("/videos/jeremy-welcome-ready.mp4?v=20260920a", "video");
  warmUrl("/videos/free-ticket-full.mp4", "video");
  warmUrl("/images/tickets/free.jpg", "image");
  warmUrl("/images/tickets/coach-class.jpg", "image");
  warmUrl("/images/tickets/business-class.jpg", "image");
  warmUrl("/images/tickets/first-class.jpg", "image");
  warmUrl("/images/programs/adult.jpg", "image");
  warmUrl("/images/equipment/dumbbells.jpg", "image");

  void fetch("/api/landing-media", { cache: "force-cache" })
    .then((res) => res.json())
    .then(
      (body: {
        welcomeVideoUrl?: string | null;
        freeTicketFullUrl?: string | null;
        freeChastiseVideoUrl?: string | null;
        howItWorks?: { steps?: Array<{ voice?: { audioUrl?: string | null } }> };
      }) => {
        warmUrl(body.welcomeVideoUrl, "video");
        warmUrl(body.freeTicketFullUrl, "video");
        warmUrl(body.freeChastiseVideoUrl, "video");
        for (const step of body.howItWorks?.steps || []) {
          warmUrl(step.voice?.audioUrl, "audio");
        }
      },
    )
    .catch(() => undefined);
}
