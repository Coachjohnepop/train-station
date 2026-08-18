#!/usr/bin/env node
/**
 * Fail the build if a network-facing poll is faster than 5s.
 * The 150ms LiveWorkoutSession loop blew Supabase Free usage — do not repeat.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const MIN_MS = 5_000;

const LOCAL_UI_FILES = new Set([
  "src/lib/workout-confetti.ts",
  "src/components/SplashCarousel.tsx",
  "src/components/LandingHero.tsx",
]);

const LOCAL_UI_LINE = /tick,\s*200|spawnBurst,\s*380|setImageTick|setPhraseTick/;

function walk(dir, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|mjs)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function parseDelay(raw) {
  return Number(String(raw).replace(/_/g, ""));
}

const files = walk(SRC);
const hits = [];

for (const file of files) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (LOCAL_UI_FILES.has(rel)) continue;
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (LOCAL_UI_LINE.test(line)) return;
    const delay = line.match(
      /setInterval\s*\([^)]*?,\s*(\d[\d_]*)\s*[,)]/,
    );
    if (delay) {
      const ms = parseDelay(delay[1]);
      if (Number.isFinite(ms) && ms < MIN_MS) {
        hits.push(`${rel}:${i + 1} setInterval ${ms}ms (< ${MIN_MS})`);
      }
    }
    const assign = line.match(
      /(?:POLL_MS|LIVE_POLL_MS)\s*=\s*(\d[\d_]*)/,
    );
    if (assign) {
      const ms = parseDelay(assign[1]);
      if (Number.isFinite(ms) && ms < MIN_MS) {
        hits.push(`${rel}:${i + 1} ${assign[0]} (< ${MIN_MS})`);
      }
    }
  });
}

const pollMod = readFileSync(join(SRC, "lib/session-live-poll.ts"), "utf8");
const floor = pollMod.match(/MIN_NETWORK_POLL_MS\s*=\s*(\d[\d_]*)/);
if (!floor || parseDelay(floor[1]) < MIN_MS) {
  hits.push("src/lib/session-live-poll.ts MIN_NETWORK_POLL_MS must stay >= 5000");
}
const live = pollMod.match(/LIVE_CLASS_POLL_MS\s*=\s*MIN_NETWORK_POLL_MS/);
if (!live) {
  hits.push("src/lib/session-live-poll.ts LIVE_CLASS_POLL_MS must equal MIN_NETWORK_POLL_MS");
}

if (hits.length) {
  console.error("Hot poll guard failed — network intervals under 5s are banned:\n");
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}

console.log("Hot poll guard ok — no network interval under 5s.");
