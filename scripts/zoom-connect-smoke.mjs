#!/usr/bin/env node
/**
 * Zoom connect/disconnect loop — coaches must never see connected + disconnected at once.
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co npm run test:zoom-connect
 */

import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const { req, loginCoach } = createCoachClient(BASE);

function bust(path) {
  return `${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`;
}

function assert(name, ok, detail = "") {
  if (ok) {
    console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
    return true;
  }
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
  return false;
}

async function readStatus() {
  const { res, body } = await req(bust("/api/admin/zoom/status"));
  return { res, body };
}

async function main() {
  console.log(`\nZoom connect smoke → ${BASE}\n`);

  if (!(await loginCoach({ onPass: (n, d) => console.log(`✅ ${n} — ${d}`), onFail: (n, d) => console.log(`❌ ${n} — ${d}`) }))) {
    process.exit(1);
  }

  let pass = 0;
  let total = 0;
  const check = (n, ok, d) => {
    total += 1;
    if (assert(n, ok, d)) pass += 1;
  };

  let { res, body } = await readStatus();
  check("Status API", res.ok && typeof body.connected === "boolean");
  const wasConnected = Boolean(body.connected);

  ({ res, body } = await req("/api/admin/zoom/disconnect", { method: "POST" }));
  check("Disconnect API", res.ok && body.ok === true);
  if ("connected" in body) {
    check("Disconnect returns connected=false", body.connected === false);
    check("Disconnect clears account", body.account == null);
    check("Disconnect sets ready=false", body.ready === false);
  }

  ({ res, body } = await readStatus());
  check("Status after disconnect — connected=false", body.connected === false);
  check("Status after disconnect — account null", body.account == null);

  ({ res, body } = await req("/api/admin/zoom/disconnect", { method: "POST" }));
  check("Double disconnect idempotent", res.ok && ("connected" in body ? body.connected === false : true));

  console.log(`\n${pass}/${total} passed`);
  if (wasConnected) {
    console.log(
      "\nNote: Zoom was connected before this test — reconnect in Admin → Settings when you need video.",
    );
  }
  process.exit(pass === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});