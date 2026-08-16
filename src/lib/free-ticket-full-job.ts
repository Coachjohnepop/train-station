import "server-only";

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getLandingMedia, saveLandingMedia } from "@/lib/landing-media-store";
import { storeSiteVideo } from "@/lib/site-video-storage";

const SCRIPT = path.join(process.cwd(), "scripts/rebuild-free-ticket-full.mjs");
const LOCAL_OUT = path.join(process.cwd(), "public/videos/free-ticket-full.mp4");

function localIntroPath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed.startsWith("/")) return null;
  const rel = trimmed.replace(/^\//, "").split("?")[0];
  const abs = path.join(process.cwd(), "public", rel);
  return fs.existsSync(abs) ? abs : null;
}

function runScript(intro: string): Promise<{ ok: true; out: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, "--intro", intro, "--out", LOCAL_OUT], {
      cwd: process.cwd(),
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `rebuild exited ${code}`));
        return;
      }
      const line = stdout.trim().split("\n").at(-1) || "";
      try {
        resolve(JSON.parse(line) as { ok: true; out: string; bytes: number });
      } catch {
        resolve({ ok: true, out: LOCAL_OUT, bytes: fs.existsSync(LOCAL_OUT) ? fs.statSync(LOCAL_OUT).size : 0 });
      }
    });
  });
}

/** Queue + run the concat job. Safe to fire-and-forget after a Free intro save. */
export async function triggerRebuildFreeTicketFull(opts: {
  introUrl: string;
  reason: string;
}): Promise<{ ok: boolean; queued?: boolean; error?: string; url?: string | null }> {
  const introUrl = opts.introUrl.trim();
  if (!introUrl) return { ok: false, error: "No Free Explorer intro URL." };

  await saveLandingMedia({
    freeTicketFullStatus: "queued",
    freeTicketFullError: null,
    freeTicketFullIntroSource: introUrl,
  });

  try {
    return await runRebuildFreeTicketFullJob(introUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Rebuild failed";
    await saveLandingMedia({
      freeTicketFullStatus: "error",
      freeTicketFullError: message.slice(0, 500),
      freeTicketFullIntroSource: introUrl,
    });
    return { ok: false, error: message };
  }
}

export async function runRebuildFreeTicketFullJob(introUrl: string) {
  await saveLandingMedia({
    freeTicketFullStatus: "running",
    freeTicketFullError: null,
    freeTicketFullIntroSource: introUrl,
  });

  const introArg = localIntroPath(introUrl) || introUrl;
  const built = await runScript(introArg);

  let uploaded: string | null = null;
  if (fs.existsSync(built.out)) {
    try {
      const buf = fs.readFileSync(built.out);
      const stored = await storeSiteVideo(buf, "video/mp4", "free-ticket-full.mp4");
      uploaded = stored.url;
    } catch {
      uploaded = null;
    }
  }

  const builtAt = new Date().toISOString();
  const publicUrl = uploaded || `/videos/free-ticket-full.mp4?v=${Date.parse(builtAt)}`;
  await saveLandingMedia({
    freeTicketFullUrl: publicUrl,
    freeTicketFullBuiltAt: builtAt,
    freeTicketFullStatus: "ok",
    freeTicketFullError: null,
    freeTicketFullIntroSource: introUrl,
  });

  return { ok: true as const, url: publicUrl, bytes: built.bytes };
}

export async function queuedFreeTicketFullIntro(): Promise<string | null> {
  const config = await getLandingMedia();
  if (config.freeTicketFullStatus !== "queued" && config.freeTicketFullStatus !== "error") {
    return null;
  }
  return config.freeTicketFullIntroSource || config.freeChastiseVideoUrl;
}
