#!/usr/bin/env node
/**
 * Reset Free-ticket gag store to product defaults (classic 5s Rickroll).
 * Clears a bad custom gag (e.g. YouTube Short @ 60s) that broke Free for kids.
 *
 *   npx tsx scripts/reset-free-gag-product-defaults-prod.mjs
 *
 * Does not touch free-ticket intro / welcome — Jeremy still uploads those under Admin → Videos.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.live.check", override: true });
dotenv.config({ path: ".env.vercel.production", override: true });

async function main() {
  const { probeBlobWrite, writeBlobJson, readBlobJson } = await import(
    "../src/lib/demo-json-blob.ts"
  );
  const probe = await probeBlobWrite();
  console.log("Blob probe:", probe);
  if (!probe.ok) {
    console.error("Cannot write Blob — prod will keep the old gag URL.");
    process.exit(1);
  }

  const existing = await readBlobJson("demo/landing-media.json");
  const prev = existing && typeof existing === "object" ? existing : {};
  const merged = {
    ...prev,
    gagVideoUrl: null,
    gagStartSec: 43,
    gagDurationSec: 5,
    gagEnabled: true,
    updatedAt: new Date().toISOString(),
  };

  const ok = await writeBlobJson("demo/landing-media.json", merged);
  console.log("Blob write:", ok);
  console.log("gag fields:", {
    gagVideoUrl: merged.gagVideoUrl,
    gagStartSec: merged.gagStartSec,
    gagDurationSec: merged.gagDurationSec,
    gagEnabled: merged.gagEnabled,
  });

  const { saveLandingMedia } = await import("../src/lib/landing-media-store.ts");
  await saveLandingMedia({
    gagVideoUrl: null,
    gagStartSec: 43,
    gagDurationSec: 5,
    gagEnabled: true,
  });
  console.log("\nVerify: curl -s https://www.thetrainstation.co/api/landing-media | jq .gag");
  console.log(
    "Note: FreeTicketModal hard-codes product gag in code; this cleans store + public API.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
