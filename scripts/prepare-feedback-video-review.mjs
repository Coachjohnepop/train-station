#!/usr/bin/env node
/**
 * Prepare a screen-recording for agent review: audio transcript + timestamped frames.
 *
 * Usage:
 *   node scripts/prepare-feedback-video-review.mjs "/path/to/video.mp4"
 *   node scripts/prepare-feedback-video-review.mjs "/path/to/video.mp4" --label july-5-2026
 *
 * Outputs under .jeremy-review-frames/<label>/:
 *   - audio.wav
 *   - audio.txt / audio.srt / audio.json (Whisper)
 *   - frames/frame_NNNN.jpg (every 15s)
 *   - REVIEW.md (manifest for the agent)
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function parseArgs(argv) {
  const args = [...argv];
  let label = null;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--label" && args[i + 1]) {
      label = args[++i];
    } else if (!args[i].startsWith("--")) {
      positional.push(args[i]);
    }
  }
  const videoPath = positional[0];
  if (!videoPath) {
    console.error("Usage: node scripts/prepare-feedback-video-review.mjs <video.mp4> [--label name]");
    process.exit(1);
  }
  const resolved = path.resolve(videoPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Video not found: ${resolved}`);
    process.exit(1);
  }
  if (!label) {
    label = path.basename(resolved, path.extname(resolved))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  return { videoPath: resolved, label };
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || `${cmd} failed`);
    process.exit(result.status ?? 1);
  }
  return result.stdout?.trim() ?? "";
}

function which(bin) {
  const result = spawnSync("which", [bin], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function formatTs(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const { videoPath, label } = parseArgs(process.argv.slice(2));
const ffmpeg = which("ffmpeg");
const ffprobe = which("ffprobe");
const whisper = which("whisper");
if (!ffmpeg || !ffprobe) {
  console.error("ffmpeg and ffprobe are required.");
  process.exit(1);
}

const outDir = path.join(repoRoot, ".jeremy-review-frames", label);
const framesDir = path.join(outDir, "frames");
fs.mkdirSync(framesDir, { recursive: true });

const durationSec = Number(
  run(ffprobe, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ]),
);

const audioPath = path.join(outDir, "audio.wav");
console.log(`[1/3] Extracting audio → ${audioPath}`);
run(ffmpeg, ["-y", "-i", videoPath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", audioPath], {
  stdio: "inherit",
});

console.log("[2/3] Extracting frames (every 15s)");
run(ffmpeg, [
  "-y", "-i", videoPath,
  "-vf", "fps=1/15,scale=1280:-1",
  "-q:v", "3",
  path.join(framesDir, "frame_%04d.jpg"),
], { stdio: "inherit" });

const frameFiles = fs.readdirSync(framesDir)
  .filter((f) => f.endsWith(".jpg"))
  .sort();

let transcriptTxt = "";
let transcriptSrt = "";
if (whisper) {
  console.log("[3/3] Transcribing with Whisper");
  run(whisper, [audioPath, "--model", "base.en", "--language", "en", "--output_dir", outDir, "--output_format", "all"], {
    stdio: "inherit",
  });
  const txtPath = path.join(outDir, "audio.txt");
  const srtPath = path.join(outDir, "audio.srt");
  if (fs.existsSync(txtPath)) transcriptTxt = fs.readFileSync(txtPath, "utf8").trim();
  if (fs.existsSync(srtPath)) transcriptSrt = fs.readFileSync(srtPath, "utf8").trim();
} else {
  console.warn("[3/3] whisper not found — skipping transcript");
}

const frameRows = frameFiles.map((file, idx) => {
  const ts = idx * 15;
  return `| ${formatTs(ts)} | \`frames/${file}\` |`;
}).join("\n");

const reviewMd = `# Feedback video review pack

- **Source:** \`${videoPath}\`
- **Duration:** ~${formatTs(durationSec)} (${Math.round(durationSec)}s)
- **Prepared:** ${new Date().toISOString()}

## How the agent should use this

1. Read this file and \`audio.txt\` (or \`audio.srt\` for timestamps).
2. Open \`frames/*.jpg\` at relevant timestamps to see what was on screen.
3. Map spoken feedback to UI screens before implementing changes.

## Frames (every 15s)

| Time | Frame |
|------|-------|
${frameRows}

## Transcript

${transcriptTxt || "_No transcript — install whisper and re-run._"}
`;

fs.writeFileSync(path.join(outDir, "REVIEW.md"), reviewMd);

console.log("\nDone.");
console.log(`Review pack: ${outDir}`);
console.log(`Manifest:    ${path.join(outDir, "REVIEW.md")}`);
console.log(`Frames:      ${frameFiles.length}`);
console.log(`Transcript:  ${transcriptTxt ? "yes" : "no"}`);