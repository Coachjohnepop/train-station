import Link from "next/link";
import { isDemoMode } from "@/lib/demo-enrollments";
import { getDemoWorkoutLogCount, getDemoStrengthScore } from "@/lib/demo-logs";

export const dynamic = "force-dynamic";

async function loadReportData() {
  const isDemo = isDemoMode();

  let seed: any = {};
  try {
    const fs = await import("fs");
    const path = await import("path");
    const seedPath = path.join(process.cwd(), "prisma/seed-data.json");
    seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  } catch {}

  let logsDev: any = { workoutLogs: [], performances: [] };
  try {
    const fs = await import("fs");
    const path = await import("path");
    const logsPath = path.join(process.cwd(), "prisma/logs.dev.json");
    if (fs.existsSync(logsPath)) {
      logsDev = JSON.parse(fs.readFileSync(logsPath, "utf8"));
    }
  } catch {}

  let enrollDev: any = {};
  try {
    const fs = await import("fs");
    const path = await import("path");
    const enrPath = path.join(process.cwd(), "prisma/enrollments.dev.json");
    if (fs.existsSync(enrPath)) {
      enrollDev = JSON.parse(fs.readFileSync(enrPath, "utf8"));
    }
  } catch {}

  // Programs
  const programs = (seed.programs || []).map((p: any) => {
    const weeks = (seed.programWeeks || []).filter((w: any) => w.programId === p.id);
    const totalDays = weeks.length * 7;
    return {
      ...p,
      totalDays,
      weeksCount: weeks.length,
    };
  });

  // Enrollments (demo + seed)
  const enrollments = Object.entries(enrollDev).map(([slug, enr]: [string, any]) => {
    const prog = programs.find((pp: any) => pp.slug === slug);
    const progress = prog ? Math.min(100, Math.round(((enr.currentWeek - 1) * 7 + enr.currentDay) / prog.totalDays * 100)) : 0;
    const completed = prog ? (enr.currentWeek >= (prog.durationWeeks || 4) && enr.currentDay >= 7) : false;
    return {
      slug,
      program: prog,
      currentWeek: enr.currentWeek,
      currentDay: enr.currentDay,
      progress,
      completed,
    };
  });

  // Logs / Visits
  const workoutLogs = logsDev.workoutLogs || [];
  const totalVisits = workoutLogs.length;
  const visitsByProgram = programs.map((p: any) => {
    const progWorkoutIds = new Set(
      (seed.programDays || [])
        .filter((d: any) => (seed.programWeeks || []).some((w: any) => w.id === d.weekId && w.programId === p.id))
        .map((d: any) => d.workoutId)
        .filter(Boolean)
    );
    const count = workoutLogs.filter((l: any) => progWorkoutIds.has(l.workoutId)).length;
    return { ...p, visits: count };
  });

  // Financial (from tiers + assumed active counts in demo)
  const tiers = seed.subscriptionTiers || [];
  const coachTier = tiers.find((t: any) => t.slug === "coach");
  const firstClassTier = tiers.find((t: any) => t.slug === "first_class");
  const activeCoach = 2;
  const activeFirst = 1;
  const mrr = (coachTier?.monthlyCents || 0) * activeCoach / 100 + (firstClassTier?.monthlyCents || 1900) * activeFirst / 100;
  const totalSubs = activeCoach + activeFirst;

  const completedCount = enrollments.filter((e: any) => e.completed).length;
  const completionRate = enrollments.length > 0 ? Math.round((completedCount / enrollments.length) * 100) : 0;

  // Fresh review / demo member snapshot (0s after user data reset; strength from same logs source as member dashboard)
  const demoWorkoutCount = isDemo ? getDemoWorkoutLogCount() : 0;
  const demoStrength = isDemo ? getDemoStrengthScore() : 0;

  return {
    isDemo,
    programs,
    enrollments,
    totalVisits,
    visitsByProgram,
    mrr: Math.round(mrr),
    totalSubs,
    completedCount,
    completionRate,
    workoutLogs: workoutLogs.slice(0, 20),
    demoWorkoutCount,
    demoStrength,
  };
}

export default async function AdminReportsPage() {
  const data = await loadReportData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-[var(--muted)]">ERP-style overview. Data from seed + demo logs. Use links for drill-down.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-xs text-[var(--muted)]">MRR</div>
          <div className="text-3xl font-semibold mt-1">${data.mrr}</div>
          <div className="text-xs mt-1 text-[var(--muted)]">{data.totalSubs} active subs</div>
        </div>
        <div className="card">
          <div className="text-xs text-[var(--muted)]">Total Visits</div>
          <div className="text-3xl font-semibold mt-1">{data.totalVisits}</div>
        </div>
        <div className="card">
          <div className="text-xs text-[var(--muted)]">Programs Completed</div>
          <div className="text-3xl font-semibold mt-1">{data.completedCount}</div>
          <div className="text-xs mt-1 text-[var(--muted)]">{data.completionRate}% rate</div>
        </div>
        <div className="card">
          <div className="text-xs text-[var(--muted)]">Active Enrollments</div>
          <div className="text-3xl font-semibold mt-1">{data.enrollments.length}</div>
        </div>
      </div>

      {/* New: visible snapshot of the current demo/fresh member state (ties into the 0-logs reset + new dashboard snippet for review by coach/Jeremy on test server) */}
      <div className="card">
        <div className="text-xs text-[var(--muted)]">Demo Member Snapshot (fresh review)</div>
        <div className="mt-1 flex items-baseline gap-4">
          <div>
            <span className="text-2xl font-semibold tabular-nums">{data.demoWorkoutCount}</span>
            <span className="ml-1 text-sm text-[var(--muted)]">workouts logged</span>
          </div>
          <div>
            <span className="text-2xl font-semibold tabular-nums">{data.demoStrength}</span>
            <span className="ml-1 text-sm text-[var(--muted)]">strength score</span>
          </div>
        </div>
        <p className="text-[10px] text-[var(--muted)] mt-1">Reflects the current prisma/*.dev.json state (user data reset for fresh review while keeping full program/exercise/seed content). The member dashboard shows the same numbers + new "workouts logged" snippet + ranking. Update by logging workouts or enrolling.</p>
      </div>

      <section className="card">
        <h2 className="font-semibold mb-3">Financials</h2>
        <div className="text-sm mb-2">Est. MRR: <strong>${data.mrr}</strong></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--muted)] border-b">
              <th>Tier</th><th>Monthly</th><th>Active (demo)</th><th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t"><td>Coach</td><td>$0</td><td>2</td><td>$0</td></tr>
            <tr className="border-t"><td>1st Class</td><td>$19</td><td>1</td><td>$19</td></tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">Visits by Program</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--muted)] border-b">
              <th>Program</th><th>Visits</th><th>Enrolled</th><th>Drill</th>
            </tr>
          </thead>
          <tbody>
            {data.visitsByProgram.map((p: any, i: number) => {
              const enrCount = data.enrollments.filter((e: any) => e.program?.slug === p.slug).length;
              return (
                <tr key={i} className="border-t">
                  <td>{p.name}</td>
                  <td>{p.visits}</td>
                  <td>{enrCount}</td>
                  <td><Link href={`/admin/reports?program=${p.slug}`} className="text-accent text-xs underline">Drill →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">Program Completions</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--muted)] border-b">
              <th>Program</th><th>Enrolled</th><th>Avg Progress</th><th>Completed</th><th>Drill</th>
            </tr>
          </thead>
          <tbody>
            {data.programs.map((p: any, i: number) => {
              const progEnrolls = data.enrollments.filter((e: any) => e.program?.slug === p.slug);
              const avg = progEnrolls.length > 0 ? Math.round(progEnrolls.reduce((s: number, e: any) => s + (e.progress||0), 0) / progEnrolls.length) : 0;
              const comp = progEnrolls.filter((e: any) => e.completed).length;
              return (
                <tr key={i} className="border-t">
                  <td>{p.name}</td><td>{progEnrolls.length}</td><td>{avg}%</td><td>{comp}</td>
                  <td><Link href={`/admin/reports?program=${p.slug}`} className="text-accent text-xs underline">Users →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">Recent Activity (sample drill)</h2>
        <p className="text-xs text-[var(--muted)] mb-2">Recent workout logs (add ?program=adult to focus). Full version would have interactive filters, user lists per program, and individual log history.</p>
        <ul className="text-xs space-y-1">
          {data.workoutLogs.slice(0, 8).map((l: any, i: number) => (
            <li key={i}>• {new Date(l.performedAt).toLocaleDateString()} — {l.workoutId?.slice(0,8)} (progress {l.progress}%)</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
