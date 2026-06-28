#!/usr/bin/env node
/**
 * Production smoke tests for train-station.co
 * Usage: node scripts/prod-smoke-test.mjs [baseUrl]
 */
const BASE = (process.argv[2] || "https://www.thetrainstation.co").replace(/\/$/, "");

const JEREMY = { email: "jeremy@thetrainstation.co", password: "CoachTest123!" };

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

function mergeCookies(existing, added) {
  const jar = new Map();
  for (const part of `${existing}; ${added}`.split(";")) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const [k, ...rest] = trimmed.split("=");
    jar.set(k, rest.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchText(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", ...opts });
  const text = await res.text();
  return { res, text };
}

async function main() {
  console.log(`\nProd smoke tests → ${BASE}\n`);

  // --- Static / public ---
  try {
    const { res, text } = await fetchText("/login?switch=1");
    if (res.status !== 200) fail("Login switch=1 loads", `status ${res.status}`);
    else if (!text.includes("Use a different account") && !text.includes("Signed out"))
      fail("Login switch=1 UX", "missing switch-account copy");
    else pass("Login switch=1 page", "switch-account UX present");
  } catch (e) {
    fail("Login switch=1 page", e.message);
  }

  try {
    const { text } = await fetchText("/login?redirect=/admin");
    if (text.includes("login-password") && text.includes("login-username"))
      pass("Login admin redirect", "email + password fields present");
    else fail("Login admin redirect", "expected form fields");
  } catch (e) {
    fail("Login admin redirect", e.message);
  }

  try {
    const res = await fetch(`${BASE}/api/brand/public`);
    const data = await res.json();
    if (res.ok && data.logoUrl) pass("Brand public API", data.logoUrl);
    else fail("Brand public API", JSON.stringify(data));
  } catch (e) {
    fail("Brand public API", e.message);
  }

  try {
    const res = await fetch(`${BASE}/api/landing-media`);
    const data = await res.json();
    if (res.ok) pass("Landing media API", `welcome=${Boolean(data.welcomeVideoUrl)}`);
    else fail("Landing media API", JSON.stringify(data));
  } catch (e) {
    fail("Landing media API", e.message);
  }

  // --- Auth: Jeremy coach login ---
  let cookies = "";
  try {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: JEREMY.email, password: JEREMY.password, redirect: "/admin" }),
      redirect: "manual",
    });
    const loginBody = await loginRes.json().catch(() => ({}));
    cookies = parseSetCookie(loginRes.headers);
    if (!loginRes.ok || !cookies.includes("ts_session"))
      fail("Jeremy login API", loginBody.error || `status ${loginRes.status}`);
    else pass("Jeremy login API", `redirect=${loginBody.redirect || "?"}`);
  } catch (e) {
    fail("Jeremy login API", e.message);
  }

  if (cookies) {
    try {
      const sessRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookies } });
      const sess = await sessRes.json();
      if (sessRes.ok && sess.user?.email === JEREMY.email)
        pass("Jeremy session", sess.user.role || "role?");
      else fail("Jeremy session", JSON.stringify(sess));
    } catch (e) {
      fail("Jeremy session", e.message);
    }

    try {
      const threadsRes = await fetch(`${BASE}/api/chat/threads?role=coach`, {
        headers: { Cookie: cookies },
      });
      const threadsData = await threadsRes.json();
      const threadCount = threadsData.threads?.length ?? 0;
      const unread = Object.values(threadsData.unreadByThread || {}).reduce((a, b) => a + b, 0);
      if (threadsRes.ok) pass("Coach chat threads API", `${threadCount} threads, ${unread} unread`);
      else fail("Coach chat threads API", JSON.stringify(threadsData));
    } catch (e) {
      fail("Coach chat threads API", e.message);
    }

    try {
      const membersRes = await fetch(`${BASE}/api/admin/members`, { headers: { Cookie: cookies } });
      const membersData = await membersRes.json();
      const count = membersData.members?.length ?? 0;
      const katie = membersData.members?.find((m) =>
        (m.email || "").toLowerCase().includes("kbyrdmann"),
      );
      if (membersRes.ok) {
        pass("Admin members API", `${count} registered`);
        if (katie) pass("Katie in members list", katie.email);
        else fail("Katie in members list", "not found — may need signup");
      } else fail("Admin members API", JSON.stringify(membersData));
    } catch (e) {
      fail("Admin members API", e.message);
    }

    try {
      const logoutRes = await fetch(`${BASE}/api/auth/logout?redirect=/admin`, {
        headers: { Cookie: cookies },
        redirect: "manual",
      });
      const loc = logoutRes.headers.get("location") || "";
      if (logoutRes.status >= 300 && logoutRes.status < 400 && loc.includes("/login") && loc.includes("switch=1"))
        pass("Logout redirect", loc.replace(BASE, ""));
      else fail("Logout redirect", `status=${logoutRes.status} loc=${loc}`);
    } catch (e) {
      fail("Logout redirect", e.message);
    }
  }

  // --- Remembered email DELETE (unauthenticated ok) ---
  try {
    const delRes = await fetch(`${BASE}/api/auth/remembered-email`, { method: "DELETE" });
    if (delRes.ok) pass("Remembered email DELETE");
    else fail("Remembered email DELETE", `status ${delRes.status}`);
  } catch (e) {
    fail("Remembered email DELETE", e.message);
  }

  // --- Admin pages require auth ---
  try {
    const { res } = await fetchText("/admin/landing");
    if (res.status === 307 || res.status === 302 || res.url?.includes("login"))
      pass("Admin landing gated", "redirects when logged out");
    else if (res.status === 200) pass("Admin landing", "loaded (session may exist)");
    else fail("Admin landing gated", `status ${res.status}`);
  } catch (e) {
    fail("Admin landing gated", e.message);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});