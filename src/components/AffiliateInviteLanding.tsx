"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TrainStationBrand from "@/components/TrainStationBrand";
import { BRAND_NAME } from "@/lib/brand";
import { calculateCommissionRate, COMMISSION_POOL } from "@/lib/affiliate/commission";

export default function AffiliateInviteLanding() {
  const token = useSearchParams().get("token") || "";
  const router = useRouter();
  const [invite, setInvite] = useState<{ name: string; email: string } | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!token) {
      setError("This page opens from an invite link.");
      return;
    }
    void fetch(`/api/affiliate/invite?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof body.error === "string" ? body.error : "This invite is not valid.");
          return;
        }
        setInvite({ name: body.name, email: body.email });
      })
      .catch(() => setError("Could not open this invite."));
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!invite) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/affiliate/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: invite.name,
          email: invite.email,
          password,
          referralCode: code || undefined,
          inviteToken: token,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not create the account.");
        return;
      }
      setNotice(typeof body.message === "string" ? body.message : "Account created.");
      router.push("/affiliate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-6">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <header className="flex items-center gap-3 pr-12">
          <TrainStationBrand variant="header" />
          <div>
            <p className="text-sm font-semibold tracking-tight text-[var(--accent)]">{BRAND_NAME}</p>
            <h1 className="text-2xl font-bold">Affiliate invite</h1>
          </div>
        </header>
        <section className="space-y-3 text-sm leading-relaxed">
          <p>You were invited to share {BRAND_NAME} and earn when someone pays for a membership.</p>
          <p>
            You get a link. A plain link pays your account rate. A discount code shares a {Math.round(COMMISSION_POOL * 100)}% pool: 10% off for them means you earn {Math.round(calculateCommissionRate(0.1) * 100)}%. Payouts go to a Stripe account you connect, once the balance reaches $50.
          </p>
        </section>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {invite ? (
          <form className="card space-y-3 p-4" onSubmit={(event) => void submit(event)}>
            <p className="text-sm font-semibold">{invite.name}</p>
            <p className="text-sm text-[var(--muted)]">{invite.email}</p>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Password</span>
              <input className="input w-full" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Referral code, optional</span>
              <input className="input w-full" value={code} onChange={(e) => setCode(e.target.value)} placeholder="YOURNAME" />
            </label>
            {notice ? <p className="text-sm text-[var(--muted)]">{notice}</p> : null}
            <button className="btn-primary px-4 py-2 text-sm" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
