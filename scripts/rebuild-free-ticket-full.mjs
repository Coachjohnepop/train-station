#!/usr/bin/env node
/**
 * Rebuild public/videos/free-ticket-full.mp4
 *   5s chorus + top of Jeremy's intro (logo, he is not on screen) + Free Explorer clip.
 *
 *   node scripts/rebuild-free-ticket-full.mjs
 *   node scripts/rebuild-free-ticket-full.mjs --intro ./public/videos/jeremy-free-intro.mp4
 *
 * Triggered when Admin saves the Free Explorer intro (see src/lib/free-ticket-full-job.ts).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CHORUS = path.join(root, "public/videos/free-ticket-chorus.mp4");
const DEFAULT_INTRO = path.join(root, "public/videos/jeremy-free-intro.mp4");
/** Welcome file starts with the logo card — Jeremy is not on screen yet. */
const DEFAULT_OPEN = path.join(root, "public/videos/jeremy-welcome.mp4");
/** Seconds of that logo card before Jeremy first appears (~9s). */
const OPEN_SEC = 8;
const DEFAULT_OUT = path.join(root, "public/videos/free-ticket-full.mp4");

function parseArgs(argv) {
  const out = { intro: null, chorus: DEFAULT_CHORUS, out: DEFAULT_OUT, upload: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--intro" && argv[i + 1]) out.intro = argv[++i];
    else if (a === "--chorus" && argv[i + 1]) out.chorus = path.resolve(argv[++i]);
    else if (a === "--out" && argv[i + 1]) out.out = path.resolve(argv[++i]);
    else if (a === "--upload") out.upload = true;
  }
  return out;
}

function which(bin) {
  const r = spawnSync("which", [bin], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || `${cmd} failed`).trim().slice(0, 2000));
  }
  return r.stdout;
}

function isHttp(s) {
  return /^https?:\/\//i.test(s);
}

async function resolveIntro(introArg, tmpDir) {
  if (!introArg) {
    if (fs.existsSync(DEFAULT_INTRO)) return DEFAULT_INTRO;
    throw new Error("No --intro and public/videos/jeremy-free-intro.mp4 is missing.");
  }
  if (!isHttp(introArg)) {
    const p = path.resolve(introArg);
    if (!fs.existsSync(p)) throw new Error(`Intro file not found: ${p}`);
    return p;
  }
  const dest = path.join(tmpDir, "intro-src.mp4");
  const res = await fetch(introArg);
  if (!res.ok) throw new Error(`Download intro failed: ${res.status} ${introArg}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}

function cover916(ffmpeg, input, output) {
  run(ffmpeg, [
    "-y",
    "-i",
    input,
    "-vf",
    "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1",
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-ac",
    "2",
    output,
  ]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ffmpeg = which("ffmpeg");
  if (!ffmpeg) throw new Error("ffmpeg is required (brew install ffmpeg).");
  if (!fs.existsSync(args.chorus)) throw new Error(`Chorus missing: ${args.chorus}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ts-free-full-"));
  try {
    const introPath = await resolveIntro(args.intro, tmp);
    const chorus916 = path.join(tmp, "chorus-916.mp4");
    const intro916 = path.join(tmp, "intro-916.mp4");
    cover916(ffmpeg, args.chorus, chorus916);
    cover916(ffmpeg, introPath, intro916);

    const pieces = [chorus916];
    if (fs.existsSync(DEFAULT_OPEN)) {
      const openRaw = path.join(tmp, "open-raw.mp4");
      const open916 = path.join(tmp, "open-916.mp4");
      run(ffmpeg, [
        "-y",
        "-i",
        DEFAULT_OPEN,
        "-t",
        String(OPEN_SEC),
        "-c",
        "copy",
        openRaw,
      ]);
      cover916(ffmpeg, openRaw, open916);
      pieces.push(open916);
    }
    pieces.push(intro916);

    const n = pieces.length;
    const inputArgs = pieces.flatMap((p) => ["-i", p]);
    const labels = pieces
      .map(
        (_, i) =>
          `[${i}:v]fps=30,format=yuv420p,setsar=1[v${i}];[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo[a${i}]`,
      )
      .join(";");
    const concatIn = pieces.map((_, i) => `[v${i}][a${i}]`).join("");
    run(ffmpeg, [
      "-y",
      ...inputArgs,
      "-filter_complex",
      `${labels};${concatIn}concat=n=${n}:v=1:a=1[v][a]`,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      args.out,
    ]);
    const stat = fs.statSync(args.out);
    const result = {
      ok: true,
      out: args.out,
      bytes: stat.size,
      intro: args.intro || DEFAULT_INTRO,
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
