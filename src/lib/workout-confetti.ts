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

  // Gold-heavy palette so bursts read as “from the points” on celebrate
  const colors = [
    "#d4af37",
    "#fde68a",
    "#f0c75e",
    "#fff8e7",
    "#b8860b",
    "#7c3aed",
    "#c4b5fd",
    "#f472b6",
  ];
  const particles = Array.from({ length: 140 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 10;
    return {
      x: ox + (Math.random() - 0.5) * 36,
      y: oy + (Math.random() - 0.5) * 24,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.85 - 2,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      size: Math.random() * 8 + 3.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > 0.45 ? "rect" : "circle",
    };
  });

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

type FireworkParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

/** Full-screen fireworks show — member workout complete celebration. */
export function runFireworks(canvas: HTMLCanvasElement, durationMs = 3000) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.scale(dpr, dpr);

  const colors = ["#fde68a", "#f0c75e", "#d4af37", "#f472b6", "#c4b5fd", "#7c3aed", "#4ade9a", "#fff"];
  const particles: FireworkParticle[] = [];
  const start = performance.now();
  let raf = 0;

  function spawnBurst() {
    const cx = w * (0.2 + Math.random() * 0.6);
    const cy = h * (0.18 + Math.random() * 0.42);
    const count = 36 + Math.floor(Math.random() * 28);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      const speed = 2 + Math.random() * 5.5;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 55 + Math.random() * 35,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 2.5,
      });
    }
  }

  spawnBurst();
  const burstTimer = window.setInterval(spawnBurst, 380);

  function frame(now: number) {
    if (!ctx) return;
    const elapsed = now - start;
    ctx.clearRect(0, 0, w, h);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += 1;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07;
      p.vx *= 0.985;

      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    if (elapsed < durationMs) {
      raf = requestAnimationFrame(frame);
    }
  }

  raf = requestAnimationFrame(frame);

  return () => {
    window.clearInterval(burstTimer);
    cancelAnimationFrame(raf);
  };
}