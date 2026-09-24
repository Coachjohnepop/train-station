"use client";

import { useCallback, useEffect, useState } from "react";
import { calculateCommissionRate, COMMISSION_MAX_DISCOUNT, COMMISSION_POOL } from "@/lib/affiliate/commission";
import { useRouter, useSearchParams } from "next/navigation";
import TrainStationBrand from "@/components/TrainStationBrand";
import { BRAND_NAME } from "@/lib/brand";

type Conversion = {
  id: string;
  plan: string | null;
  orderSubtotalCents: number;
  commissionCents: number;
  commissionRate: number;
  status: string;
  createdAt: string;
};

type DiscountCode = {
  id: string;
  code: string;
  discountPercent: number;
  commissionRate: number;
  usageCount: number;
  isActive: boolean;
};

type Payout = {
  id: string;
  amountCents: number;
  status: string;
  createdAt: string;
  processedAt: string | null;
};

type Me = {
  name: string;
  email: string;
  referralCode: string;
  commissionRate: number;
  status: string;
  totalClicks: number;
  totalOrders: number;
  totalRevenueCents: number;
  totalCommissionCents: number;
  pendingBalanceCents: number;
  stripeOnboarded: boolean;
  hasStripeAccount: boolean;
  joinUrl: string;
  conversions: Conversion[];
  codes: DiscountCode[];
  payouts: Payout[];
};

type Month = {
  month: string;
  revenueCents: number;
  commissionCents: number;
  orders: number;
  clicks: number;
};

type DeskAffiliate = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  status: string;
  pendingBalanceCents: number;
  totalOrders: number;
  stripeOnboarded: boolean;
};

type DeskPayout = {
  id: string;
  amountCents: number;
  affiliate: { name: string; email: string; referralCode: string };
};

type Tab = "dashboard" | "earnings" | "links" | "payouts" | "settings";

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export default function AffiliatePortal() {
  const router = useRouter();
  const search = useSearchParams();
  const view = search.get("view") || "";
  const token = search.get("token") || "";
  const tab = (search.get("tab") as Tab) || "dashboard";

  const [me, setMe] = useState<Me | null>(null);
  const [months, setMonths] = useState<Month[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [desk, setDesk] = useState<{ affiliates: DeskAffiliate[]; payouts: DeskPayout[] } | null>(null);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/affiliate/me", { cache: "no-store" });
    if (!res.ok) {
      setMe(null);
      return;
    }
    setMe((await res.json()) as Me);
    const monthly = await fetch("/api/affiliate/earnings/monthly", { cache: "no-store" });
    if (monthly.ok) {
      const body = (await monthly.json()) as { months: Month[] };
      setMonths(body.months || []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (search.get("stripe") === "return" || search.get("stripe") === "refresh") {
        await fetch("/api/affiliate/stripe/connect", { cache: "no-store" });
      }
      await loadMe();
      const deskRes = await fetch("/api/affiliate/desk", { cache: "no-store" });
      if (!cancelled && deskRes.ok) {
        setDesk((await deskRes.json()) as { affiliates: DeskAffiliate[]; payouts: DeskPayout[] });
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe, search]);

  function go(next: { view?: string; tab?: string; token?: string }) {
    const params = new URLSearchParams();
    const nextView = next.view ?? (next.tab ? "" : view);
    const nextTab = next.tab ?? "";
    if (nextView) params.set("view", nextView);
    if (nextTab) params.set("tab", nextTab);
    if (next.token) params.set("token", next.token);
    const q = params.toString();
    router.replace(q ? `/affiliate?${q}` : "/affiliate");
    setError(null);
    setNotice(null);
  }

  async function signOut() {
    await fetch("/api/affiliate/auth", { method: "DELETE" });
    setMe(null);
    go({ view: "" });
  }

  if (!ready) {
    return <main className="min-h-screen bg-[var(--bg)]" />;
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-start justify-between gap-4 pr-12">
          <div className="flex items-center gap-3">
            <TrainStationBrand variant="header" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-[var(--accent)]">{BRAND_NAME}</p>
              <h1 className="text-2xl font-bold">Affiliate</h1>
            </div>
          </div>
          {me ? (
            <button type="button" className="text-sm text-[var(--muted)] underline" onClick={() => void signOut()}>
              Sign out
            </button>
          ) : null}
        </header>

        {me ? (
          <SignedIn
            me={me}
            months={months}
            tab={tab}
            error={error}
            notice={notice}
            busy={busy}
            setError={setError}
            setNotice={setNotice}
            setBusy={setBusy}
            onTab={(next) => go({ tab: next })}
            reload={loadMe}
          />
        ) : (
          <SignedOut
            view={view === "signup" || view === "forgot" || view === "reset" ? view : "login"}
            token={token}
            error={error}
            notice={notice}
            busy={busy}
            setError={setError}
            setNotice={setNotice}
            setBusy={setBusy}
            onView={(next) => go({ view: next === "login" ? "" : next, token: next === "reset" ? token : "" })}
            onSignedIn={async () => {
              await loadMe();
              go({ view: "" });
            }}
          />
        )}

        {desk ? <StaffDesk desk={desk} onChange={async () => {
          const deskRes = await fetch("/api/affiliate/desk", { cache: "no-store" });
          if (deskRes.ok) setDesk((await deskRes.json()) as { affiliates: DeskAffiliate[]; payouts: DeskPayout[] });
        }} /> : null}
      </div>
    </main>
  );
}

function CompPlanTable() {
  const rows = [0, 0.05, 0.1, 0.15, 0.2, COMMISSION_MAX_DISCOUNT];
  return (
    <div className="space-y-2 text-sm">
      <p>
        A discount code shares a {Math.round(COMMISSION_POOL * 100)}% pool. The customer’s discount comes out of that pool. You still earn at least 5% until the discount hits {Math.round(COMMISSION_MAX_DISCOUNT * 100)}%.
      </p>
      <table className="w-full text-left">
        <thead className="text-[var(--muted)]">
          <tr>
            <th className="py-1">Customer discount</th>
            <th className="py-1 text-right">You earn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((discount) => (
            <tr key={discount} className="border-t border-[var(--border)]">
              <td className="py-1">{discount === 0 ? "No discount (referral link pool)" : `${Math.round(discount * 100)}% off`}</td>
              <td className="py-1 text-right font-semibold tabular-nums">{Math.round(calculateCommissionRate(discount) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-[var(--muted)]">
        A personal rate on your account, such as 5% for the first six months, applies to your plain referral link. This table is what a discount code pays.
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "input w-full";
const buttonClass = "btn-primary px-4 py-2 text-sm disabled:opacity-60";

function SignedOut(props: {
  view: "login" | "signup" | "forgot" | "reset";
  token: string;
  error: string | null;
  notice: string | null;
  busy: boolean;
  setError: (value: string | null) => void;
  setNotice: (value: string | null) => void;
  setBusy: (value: boolean) => void;
  onView: (view: "login" | "signup" | "forgot" | "reset") => void;
  onSignedIn: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const view = props.view === "signup" ? "login" : props.view;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    props.setBusy(true);
    props.setError(null);
    props.setNotice(null);
    try {
      if (view === "login") {
        const res = await fetch("/api/affiliate/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          props.setError(body.error || "Could not sign in.");
          return;
        }
        await props.onSignedIn();
        return;
      }
      if (view === "forgot") {
        const res = await fetch("/api/affiliate/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!res.ok) {
          props.setError(body.error || "Could not send the reset email.");
          return;
        }
        props.setNotice(body.message || "Check your email.");
        return;
      }
      const res = await fetch("/api/affiliate/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        props.setError(body.error || "Could not reset the password.");
        return;
      }
      props.setNotice(body.message || "Password updated.");
      props.onView("login");
    } finally {
      props.setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex gap-3 text-sm">
        <button type="button" className="font-semibold" onClick={() => props.onView("login")}>
          Sign in
        </button>
      </div>
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        {view !== "reset" ? (
          <Field label="Email">
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
        ) : null}
        {props.view !== "forgot" ? (
          <Field label={view === "reset" ? "New password" : "Password"}>
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={view === "login" ? 1 : 8} />
          </Field>
        ) : null}
        {props.error ? <p className="text-sm text-red-400">{props.error}</p> : null}
        {props.notice ? <p className="text-sm text-[var(--muted)]">{props.notice}</p> : null}
        <button className={buttonClass} type="submit" disabled={props.busy}>
          {view === "login" ? "Sign in" : view === "forgot" ? "Send reset link" : "Save password"}
        </button>
      </form>
      {view === "login" ? (
        <button type="button" className="mt-3 text-sm text-[var(--muted)] underline" onClick={() => props.onView("forgot")}>
          Forgot password
        </button>
      ) : null}
    </section>
  );
}

function SignedIn(props: {
  me: Me;
  months: Month[];
  tab: Tab;
  error: string | null;
  notice: string | null;
  busy: boolean;
  setError: (value: string | null) => void;
  setNotice: (value: string | null) => void;
  setBusy: (value: boolean) => void;
  onTab: (tab: Tab) => void;
  reload: () => Promise<void>;
}) {
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "dashboard", label: "Dashboard" },
    { id: "earnings", label: "Earnings" },
    { id: "links", label: "Links" },
    { id: "payouts", label: "Payouts" },
    { id: "settings", label: "Settings" },
  ];
  const live = props.me.status === "ACTIVE";

  return (
    <div className="space-y-4">
      {props.me.status !== "ACTIVE" ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
          This account is {props.me.status.toLowerCase()}. The referral link starts counting after approval.
        </p>
      ) : null}
      <nav className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => props.onTab(item.id)}
            className={`rounded-full px-3 py-1 text-sm ${props.tab === item.id ? "bg-[var(--accent)] text-[var(--on-accent)]" : "border border-[var(--border)] text-[var(--muted)]"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {props.error ? <p className="text-sm text-red-400">{props.error}</p> : null}
      {props.notice ? <p className="text-sm text-[var(--muted)]">{props.notice}</p> : null}
      {props.tab === "dashboard" ? <Dashboard me={props.me} /> : null}
      {props.tab === "earnings" ? <Earnings me={props.me} months={props.months} /> : null}
      {props.tab === "links" ? (
        <Links me={props.me} live={live} busy={props.busy} setBusy={props.setBusy} setError={props.setError} setNotice={props.setNotice} reload={props.reload} />
      ) : null}
      {props.tab === "payouts" ? (
        <Payouts me={props.me} busy={props.busy} setBusy={props.setBusy} setError={props.setError} setNotice={props.setNotice} reload={props.reload} />
      ) : null}
      {props.tab === "settings" ? (
        <Settings me={props.me} busy={props.busy} setBusy={props.setBusy} setError={props.setError} setNotice={props.setNotice} reload={props.reload} />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Dashboard({ me }: { me: Me }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <Stat label="Clicks" value={String(me.totalClicks)} />
      <Stat label="Paid memberships" value={String(me.totalOrders)} />
      <Stat label="Membership revenue" value={money(me.totalRevenueCents)} />
      <Stat label="Commission" value={money(me.totalCommissionCents)} />
      <Stat label="Waiting to pay" value={money(me.pendingBalanceCents)} />
      <Stat label="Your rate" value={percent(me.commissionRate)} />
    </section>
  );
}

function Earnings({ me, months }: { me: Me; months: Month[] }) {
  return (
    <section className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Clicks</th>
              <th className="px-3 py-2">Seats</th>
              <th className="px-3 py-2">Commission</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.month} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">{month.month}</td>
                <td className="px-3 py-2">{month.clicks}</td>
                <td className="px-3 py-2">{month.orders}</td>
                <td className="px-3 py-2">{money(month.commissionCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2">
        {me.conversions.length === 0 ? <li className="text-sm text-[var(--muted)]">No paid memberships yet.</li> : null}
        {me.conversions.map((row) => (
          <li key={row.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
            <span className="font-medium">{money(row.commissionCents)}</span>
            <span className="text-[var(--muted)]">
              {" "}
              on {money(row.orderSubtotalCents)} · {row.plan || "membership"} · {row.status.toLowerCase()} ·{" "}
              {new Date(row.createdAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Links(props: {
  me: Me;
  live: boolean;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
  setNotice: (value: string | null) => void;
  reload: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState<0.05 | 0.1>(0.1);

  async function createCode(event: React.FormEvent) {
    event.preventDefault();
    props.setBusy(true);
    props.setError(null);
    try {
      const res = await fetch("/api/affiliate/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, discountPercent: discount }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        props.setError(body.error || "Could not create that code.");
        return;
      }
      setCode("");
      props.setNotice("Discount code is live on checkout.");
      await props.reload();
    } finally {
      props.setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm text-[var(--muted)]">Referral link</p>
        <p className="mt-1 break-all font-medium">{props.me.joinUrl}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Code {props.me.referralCode} · {percent(props.me.commissionRate)} when someone pays.
          {props.live ? "" : " Counting starts after approval."}
        </p>
        <button
          type="button"
          className={`${buttonClass} mt-3`}
          onClick={() => void navigator.clipboard.writeText(props.me.joinUrl).then(() => props.setNotice("Link copied."))}
        >
          Copy link
        </button>
      </div>
      <form className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" onSubmit={(event) => void createCode(event)}>
        <CompPlanTable />
        <Field label="Discount code">
          <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} required />
        </Field>
        <Field label="Member discount">
          <select className={inputClass} value={String(discount)} onChange={(e) => setDiscount(e.target.value === "0.05" ? 0.05 : 0.1)}>
            <option value="0.1">10% off · you earn 10%</option>
            <option value="0.05">5% off · you earn 15%</option>
          </select>
        </Field>
        <button className={buttonClass} type="submit" disabled={props.busy || !props.live}>
          Create code
        </button>
      </form>
      <ul className="space-y-2">
        {props.me.codes.map((row) => (
          <li key={row.id} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">
            {row.code} · {percent(row.discountPercent)} off · you earn {percent(row.commissionRate)} · used {row.usageCount}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Payouts(props: {
  me: Me;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
  setNotice: (value: string | null) => void;
  reload: () => Promise<void>;
}) {
  async function requestPayout() {
    props.setBusy(true);
    props.setError(null);
    try {
      const res = await fetch("/api/affiliate/payout", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; amountCents?: number };
      if (!res.ok) {
        props.setError(body.error || "Could not request a payout.");
        return;
      }
      props.setNotice(`Sent ${money(body.amountCents || 0)} to Stripe.`);
      await props.reload();
    } finally {
      props.setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        Waiting balance {money(props.me.pendingBalanceCents)}. Connect Stripe, then request a payout once it reaches $50. The transfer goes to that connected account.
      </p>
      <button
        className={buttonClass}
        type="button"
        disabled={props.busy}
        onClick={() => {
          props.setBusy(true);
          props.setError(null);
          void fetch("/api/affiliate/stripe/connect", { method: "POST" })
            .then(async (res) => {
              const body = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
              if (!res.ok || !body.url) {
                props.setError(body.error || "Could not open Stripe.");
                return;
              }
              window.location.href = body.url;
            })
            .finally(() => props.setBusy(false));
        }}
      >
        {props.me.stripeOnboarded ? "Open Stripe" : "Connect Stripe"}
      </button>
      <button className={buttonClass} type="button" disabled={props.busy || !props.me.stripeOnboarded || props.me.pendingBalanceCents < 5000} onClick={() => void requestPayout()}>
        Request payout
      </button>
      <ul className="space-y-2">
        {props.me.payouts.map((row) => (
          <li key={row.id} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">
            {money(row.amountCents)} · {row.status.toLowerCase()} · {new Date(row.createdAt).toLocaleDateString()}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Settings(props: {
  me: Me;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
  setNotice: (value: string | null) => void;
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState(props.me.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    props.setBusy(true);
    props.setError(null);
    try {
      const res = await fetch("/api/affiliate/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        props.setError(body.error || "Could not save.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      props.setNotice("Saved.");
      await props.reload();
    } finally {
      props.setBusy(false);
    }
  }

  return (
    <form className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" onSubmit={(event) => void save(event)}>
      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Email">
        <input className={inputClass} value={props.me.email} disabled />
      </Field>
      <Field label="Current password">
        <input className={inputClass} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </Field>
      <Field label="New password">
        <input className={inputClass} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
      </Field>
      <button className={buttonClass} type="submit" disabled={props.busy}>
        Save
      </button>
    </form>
  );
}

function StaffDesk(props: {
  desk: { affiliates: DeskAffiliate[]; payouts: DeskPayout[] };
  onChange: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  async function act(body: Record<string, string>) {
    setError(null);
    const res = await fetch("/api/affiliate/desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Could not update.");
      return;
    }
    await props.onChange();
  }

  return (
    <section className="mt-10 space-y-3 border-t border-[var(--border)] pt-6">
      <h2 className="text-lg font-semibold">{BRAND_NAME} desk</h2>
      <p className="text-sm text-[var(--muted)]">Visible because this browser is signed in as staff. Approving turns the referral link on. Pay with Stripe sends the unpaid commission to their connected account.</p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <ul className="space-y-2">
        {props.desk.affiliates.map((row) => (
          <li key={row.id} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">
            <p className="font-medium">{row.name}</p>
            <p className="text-[var(--muted)]">{row.email} · {row.referralCode} · {row.status.toLowerCase()} · {row.totalOrders} seats · Stripe {row.stripeOnboarded ? "connected" : "not connected"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={buttonClass} onClick={() => void act({ action: "mark-paid", affiliateId: row.id })}>Pay with Stripe</button>
              {row.status !== "ACTIVE" ? (
                <button type="button" className={buttonClass} onClick={() => void act({ action: "approve", affiliateId: row.id })}>Approve</button>
              ) : (
                <button type="button" className={buttonClass} onClick={() => void act({ action: "pause", affiliateId: row.id })}>Pause</button>
              )}
              <button type="button" className="text-sm text-[var(--muted)] underline" onClick={() => void act({ action: "terminate", affiliateId: row.id })}>Close</button>
            </div>
          </li>
        ))}
      </ul>
      <ul className="space-y-2">
        {props.desk.payouts.map((row) => (
          <li key={row.id} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">
            <p>{money(row.amountCents)} for {row.affiliate.name}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className={buttonClass} onClick={() => void act({ action: "mark-paid", payoutId: row.id })}>Mark paid</button>
              <button type="button" className="text-sm underline" onClick={() => void act({ action: "decline-payout", payoutId: row.id })}>Decline</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
