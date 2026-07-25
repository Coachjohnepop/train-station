#!/usr/bin/env node
/**
 * Full-site loop sweep: dead links + route health + process-flow API gates.
 *
 *   BASE_URL=https://www.thetrainstation.co node scripts/site-loop-sweep.mjs
 *
 * Exit 1 if any hard failures (404/5xx on expected-good routes, dead nav hrefs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const results = {
  pages: [],
  apis: [],
  deadHrefs: [],
  processFlows: [],
  warnings: [],
  errors: [],
};

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js|mjs)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function pageRoutesFromFs() {
  const app = path.join(SRC, "app");
  const routes = [];
  function rec(dir, urlParts) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith(".") || ent.name === "api") continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        // dynamic segments: use placeholder or skip deep probe
        if (ent.name.startsWith("[") && ent.name.endsWith("]")) {
          rec(p, [...urlParts, ent.name]);
        } else {
          rec(p, [...urlParts, ent.name]);
        }
      } else if (ent.name === "page.tsx" || ent.name === "page.ts" || ent.name === "page.jsx") {
        const raw = "/" + urlParts.join("/");
        const url = raw === "/" ? "/" : raw.replace(/\/$/, "");
        routes.push(url);
      }
    }
  }
  rec(app, []);
  return [...new Set(routes)].sort();
}

function expandDynamic(route) {
  // Known slug expansions for probing
  if (route.includes("[slug]")) {
    return [route.replace("[slug]", "adult"), route.replace("[slug]", "strength")];
  }
  if (route.includes("[id]")) {
    return []; // skip random ids
  }
  return [route];
}

async function probe(urlPath, opts = {}) {
  const url = urlPath.startsWith("http") ? urlPath : `${BASE}${urlPath}`;
  const method = opts.method || "GET";
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method,
      redirect: opts.redirect || "manual",
      headers: {
        "user-agent": "train-station-site-loop-sweep/1.0",
        ...(opts.headers || {}),
        ...(opts.body ? { "content-type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const loc = res.headers.get("location") || "";
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      bodyText = "";
    }
    let json = null;
    try {
      json = JSON.parse(bodyText);
    } catch {
      /* not json */
    }
    return {
      url: urlPath,
      status: res.status,
      location: loc,
      ms: Date.now() - t0,
      json,
      bodySnippet: bodyText.slice(0, 200),
    };
  } catch (e) {
    return {
      url: urlPath,
      status: 0,
      location: "",
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function extractInternalHrefs() {
  const files = walk(SRC);
  const hrefs = new Map(); // href -> [files]
  const re =
    /(?:href|router\.push|redirect)\(\s*["'`](\/[^"'`]+)["'`]|href=["'`](\/[^"'`]+)["'`]/g;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(text))) {
      const href = (m[1] || m[2] || "").split("?")[0].split("#")[0];
      if (!href || href.startsWith("//")) continue;
      if (href.includes("${") || href.includes("[")) continue;
      if (!hrefs.has(href)) hrefs.set(href, []);
      hrefs.get(href).push(path.relative(ROOT, file));
    }
  }
  return hrefs;
}

function routeExists(href, pageRoutes) {
  if (href.startsWith("/api/")) {
    // map to route.ts existence loosely
    const rel = href.replace(/^\//, "");
    const candidates = [
      path.join(SRC, "app", rel, "route.ts"),
      path.join(SRC, "app", rel, "route.tsx"),
    ];
    // strip trailing segments for dynamic
    if (candidates.some((c) => fs.existsSync(c))) return true;
    // try parent with [param]
    const parts = rel.split("/");
    for (let i = parts.length; i >= 1; i--) {
      const slice = parts.slice(0, i);
      const dir = path.join(SRC, "app", ...slice);
      if (fs.existsSync(path.join(dir, "route.ts"))) return true;
      // dynamic last segment
      if (i >= 2) {
        const parent = path.join(SRC, "app", ...parts.slice(0, i - 1));
        if (fs.existsSync(parent)) {
          for (const ent of fs.readdirSync(parent, { withFileTypes: true })) {
            if (
              ent.isDirectory() &&
              ent.name.startsWith("[") &&
              fs.existsSync(path.join(parent, ent.name, "route.ts"))
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
  // pages
  if (pageRoutes.includes(href)) return true;
  if (href === "/admin" || href === "/member") return true;
  // prefix match for nested
  for (const r of pageRoutes) {
    if (r.includes("[")) {
      const pattern = r
        .replace(/\[.*?\]/g, "[^/]+")
        .replace(/\//g, "\\/");
      if (new RegExp(`^${pattern}$`).test(href)) return true;
    }
  }
  // public static
  if (href.startsWith("/images/") || href.startsWith("/audio/") || href.startsWith("/_next")) {
    return true;
  }
  return false;
}

function classifyPage(status, location) {
  if (status === 0) return "error";
  if (status >= 500) return "error";
  if (status === 404) return "dead";
  if (status === 200) return "ok";
  if (status === 307 || status === 302 || status === 301 || status === 308) {
    if (location.includes("/login")) return "gated";
    return "redirect";
  }
  if (status === 401 || status === 403) return "gated";
  return "other";
}

async function main() {
  console.log(`\n🔍 Site loop sweep @ ${BASE}\n`);

  const pageRoutes = pageRoutesFromFs();
  const probePages = [];
  for (const r of pageRoutes) {
    probePages.push(...expandDynamic(r));
  }
  // Explicit critical surfaces
  const extras = [
    "/admin/discounts",
    "/admin/billing",
    "/join",
    "/login",
    "/signup",
    "/member/checkout",
    "/member/today",
    "/api/payments/public",
    "/api/pricing/public",
    "/api/landing-media",
    "/api/brand/public",
    "/api/push/vapid-public-key",
  ];
  for (const e of extras) if (!probePages.includes(e) && !e.startsWith("/api")) probePages.push(e);

  console.log(`Pages to probe: ${probePages.length}`);

  // --- Page HTTP sweep ---
  for (const p of probePages) {
    const r = await probe(p);
    const kind = classifyPage(r.status, r.location);
    results.pages.push({ ...r, kind });
    const mark =
      kind === "ok" ? "✓" : kind === "gated" ? "🔒" : kind === "redirect" ? "→" : kind === "dead" ? "✗" : "!";
    console.log(
      `  ${mark} ${r.status || "ERR"} ${p}${r.location ? " → " + r.location.slice(0, 60) : ""}${r.error ? " " + r.error : ""}`,
    );
    if (kind === "dead" || kind === "error") {
      results.errors.push(`Page ${p}: ${r.status} ${r.error || r.location || ""}`);
    }
  }

  // --- Public APIs ---
  console.log("\nPublic APIs:");
  const publicApis = [
    { path: "/api/payments/public", expect: 200 },
    { path: "/api/pricing/public", expect: 200 },
    { path: "/api/landing-media", expect: 200 },
    { path: "/api/brand/public", expect: 200 },
    { path: "/api/push/vapid-public-key", expect: [200, 503] },
    { path: "/api/auth/session", expect: 200 },
    { path: "/api/auth/oauth/providers", expect: 200 },
    // Session-required by design (member Book Call); unauth 401 is healthy
    { path: "/api/bookings/contact", expect: 401 },
    // Cron must pass middleware; route returns 401 without Bearer CRON_SECRET
    { path: "/api/cron/gamification-season", expect: 401 },
  ];
  for (const a of publicApis) {
    const r = await probe(a.path);
    const expect = Array.isArray(a.expect) ? a.expect : [a.expect];
    const ok = expect.includes(r.status);
    results.apis.push({ ...r, ok, expect });
    console.log(`  ${ok ? "✓" : "✗"} ${r.status} ${a.path}`);
    if (!ok) results.errors.push(`Public API ${a.path}: got ${r.status}, expected ${expect.join("|")}`);
  }

  // payments shape
  const pay = results.apis.find((a) => a.url === "/api/payments/public");
  if (pay?.json) {
    const j = pay.json;
    const pk = j.stripePublishableKey || "";
    const mode = pk.startsWith("pk_live") ? "LIVE" : pk.startsWith("pk_test") ? "TEST" : "UNKNOWN";
    console.log(
      `  · Stripe mode: ${mode} · enabled=${j.stripeEnabled} · venmo=${j.venmo?.hasQr} · tips=${j.tips?.enabled}`,
    );
    if (!j.stripeEnabled) results.warnings.push("Stripe not enabled on public payments");
    if (mode === "TEST") results.warnings.push("Stripe publishable still TEST on prod");
    if (!j.venmo?.hasQr) results.warnings.push("Venmo QR missing");
    const notReady = (j.memberships || []).filter((m) => !m.stripeReady);
    if (notReady.length) {
      results.warnings.push(
        `Memberships not stripeReady: ${notReady.map((m) => m.plan).join(", ")}`,
      );
    }
  }

  // --- Auth-gated process flows (expect 401, not 404/500) ---
  console.log("\nProcess-flow APIs (expect 401 unauthenticated):");
  const gated = [
    { path: "/api/stripe/checkout", method: "POST", body: {} },
    { path: "/api/admin/billing/discounts", method: "GET" },
    { path: "/api/admin/billing/overview", method: "GET" },
    { path: "/api/admin/pricing", method: "GET" },
    { path: "/api/admin/members", method: "GET" },
    { path: "/api/admin/queue", method: "GET" },
    { path: "/api/workouts", method: "GET" },
    { path: "/api/exercises", method: "GET" },
    { path: "/api/workout-templates", method: "GET" },
    { path: "/api/workout-templates/paste", method: "POST", body: {} },
    { path: "/api/programs", method: "GET" },
    { path: "/api/chat/threads", method: "GET" },
    { path: "/api/member/membership", method: "GET" },
    { path: "/api/member/gamification", method: "GET" },
    { path: "/api/onboard/complete", method: "POST", body: {} },
    { path: "/api/signup/register", method: "POST", body: {} },
    { path: "/api/admin/members/x/mark-paid", method: "POST", body: {} },
  ];
  for (const g of gated) {
    const r = await probe(g.path, { method: g.method, body: g.body });
    // 401/403 = healthy gate; 400 ok for empty body signup; 404 = dead route; 500 = bug
    const healthy =
      r.status === 401 ||
      r.status === 403 ||
      (g.path.includes("signup") && (r.status === 400 || r.status === 401)) ||
      (g.path.includes("mark-paid") && (r.status === 401 || r.status === 403 || r.status === 404));
    const dead = r.status === 404;
    const crash = r.status >= 500 || r.status === 0;
    results.processFlows.push({ ...r, healthy, dead, crash, method: g.method });
    const mark = healthy ? "✓" : dead ? "✗404" : crash ? "!5xx" : `?${r.status}`;
    console.log(`  ${mark} ${g.method} ${g.path}`);
    if (dead) results.errors.push(`Flow ${g.method} ${g.path}: 404`);
    if (crash) results.errors.push(`Flow ${g.method} ${g.path}: ${r.status} ${r.error || r.bodySnippet}`);
    if (!healthy && !dead && !crash) {
      results.warnings.push(`Flow ${g.method} ${g.path}: unexpected ${r.status}`);
    }
  }

  // --- Static dead href scan ---
  console.log("\nStatic internal href scan:");
  const hrefs = extractInternalHrefs();
  let deadCount = 0;
  for (const [href, files] of [...hrefs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (href.startsWith("/api/")) {
      // only flag clearly missing API roots we care about
      continue;
    }
    // skip known external-ish or file assets
    if (/\.(png|jpg|jpeg|svg|mp3|webp|ico)$/i.test(href)) continue;
    if (!routeExists(href, pageRoutes)) {
      // double-check live
      const live = await probe(href);
      const kind = classifyPage(live.status, live.location);
      if (kind === "dead" || kind === "error") {
        deadCount++;
        results.deadHrefs.push({ href, files: files.slice(0, 3), status: live.status });
        console.log(`  ✗ ${href} (${live.status}) from ${files[0]}`);
        results.errors.push(`Dead href ${href} → ${live.status}`);
      } else if (kind === "gated" || kind === "ok" || kind === "redirect") {
        // exists on server even if not in fs static list
      } else {
        results.warnings.push(`Href ${href} → ${live.status}`);
      }
    }
  }
  if (deadCount === 0) console.log("  ✓ No dead static page hrefs found");

  // --- Nav sections vs pages ---
  console.log("\nNav catalog check:");
  const navFile = path.join(SRC, "lib/admin-nav-sections.ts");
  if (fs.existsSync(navFile)) {
    const navText = fs.readFileSync(navFile, "utf8");
    const navHrefs = [...navText.matchAll(/href:\s*["']([^"']+)["']/g)].map((m) => m[1]);
    for (const h of navHrefs) {
      const live = await probe(h);
      const kind = classifyPage(live.status, live.location);
      const ok = kind === "ok" || kind === "gated" || kind === "redirect";
      console.log(`  ${ok ? "✓" : "✗"} nav ${h} → ${live.status}`);
      if (!ok) results.errors.push(`Nav ${h}: ${live.status}`);
    }
  }

  // Summary
  const pageOk = results.pages.filter((p) => p.kind === "ok" || p.kind === "gated" || p.kind === "redirect").length;
  const pageBad = results.pages.filter((p) => p.kind === "dead" || p.kind === "error").length;

  console.log("\n========== SUMMARY ==========");
  console.log(`Base: ${BASE}`);
  console.log(`Pages probed: ${results.pages.length} · ok/gated/redirect: ${pageOk} · bad: ${pageBad}`);
  console.log(`Public APIs: ${results.apis.filter((a) => a.ok).length}/${results.apis.length} ok`);
  console.log(
    `Process flows: ${results.processFlows.filter((f) => f.healthy).length}/${results.processFlows.length} healthy gates`,
  );
  console.log(`Dead hrefs: ${results.deadHrefs.length}`);
  console.log(`Errors: ${results.errors.length}`);
  console.log(`Warnings: ${results.warnings.length}`);
  if (results.errors.length) {
    console.log("\nERRORS:");
    for (const e of results.errors) console.log(`  • ${e}`);
  }
  if (results.warnings.length) {
    console.log("\nWARNINGS:");
    for (const w of results.warnings) console.log(`  • ${w}`);
  }
  console.log("=============================\n");

  const outPath = path.join(ROOT, "scripts/.site-loop-sweep-latest.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify({ base: BASE, at: new Date().toISOString(), ...results }, null, 2),
  );
  console.log(`Wrote ${outPath}`);

  process.exit(results.errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
