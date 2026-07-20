#!/usr/bin/env node
/**
 * Set Venmo QR + handle on landing media (Blob store used by prod).
 *
 *   npx tsx scripts/set-venmo-landing-prod.mjs
 *
 * Uses BLOB_READ_WRITE_TOKEN from .env.vercel.live.check / env.
 * QR image is already at public/images/venmo-jeremy-qr.png on the site.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.live.check", override: true });

const QR_URL =
  process.env.VENMO_QR_URL ||
  "https://www.thetrainstation.co/images/venmo-jeremy-qr.png";
const HANDLE = process.env.VENMO_HANDLE || "@JeremyByrdCSCS";
const INSTRUCTIONS =
  process.env.VENMO_INSTRUCTIONS ||
  "Scan to pay membership (same Train Station business account as Stripe bank deposits). Include your full name in the Venmo note. Coach marks you paid in Admin → Members after the payment posts.";

async function main() {
  const { probeBlobWrite, writeBlobJson, readBlobJson } = await import(
    "../src/lib/demo-json-blob.ts"
  );
  const probe = await probeBlobWrite();
  console.log("Blob probe:", probe);
  if (!probe.ok) {
    console.error("Cannot write Blob — prod will keep serving old landing media.");
    process.exit(1);
  }

  // Venmo only — never invent joke/default YouTube URLs (no rickroll).
  const existing = await readBlobJson("demo/landing-media.json");
  const prev = existing && typeof existing === "object" ? existing : {};
  const scrubJoke = (url) => {
    const u = typeof url === "string" ? url.trim() : "";
    if (!u) return null;
    if (/dQw4w9WgXcQ/i.test(u)) return null;
    return u;
  };
  const merged = {
    ...prev,
    welcomeVideoUrl: scrubJoke(prev.welcomeVideoUrl),
    welcomeVideosByPlan:
      prev.welcomeVideosByPlan && typeof prev.welcomeVideosByPlan === "object"
        ? prev.welcomeVideosByPlan
        : {},
    freeChastiseVideoUrl: scrubJoke(prev.freeChastiseVideoUrl),
    venmoQrUrl: QR_URL,
    venmoHandle: HANDLE,
    venmoInstructions: INSTRUCTIONS,
    updatedAt: new Date().toISOString(),
  };

  const ok = await writeBlobJson("demo/landing-media.json", merged);
  console.log("Blob write:", ok);
  console.log("Blob read-back:", await readBlobJson("demo/landing-media.json"));

  const { saveLandingMedia } = await import("../src/lib/landing-media-store.ts");
  await saveLandingMedia({
    venmoQrUrl: QR_URL,
    venmoHandle: HANDLE,
    venmoInstructions: INSTRUCTIONS,
  });
  console.log("\nVerify: curl -s https://www.thetrainstation.co/api/payments/public | jq .venmo");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
