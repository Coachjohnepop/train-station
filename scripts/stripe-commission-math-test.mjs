#!/usr/bin/env node

function tieredCommission(mrrCents, capCents = 500_000, r1 = 0.05, r2 = 0.3) {
  const tier1Base = Math.min(mrrCents, capCents);
  const tier2Base = Math.max(0, mrrCents - capCents);
  return Math.round(tier1Base * r1) + Math.round(tier2Base * r2);
}

const cases = [
  { mrr: 0, want: 0 },
  { mrr: 2500_00, want: 125_00 },
  { mrr: 5000_00, want: 250_00 },
  { mrr: 8000_00, want: 1150_00 },
];

let ok = true;
for (const c of cases) {
  const got = tieredCommission(c.mrr);
  if (got !== c.want) {
    ok = false;
    console.log(`FAIL MRR ${c.mrr / 100}: got ${got / 100} want ${c.want / 100}`);
  } else {
    console.log(`OK MRR $${c.mrr / 100} → commission $${got / 100}`);
  }
}

process.exit(ok ? 0 : 1);