#!/usr/bin/env node

function tieredCommission(mrrCents, capCents = 500_000, r1 = 0.05, r2 = 0.3) {
  const tier1Base = Math.min(mrrCents, capCents);
  const tier2Base = Math.max(0, mrrCents - capCents);
  return Math.round(tier1Base * r1) + Math.round(tier2Base * r2);
}

function milestoneCommission(mrrCents, capCents = 500_000, r1 = 0.05, r2 = 0.3) {
  const rate = mrrCents >= capCents ? r2 : r1;
  return Math.round(mrrCents * rate);
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

function splitTotal(totalCents, shares) {
  const sum = shares.reduce((s, p) => s + p.share, 0);
  let allocated = 0;
  return shares.map((p, i) => {
    const isLast = i === shares.length - 1;
    const amount = isLast
      ? totalCents - allocated
      : Math.round((totalCents * p.share) / sum);
    allocated += amount;
    return amount;
  });
}

const split = splitTotal(1150_00, [{ share: 60 }, { share: 40 }]);
if (split[0] === 690_00 && split[1] === 460_00) {
  console.log("OK split 60/40 on $1150");
} else {
  ok = false;
  console.log(`FAIL split: ${split.map((c) => c / 100).join(", ")}`);
}

function flatRevenueSplit(mrrCents, shares) {
  const totalShare = shares.reduce((s, p) => s + p.share, 0);
  const partnerTotal = Math.round((mrrCents * totalShare) / 100);
  let allocated = 0;
  const lines = shares.map((p, i) => {
    const isLast = i === shares.length - 1;
    const amount = isLast ? partnerTotal - allocated : Math.round((mrrCents * p.share) / 100);
    allocated += amount;
    return amount;
  });
  return { lines, company: mrrCents - partnerTotal, partnerTotal };
}

const flat = flatRevenueSplit(1000_00, [{ share: 5 }, { share: 20 }]);
if (flat.lines[0] === 50_00 && flat.lines[1] === 200_00 && flat.company === 750_00) {
  console.log("OK flat split 5/20/75 on $1000 MRR");
} else {
  ok = false;
  console.log(
    `FAIL flat split: john=${flat.lines[0] / 100} jeremy=${flat.lines[1] / 100} company=${flat.company / 100}`,
  );
}

const milestoneCases = [
  { mrr: 2500_00, want: 125_00 },
  { mrr: 4999_99, want: Math.round(4999_99 * 0.05) },
  { mrr: 5000_00, want: 1500_00 },
  { mrr: 8000_00, want: 2400_00 },
];

for (const c of milestoneCases) {
  const got = milestoneCommission(c.mrr);
  if (got !== c.want) {
    ok = false;
    console.log(`FAIL milestone MRR ${c.mrr / 100}: got ${got / 100} want ${c.want / 100}`);
  } else {
    console.log(`OK milestone MRR $${c.mrr / 100} → pool $${got / 100}`);
  }
}

const milestoneSplit = splitTotal(milestoneCommission(8000_00), [{ share: 100 }]);
if (milestoneSplit[0] === 2400_00) {
  console.log("OK milestone John 100% on $8k → $2400");
} else {
  ok = false;
  console.log(`FAIL milestone split: ${milestoneSplit.map((c) => c / 100).join(", ")}`);
}

process.exit(ok ? 0 : 1);