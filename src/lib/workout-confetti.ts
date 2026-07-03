"use client";

export type ConfettiOrigin = { x: number; y: number };

export function confettiOriginFromElement(el: HTMLElement): ConfettiOrigin {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Canvas confetti burst — shared by coach exercise finish + member score celebrate. */
export function runConfetti(
  canvas: HTMLCanvasElement,
  durationMs = 2200,
  origin?: ConfettiOrigin,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(dpr, dpr);

  const ox = origin?.x ?? window.innerWidth / 2;
  const oy = origin?.y ?? window.innerHeight / 2;

  const colors = ["#d4af37", "#fde68a", "#f0c75e", "#7c3aed", "#c4b5fd", "#4ade9a", "#f472b6"];
  const particles = Array.from({ length: 100 }, () => ({
    x: ox + (Math.random() - 0.5) * 28,
    y: oy + (Math.random() - 0.5) * 20,
    vx: (Math.random() - 0.5) * 11,
    vy: Math.random() * -11 - 3,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    size: Math.random() * 7 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    shape: Math.random() > 0.5 ? "rect" : "circle",
  }));

  const start = performance.now();
  let raf = 0;

  function frame(now: number) {
    if (!ctx) return;
    const elapsed = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22;
      p.rot += p.vr;
      const alpha = Math.max(0, 1 - elapsed / durationMs);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    if (elapsed < durationMs) {
      raf = requestAnimationFrame(frame);
    }
  }

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

/** Quick burst for coach last-set checkoffs — origin is viewport coords (scroll-safe). */
export function fireWorkoutConfetti(origin?: ConfettiOrigin, durationMs = 1600) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:300;width:100%;height:100%;";
  document.body.appendChild(canvas);

  const stop = runConfetti(canvas, durationMs, origin);
  window.setTimeout(() => {
    stop();
    canvas.remove();
  }, durationMs + 120);
}