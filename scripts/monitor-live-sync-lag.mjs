#!/usr/bin/env node
/**
 * Watch live coach↔member sync for lag (set checkoffs, rest timer, Zoom host).
 *
 *   MINUTES=45 INTERVAL_SEC=2 npx tsx scripts/monitor-live-sync-lag.mjs
 *
 * Prints one line per change. Flags:
 *   LAG_REST   restActive endsAt already far in the past when first seen
 *   LAG_STALE  session not updated for a while while rest still running
 *   ZOOM_ON / ZOOM_OFF host flag transitions
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";

const TOTAL_MS = Math.max(5, Number(process.env.MINUTES || "45")) * 60 * 1000;
const INTERVAL_MS = Math.max(1, Number(process.env.INTERVAL_SEC || "2")) * 1000;
const WATCH_EMAILS = (process.env.WATCH_EMAILS ||
  "john@lemonvoice.com,jeremy@thetrainstation.co")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function fmt(d) {
  return new Date(d).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function todayPT() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setFingerprint(completedSets) {
  if (!completedSets || typeof completedSets !== "object") return "";
  const parts = [];
  for (const [k, v] of Object.entries(completedSets)) {
    if (!Array.isArray(v)) continue;
    parts.push(`${k}:${[...v].sort((a, b) => a - b).join(".")}`);
  }
  return parts.sort().join("|");
}

function restFingerprint(restActive) {
  if (!restActive || typeof restActive !== "object") return "none";
  return `${restActive.blockId || ""}:${restActive.completedSetNum || ""}:${restActive.endsAt || ""}:${restActive.startedBy || ""}`;
}

async function main() {
  const pool = createPgPool(process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const users = await prisma.user.findMany({
    where: {
      OR: WATCH_EMAILS.map((email) => ({
        email: { equals: email, mode: "insensitive" },
      })),
    },
    select: { id: true, email: true, name: true, role: true },
  });
  const emailById = Object.fromEntries(users.map((u) => [u.id, u.email]));
  const ids = users.map((u) => u.id);

  console.log(
    `LAG_WATCH_START emails=${WATCH_EMAILS.join(",")} every=${INTERVAL_MS / 1000}s for=${TOTAL_MS / 60000}m today=${todayPT()} PT`,
  );
  console.log(
    `LAG_WATCH_USERS ${users.map((u) => `${u.email}(${u.role})`).join(" · ") || "none found"}`,
  );

  /** @type {Map<string, { rev: number, sets: string, rest: string, updatedAt: number, by: string }>} */
  const prev = new Map();
  let prevZoomKey = "";
  let poll = 0;
  const started = Date.now();
  let lastChangeAt = Date.now();

  while (Date.now() - started < TOTAL_MS) {
    poll += 1;
    const day = todayPT();
    const now = Date.now();

    try {
      const sessions = await prisma.liveWorkoutSession.findMany({
        where: {
          sessionDate: day,
          ...(ids.length ? { userId: { in: ids } } : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
      });

      // Also include any other active sessions today (catch surprise members)
      const extra =
        sessions.length < 20
          ? await prisma.liveWorkoutSession.findMany({
              where: {
                sessionDate: day,
                updatedAt: { gte: new Date(now - 15 * 60 * 1000) },
                ...(ids.length ? { userId: { notIn: ids } } : {}),
              },
              orderBy: { updatedAt: "desc" },
              take: 10,
            })
          : [];

      const all = [...sessions, ...extra];
      const seenKeys = new Set();

      for (const s of all) {
        const key = `${s.userId}:${s.workoutId}:${s.sessionDate}`;
        seenKeys.add(key);
        const email = emailById[s.userId] || s.userId.slice(0, 12);
        const sets = setFingerprint(s.completedSets);
        const rest = restFingerprint(s.restActive);
        const updatedMs = new Date(s.updatedAt).getTime();
        const ageSec = Math.round((now - updatedMs) / 1000);
        const snap = {
          rev: s.revision,
          sets,
          rest,
          updatedAt: updatedMs,
          by: s.updatedBy,
        };
        const before = prev.get(key);

        if (!before) {
          prev.set(key, snap);
          const restObj = s.restActive && typeof s.restActive === "object" ? s.restActive : null;
          const restLeft = restObj?.endsAt ? Math.round((restObj.endsAt - now) / 1000) : null;
          console.log(
            `LIVE_OPEN ${fmt(s.updatedAt)} PT | ${email} | rev=${s.revision} by=${s.updatedBy} age=${ageSec}s restLeft=${restLeft ?? "—"}s sets=${sets || "empty"}`,
          );
          lastChangeAt = now;
          if (restObj?.endsAt && restObj.endsAt < now - 2000) {
            console.log(
              `LAG_REST ${email} restActive already expired by ${Math.round((now - restObj.endsAt) / 1000)}s when first observed`,
            );
          }
          continue;
        }

        const changed =
          before.rev !== snap.rev ||
          before.sets !== snap.sets ||
          before.rest !== snap.rest ||
          before.by !== snap.by;

        if (changed) {
          const deltaMs = updatedMs - before.updatedAt;
          const restObj = s.restActive && typeof s.restActive === "object" ? s.restActive : null;
          const restLeft = restObj?.endsAt ? Math.round((restObj.endsAt - now) / 1000) : null;
          const setsChanged = before.sets !== snap.sets;
          const restChanged = before.rest !== snap.rest;

          console.log(
            `LIVE_CHG ${fmt(s.updatedAt)} PT | ${email} | rev ${before.rev}→${snap.rev} by=${s.updatedBy} Δwrite=${deltaMs}ms age=${ageSec}s` +
              `${setsChanged ? " SETS" : ""}${restChanged ? " REST" : ""} restLeft=${restLeft ?? "—"}s`,
          );

          // Heuristic: if rest just started and write is old relative to endsAt window, flag.
          if (restChanged && restObj?.endsAt && restObj.totalSeconds) {
            const startedAgo = Math.round(
              (now - (restObj.endsAt - restObj.totalSeconds * 1000)) / 1000,
            );
            if (startedAgo >= 3) {
              console.log(
                `LAG_REST ${email} rest appeared ~${startedAgo}s after theoretical start (endsAt/totalSeconds). Client poll may be lagging.`,
              );
            } else {
              console.log(`OK_REST ${email} rest fresh (~${startedAgo}s since start)`);
            }
          }

          if (setsChanged) {
            console.log(`OK_SETS ${email} sets fingerprint updated (rev ${snap.rev})`);
          }

          prev.set(key, snap);
          lastChangeAt = now;
        } else {
          // Stale active rest while session not updating
          const restObj = s.restActive && typeof s.restActive === "object" ? s.restActive : null;
          if (restObj?.endsAt && restObj.endsAt > now && ageSec >= 20 && poll % 5 === 0) {
            console.log(
              `LAG_STALE ${email} rest still running (${Math.round((restObj.endsAt - now) / 1000)}s left) but session quiet ${ageSec}s — expected if no new sets`,
            );
          }
        }
      }

      // Zoom host flag
      try {
        const zoom = await prisma.liveClassZoomDay.findUnique({ where: { sessionDate: day } });
        const rec = zoom?.record && typeof zoom.record === "object" ? zoom.record : null;
        const hostAt = rec?.hostStartedAt || null;
        const hostActive =
          hostAt && now - new Date(hostAt).getTime() < 2 * 60 * 60 * 1000 && rec?.joinUrl;
        const zoomKey = `${Boolean(hostActive)}:${hostAt || ""}:${rec?.meetingNumber || ""}`;
        if (zoomKey !== prevZoomKey) {
          if (!prevZoomKey) {
            console.log(
              `ZOOM_STATE hostActive=${Boolean(hostActive)} hostStartedAt=${hostAt || "—"} meeting=${rec?.meetingNumber || "—"}`,
            );
          } else if (hostActive) {
            console.log(`ZOOM_ON ${fmt(new Date())} PT hostStartedAt=${hostAt}`);
          } else {
            console.log(`ZOOM_OFF ${fmt(new Date())} PT`);
          }
          prevZoomKey = zoomKey;
          lastChangeAt = now;
        }
      } catch (e) {
        if (poll === 1) console.log(`ZOOM_ERR ${e?.message || e}`);
      }

      // Quiet heartbeat
      if (now - lastChangeAt > 30_000 && poll % 15 === 0) {
        console.log(
          `HEARTBEAT t+${Math.round((now - started) / 1000)}s quiet sessions=${all.length} day=${day}`,
        );
      }
    } catch (e) {
      console.log(`LAG_WATCH_ERR ${e?.message || e}`);
    }

    await sleep(INTERVAL_MS);
  }

  console.log("LAG_WATCH_DONE");
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
