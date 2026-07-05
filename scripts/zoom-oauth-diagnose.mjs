#!/usr/bin/env node
/**
 * Prod Zoom OAuth diagnostics — credential probe, blob write, connection state.
 *
 * Usage:
 *   npm run test:zoom-diagnose
 *   COACH_EMAIL=john@thetrainstation.co npm run test:zoom-diagnose
 */

import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const { req, loginCoach } = createCoachClient(BASE);

async function main() {
  console.log(`\nZoom OAuth diagnose → ${BASE}\n`);

  if (!(await loginCoach({
    onPass: (n, d) => console.log(`✅ ${n} — ${d}`),
    onFail: (n, d) => { console.log(`❌ ${n} — ${d}`); process.exit(1); },
  }))) process.exit(1);

  const { res, body } = await req(`/api/admin/zoom/diagnose?_=${Date.now()}`);
  if (!res.ok) {
    console.log(`❌ diagnose API — status ${res.status}`, body);
    process.exit(1);
  }

  const d = body.diagnostics || {};
  const s = body.status || {};

  console.log("Status:", JSON.stringify(s, null, 2));
  console.log("Diagnostics:", JSON.stringify(d, null, 2));
  if (body.hint) console.log(`\nHint: ${body.hint}`);

  const ok =
    d.clientIdPresent &&
    d.secretPresent &&
    d.tokenProbe === "invalid_grant" &&
    d.blobWriteOk;

  console.log(ok ? "\n✅ Credentials + blob look ready for Connect" : "\n⚠️  Fix issues above before Connect");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});