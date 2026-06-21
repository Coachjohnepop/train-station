#!/usr/bin/env node
/**
 * Chunk 1 member journey smoke test — signup, onboard, equipment, reminders.
 *
 * API/backend flows are fully automated. Client-only UI copy is checked by
 * scanning linked Next.js JS bundles (not initial HTML — those pages are
 * "use client"). See MANUAL_STEPS below for phone-only checks.
 *
 * Usage:
 *   node scripts/chunk1-member-flow-test.mjs
 *   BASE_URL=https://www.thetrainstation.co node scripts/chunk1-member-flow-test.mjs
 */

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const MARKER = `QA-CHUNK1-${Date.now()}`;
const EMAIL = `chunk1-${MARKER.toLowerCase()}@example.com`;
const WAITLIST_EMAIL = `chunk1-wait-${MARKER.toLowerCase()}@example.com`;

const MANUAL_STEPS = [
  "Landing → ticket → signup on phone (plan=member)",
  "Onboard wizard: scroll time picker on step 5",
  "Step 6 heading: “Book your first session with your trainer, Jeremy”",
  "Equipment step: toggle bodyweight only, refresh — stays checked",
];

const results = [];
let cookies = "";

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, redirect: opts.redirect ?? "follow" });
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) {
    const jar = Object.fromEntries(
      (cookies ? cookies.split("; ").map((p) => p.split("=")) : []).filter(([k]) => k),
    );
    for (const raw of setCookie) {
      const part = raw.split(";")[0];
      const [k, ...v] = part.split("=");
      jar[k] = v.join("=");
    }
    cookies = Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text, cookies };
}

function hasCookie(name) {
  return cookies.split("; ").some((p) => p.startsWith(`${name}=`) && !p.endsWith("="));
}

function chunkUrlsFromHtml(html) {
  return [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]))];
}

async function pageBundleContains(path, needles, { useCookies = false, redirect = "follow" } = {}) {
  const headers = {};
  if (useCookies && cookies) headers.Cookie = cookies;
  const pageRes = await fetch(`${BASE}${path}`, { headers, redirect });
  const html = await pageRes.text();
  const chunks = chunkUrlsFromHtml(html);
  const found = new Set();
  for (const chunk of chunks) {
    const js = await (await fetch(`${BASE}${chunk}`)).text();
    for (const needle of needles) {
      if (js.includes(needle)) found.add(needle);
    }
    if (found.size === needles.length) break;
  }
  return { status: pageRes.status, chunks: chunks.length, found: [...found], html };
}

async function testSignupPages() {
  console.log("\n=== A. Signup pages (register vs waitlist) ===");

  const ticket = await pageBundleContains("/signup?plan=member", [
    "Create your account",
    "Continue to setup",
  ]);
  if (ticket.status === 200) pass("Ticket signup page loads", `HTTP ${ticket.status}`);
  else fail("Ticket signup page", `HTTP ${ticket.status}`);

  if (ticket.found.includes("Create your account")) pass("Ticket signup → create account (bundle)");
  else fail("Ticket signup copy", `not in ${ticket.chunks} chunks`);

  if (ticket.found.includes("Continue to setup")) pass("Ticket signup CTA (bundle)");
  else fail("Ticket signup CTA", "expected Continue to setup in bundle");

  const interest = await pageBundleContains("/signup?interest=stretching", ["Join the waitlist"]);
  if (interest.found.includes("Join the waitlist")) pass("Interest signup → waitlist (bundle)");
  else fail("Interest signup copy", "expected Join the waitlist in bundle");

  if (!interest.found.includes("Create your account")) pass("Interest signup is not register flow");
  else fail("Interest signup mode", "register copy present on interest URL");
}

async function testWaitlistApi() {
  console.log("\n=== B. Waitlist API (interest-only path) ===");

  const { res, body } = await req("/api/signup/waitlist", {
    method: "POST",
    json: {
      email: WAITLIST_EMAIL,
      firstName: "Wait",
      lastName: "List",
      plan: "stretching",
      source: "interest:stretching",
    },
  });

  if (res.ok && body?.success && body?.redirectTo?.includes("/coming-soon")) {
    pass("Waitlist API", body.redirectTo);
  } else {
    fail("Waitlist API", `${res.status} ${JSON.stringify(body)}`);
  }
}

async function testRegisterAndSession() {
  console.log("\n=== C. Register + session ===");

  const { res, body } = await req("/api/signup/register", {
    method: "POST",
    json: {
      email: EMAIL,
      firstName: "Chunk",
      lastName: "One",
      phone: "5558675309",
      plan: "member",
    },
  });

  if (res.ok && body?.redirectTo?.includes("/member/onboard")) {
    pass("Register API", body.redirectTo);
  } else {
    fail("Register API", `${res.status} ${JSON.stringify(body)}`);
    return false;
  }

  if (hasCookie("ts_session")) pass("Session cookie set");
  else fail("Session cookie", "ts_session missing");

  if (hasCookie("ts_needs_onboard")) pass("Needs-onboard cookie set");
  else fail("Needs-onboard cookie", "ts_needs_onboard missing");

  const { body: status } = await req("/api/member/onboarding-status");
  if (status?.needsOnboarding === true && status?.plan === "member") {
    pass("Onboarding status", "needs setup");
  } else {
    fail("Onboarding status", JSON.stringify(status));
  }

  return true;
}

async function testOnboardRedirect() {
  console.log("\n=== D. Middleware onboard gate + onboard UI bundles ===");

  const { res } = await req("/member", { redirect: "manual" });
  if (res.status === 307 || res.status === 308) {
    const loc = res.headers.get("location") || "";
    if (loc.includes("/member/onboard")) pass("Dashboard gated → onboard", loc);
    else fail("Dashboard redirect", loc);
  } else {
    fail("Dashboard gate", `expected 307, got ${res.status}`);
  }

  const onboard = await pageBundleContains(
    "/member/onboard?plan=member",
    [
      "Book your first session with your trainer, Jeremy",
      "Reminder time",
      "Reminder hour",
    ],
    { useCookies: true },
  );

  if (onboard.status === 200) pass("Onboard page loads with session", `${onboard.chunks} chunks`);
  else fail("Onboard page", `HTTP ${onboard.status} (auth required)`);

  if (onboard.found.includes("Book your first session with your trainer, Jeremy")) {
    pass("Onboard step 6 copy names Jeremy (bundle)");
  } else {
    fail("Onboard Jeremy copy", "heading not found in authenticated bundles");
  }

  if (onboard.found.includes("Reminder time") && onboard.found.includes("Reminder hour")) {
    pass("Time scroll picker present (bundle)", "Reminder time + hour labels");
  } else {
    fail("Time scroll picker", `found: ${onboard.found.join(", ")}`);
  }
}

async function testEquipmentPersistence() {
  console.log("\n=== E. Home equipment save ===");

  const { body: get1 } = await req("/api/equipment");
  const list = get1?.equipment;
  if (!Array.isArray(list) || list.length === 0) {
    fail("Equipment catalog", "empty");
    return;
  }
  pass("Equipment catalog", `${list.length} items`);

  const bodyweight = list.find((e) => e.id === "eq-bodyweightonly");
  if (bodyweight && bodyweight.hasAtHome === false) {
    pass("New member starts unchecked", "bodyweight off");
  } else if (bodyweight?.hasAtHome) {
    fail("New member defaults", "bodyweight already on (demo bleed?)");
  }

  const payload = list.map((e) => ({
    equipmentId: e.id,
    hasAtHome: e.id === "eq-bodyweightonly",
    quantity: 1,
  }));

  const { res: saveRes, body: saveBody } = await req("/api/equipment", {
    method: "POST",
    json: { equipment: payload },
  });
  if (!saveRes.ok) {
    fail("Equipment save", `${saveRes.status}`);
    return;
  }

  const saved = saveBody?.equipment || [];
  const bw = saved.find((e) => e.id === "eq-bodyweightonly");
  const othersOn = saved.filter((e) => e.id !== "eq-bodyweightonly" && e.hasAtHome);

  if (bw?.hasAtHome && othersOn.length === 0) {
    pass("Equipment save", "bodyweight only");
  } else {
    fail("Equipment save", `bw=${bw?.hasAtHome}, othersOn=${othersOn.length}`);
  }

  const { body: get2 } = await req("/api/equipment");
  const bw2 = get2?.equipment?.find((e) => e.id === "eq-bodyweightonly");
  const othersOn2 = (get2?.equipment || []).filter(
    (e) => e.id !== "eq-bodyweightonly" && e.hasAtHome,
  );

  if (bw2?.hasAtHome && othersOn2.length === 0) {
    pass("Equipment persists after refresh", "bodyweight only");
  } else {
    fail("Equipment persistence", `bw=${bw2?.hasAtHome}, othersOn=${othersOn2.length}`);
  }
}

async function testOnboardProgressAndComplete() {
  console.log("\n=== F. Onboard progress + finish ===");

  const { res: progRes } = await req("/api/member/onboard-progress", {
    method: "PATCH",
    json: {
      phone: "5558675309",
      dailyReminderTime: "07:30",
      weightLbs: "180",
      city: "Austin",
      state: "TX",
    },
  });
  if (progRes.ok) pass("Onboard progress PATCH");
  else fail("Onboard progress PATCH", String(progRes.status));

  const { res: doneRes, body: doneBody } = await req("/api/onboard/complete", {
    method: "POST",
    json: {
      phone: "5558675309",
      dailyReminderTime: "07:30",
      measurements: { weight: "180", notes: MARKER },
      location: { city: "Austin", state: "TX" },
      calendlyOpened: true,
      plan: "member",
    },
  });
  if (doneRes.ok && doneBody?.success) pass("Onboard complete");
  else fail("Onboard complete", `${doneRes.status} ${JSON.stringify(doneBody)}`);

  if (!hasCookie("ts_needs_onboard") || cookies.includes("ts_needs_onboard=;")) {
    pass("Needs-onboard cookie cleared");
  } else {
    fail("Needs-onboard cookie", "still set after complete");
  }

  const { body: status } = await req("/api/member/onboarding-status");
  if (status?.needsOnboarding === false) pass("Onboarding marked complete");
  else fail("Onboarding complete flag", JSON.stringify(status));

  const { res: dashRes } = await req("/member", { redirect: "manual" });
  if (dashRes.status === 200) pass("Dashboard accessible after onboard");
  else if (dashRes.status === 307) fail("Dashboard still gated", dashRes.headers.get("location"));
  else fail("Dashboard", `HTTP ${dashRes.status}`);

  const { body: reminders } = await req("/api/member/reminder-settings");
  if (reminders?.phone && reminders?.dailyReminderTime === "07:30") {
    pass("Reminder settings persisted", reminders.dailyReminderTime);
  } else {
    fail("Reminder settings", JSON.stringify(reminders));
  }
}

async function testDuplicateRegister() {
  console.log("\n=== G. Duplicate register ===");

  const { res, body } = await req("/api/signup/register", {
    method: "POST",
    json: {
      email: EMAIL,
      firstName: "Dup",
      lastName: "Test",
      plan: "explorer",
    },
  });
  if (res.status === 409) pass("Duplicate email rejected");
  else fail("Duplicate register", `expected 409, got ${res.status} ${JSON.stringify(body)}`);
}

async function main() {
  console.log(`Chunk 1 member flow test → ${BASE}`);
  console.log(`Test email: ${EMAIL}`);
  console.log(`Waitlist email: ${WAITLIST_EMAIL}\n`);

  try {
    await testSignupPages();
    await testWaitlistApi();
    const registered = await testRegisterAndSession();
    if (registered) {
      await testOnboardRedirect();
      await testEquipmentPersistence();
      await testOnboardProgressAndComplete();
      await testDuplicateRegister();
    }
  } catch (e) {
    fail("Unhandled error", e.message);
    console.error(e);
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== Summary ===");
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }

  console.log("\n=== Manual checks (phone) ===");
  for (const step of MANUAL_STEPS) console.log(`  • ${step}`);
}

main();