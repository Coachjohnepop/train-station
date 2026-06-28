#!/usr/bin/env node
/**
 * Feature smoke: messages, logout switch, landing media (authenticated).
 */
const BASE = (process.argv[2] || "https://www.thetrainstation.co").replace(/\/$/, "");
const MEMBER = { email: "coachjohnepop@yahoo.com", password: "TestPass123!" };

let cookies = "";
const results = [];
const pass = (n, d = "") => { results.push({ ok: true, name: n, detail: d }); console.log(`✅ ${n}${d ? ` — ${d}` : ""}`); };
const fail = (n, d = "") => { results.push({ ok: false, name: n, detail: d }); console.log(`❌ ${n}${d ? ` — ${d}` : ""}`); };

function mergeSetCookie(raw) {
  const jar = Object.fromEntries(cookies.split("; ").filter(Boolean).map((p) => p.split("=")));
  for (const c of raw) {
    const part = c.split(";")[0];
    const [k, ...v] = part.split("=");
    jar[k] = v.join("=");
  }
  cookies = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Cookie: cookies, ...(opts.headers || {}) },
    body: opts.json ? JSON.stringify(opts.json) : opts.body,
    redirect: "manual",
  });
  mergeSetCookie(res.headers.getSetCookie?.() || []);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { res, body };
}

async function login(email, password) {
  cookies = "";
  const { res, body } = await api("/api/auth/login", {
    method: "POST",
    json: { email, password },
  });
  return res.ok && body?.ok;
}

async function main() {
  console.log(`\nFeature tests → ${BASE}\n`);

  if (!(await login(MEMBER.email, MEMBER.password))) {
    fail("Member login");
    process.exit(1);
  }
  pass("Member login");

  const threads = await api("/api/chat/threads?role=member");
  if (!threads.res.ok) fail("Member chat threads", threads.body?.error);
  else {
    const list = threads.body.threads || [];
    const direct = list.find((t) => t.kind === "member");
    pass("Member chat threads", `${list.length} threads`);
    if (direct) {
      const msg = `Prod test ping ${Date.now()}`;
      const sent = await api("/api/chat/reply", {
        method: "POST",
        json: { role: "member", threadId: direct.id, message: msg },
      });
      if (sent.res.ok && sent.body?.message?.body === msg) pass("Member sends coach message", msg.slice(0, 40));
      else fail("Member sends coach message", sent.body?.error || JSON.stringify(sent.body));
    } else fail("Member direct thread");
  }

  const onboard = await fetch(`${BASE}/member/onboard?plan=business`, { headers: { Cookie: cookies } });
  if (onboard.ok) pass("Onboard page loads for member");
  else fail("Onboard page", `HTTP ${onboard.status}`);

  const logout = await api("/api/auth/logout?redirect=/member");
  const loc = logout.res.headers.get("location") || "";
  if (logout.res.status >= 300 && loc.includes("switch=1")) pass("Logout switch redirect", loc.replace(BASE, ""));
  else fail("Logout switch redirect", `status=${logout.res.status} loc=${loc}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });