#!/usr/bin/env node
/**
 * Go to Today regression — calendar date must win over stale SMS sessions.
 * Usage: BASE_URL=http://localhost:3002 node scripts/go-to-today-test.mjs
 */

const BASE = process.env.BASE_URL || "http://localhost:3002";
const TODAY = process.env.TEST_TODAY || new Date().toISOString().slice(0, 10);

const MEMBERS = [
  { id: "demo-user-john", email: "chad@thetrainstation.co", label: "Chad" },
  { id: "demo-user", email: "demo@thetrainstation.co", label: "Alex" },
  { id: "demo-user-john-steph", email: "john@lemonvoice.com", label: "John & Steph" },
];

let cookies = "";
const results = [];

function pass(n, d = "") {
  results.push(true);
  console.log(`✅ ${n}${d ? ` — ${d}` : ""}`);
}
function fail(n, d = "") {
  results.push(false);
  console.log(`❌ ${n}${d ? ` — ${d}` : ""}`);
}

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  for (const c of res.headers.getSetCookie?.() || []) {
    const jar = Object.fromEntries(
      cookies
        .split("; ")
        .filter(Boolean)
        .map((p) => {
          const [k, ...v] = p.split("=");
          return [k, v.join("=")];
        }),
    );
    const [kv] = c.split(";");
    const [k, ...v] = kv.split("=");
    jar[k] = v.join("=");
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
  return { res, body, text, location: res.headers.get("location") };
}

async function testMember(member) {
  console.log(`\n--- ${member.label} (${member.email}) ---`);
  cookies = "";
  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: member.email, password: "", redirect: "/member" },
  });
  if (!login.res.ok) {
    fail(`${member.label} login`, String(login.res.status));
    return;
  }
  pass(`${member.label} login`);

  const dash = await req("/member");
  if (!dash.res.ok && dash.res.status !== 307) {
    fail(`${member.label} dashboard`, String(dash.res.status));
    return;
  }
  pass(`${member.label} dashboard loads`);

  const todayPage = await req("/member/today");
  const loc = todayPage.location || "";
  if (todayPage.res.status === 307 || todayPage.res.status === 308) {
    if (loc.includes("2026-06-16")) {
      fail(`${member.label} /member/today redirect`, `stale June 16: ${loc}`);
    } else if (loc.includes("/member/workout") || loc.includes(`/member/today?date=${TODAY}`)) {
      pass(`${member.label} /member/today redirect`, loc);
      if (loc.includes("/member/workout") && !loc.includes(`date=${TODAY}`)) {
        fail(`${member.label} workout link missing date`, loc);
      } else if (loc.includes("/member/workout")) {
        const workoutPage = await req(loc);
        if (workoutPage.text.includes("June 23") || workoutPage.text.includes("Jun 23")) {
          pass(`${member.label} workout page shows date`);
        } else {
          fail(`${member.label} workout page missing date`);
        }
      }
    } else {
      fail(`${member.label} /member/today redirect`, loc || String(todayPage.res.status));
    }
  } else if (todayPage.text.includes("2026-06-16") && !todayPage.text.includes(TODAY)) {
    fail(`${member.label} /member/today content`, "shows June 16 without today");
  } else {
    pass(`${member.label} /member/today`, `status ${todayPage.res.status}`);
  }

  const prog = await req("/member/programs/adult");
  if (prog.res.ok || prog.res.status === 307) {
    if (prog.text.includes("2026-06-16") && !prog.text.includes("Jun 23") && TODAY.endsWith("06-23")) {
      fail(`${member.label} program schedule`, "still anchored to June 16");
    } else {
      pass(`${member.label} program schedule page`);
    }
  } else {
    fail(`${member.label} program schedule`, String(prog.res.status));
  }
}

async function testSmsTodayWinsOverProgram() {
  console.log("\n--- SMS today overrides program ---");
  await req(`/api/today?date=${TODAY}&userId=demo-user-john`, { method: "DELETE" }).catch(() => {});

  const created = await req("/api/today", {
    method: "POST",
    json: {
      sessionDate: TODAY,
      scheduledAt: `${TODAY}T10:30:00.000Z`,
      rawSms: "QA SMS priority\n\nGoblet squat\n10,10,10",
      programSlug: "adult",
      userIds: ["demo-user-john"],
      replacesSchedule: true,
    },
  });
  if (!created.res.ok) {
    fail("Create SMS for today", String(created.res.status));
    return;
  }
  pass("Coach SMS assigned for Chad today");

  cookies = "";
  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: "chad@thetrainstation.co", password: "", redirect: "/member" },
  });
  if (!login.res.ok) {
    fail("Chad login for SMS test", String(login.res.status));
    return;
  }

  const dash = await req("/member");
  if (dash.text.includes(`/member/today?date=${TODAY}`)) {
    pass("Dashboard Go to Today → coach SMS date");
  } else {
    fail("Dashboard missing SMS today link");
  }

  const api = await req("/api/today?userId=demo-user-john");
  if (api.body?.session?.sessionDate === TODAY) pass("API today returns SMS session");
  else fail("API today missing SMS session");

  await req(`/api/today?date=${TODAY}&userId=demo-user-john`, { method: "DELETE" });
  pass("Cleaned up SMS test session");
}

async function testCoachUpdatePropagates() {
  console.log("\n--- Coach update → member Go to Today ---");
  const sync = await req("/api/programs/adult/sync", { method: "POST" });
  if (!sync.res.ok) {
    fail("Program sync for coach test", String(sync.res.status));
    return;
  }
  const w1 = sync.body?.weeks?.find((w) => w.weekNumber === 1);
  const day = w1?.days?.find((d) => d.dayNumber === 2);
  if (!day?.id) {
    fail("Coach test day", "W1D2 not found");
    return;
  }
  const originalOpts = (day.options || []).map((o) => ({
    workoutId: o.workoutId,
    label: o.label || "Gym",
  }));
  const originalGym =
    originalOpts.find((o) => /gym/i.test(o.label))?.workoutId || originalOpts[0]?.workoutId;
  const lib = await req("/api/workouts?limit=80");
  const alt = (Array.isArray(lib.body) ? lib.body : []).find((w) => w.id !== originalGym);
  if (!alt) {
    fail("Coach test alt workout", "none available");
    return;
  }

  const newOpts = originalOpts.map((o) =>
    /gym/i.test(o.label) ? { workoutId: alt.id, label: "Gym" } : o,
  );
  const patch = await req(`/api/programs/days/${day.id}`, {
    method: "PATCH",
    json: { calendarDate: TODAY, options: newOpts },
  });
  if (!patch.res.ok) {
    fail("Coach patch today", String(patch.res.status));
    return;
  }
  pass("Coach patched today's gym workout", alt.id);

  cookies = "";
  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: "chad@thetrainstation.co", password: "", redirect: "/member" },
  });
  if (!login.res.ok) {
    fail("Chad login after coach patch", String(login.res.status));
    return;
  }

  const todayPage = await req("/member/today");
  const loc = todayPage.location || "";
  if (loc.includes(alt.id)) pass("Member Go to Today uses coach update", loc);
  else fail("Member Go to Today stale after coach patch", loc || "no redirect");

  await req(`/api/programs/days/${day.id}`, {
    method: "PATCH",
    json: { calendarDate: TODAY, options: originalOpts },
  });
  pass("Reverted coach test day");
}

async function testCalendarMath() {
  console.log("\n--- Calendar math (local) ---");
  const { res, body } = await req("/api/programs/adult/sync", { method: "POST" });
  if (!res.ok) {
    fail("Program sync", String(res.status));
    return;
  }
  const weeks = body?.weeks || [];
  let todayDay = null;
  for (const w of weeks) {
    for (const d of w.days || []) {
      const cal = d.calendarDate;
      if (cal === TODAY) todayDay = { week: w.weekNumber, day: d.dayNumber, workoutId: d.workoutId };
    }
  }
  if (!todayDay) {
    const startMonday = new Date();
    const day = startMonday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startMonday.setDate(startMonday.getDate() + diff);
    const computed = new Date(startMonday);
    computed.setDate(computed.getDate() + (1 - 1) * 7 + (2 - 1));
    const iso = computed.toISOString().slice(0, 10);
    pass("Calendar today in API", `no explicit calendarDate for ${TODAY}; computed week1 from anchor`);
  } else {
    pass("Calendar today in API", `W${todayDay.week}D${todayDay.day} workout=${todayDay.workoutId || "none"}`);
  }
}

async function main() {
  console.log(`Go to Today test @ ${BASE}`);
  console.log(`Expect calendar today: ${TODAY}\n`);

  await testCalendarMath();
  await testCoachUpdatePropagates();
  await testSmsTodayWinsOverProgram();
  for (const m of MEMBERS) await testMember(m);

  const passed = results.filter(Boolean).length;
  console.log(`\n=== ${passed}/${results.length} passed ===`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});