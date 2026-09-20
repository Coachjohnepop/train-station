import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type WeekdayUsageRow = {
  dow: number;
  label: string;
  sessions: number;
  events: number;
};

function pacificYmd(now = new Date()): { ymd: string; dow: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const n = (t: string) => parts.find((p) => p.type === t)?.value || "01";
  const wd = parts.find((p) => p.type === "weekday")?.value || "Sun";
  return {
    ymd: `${n("year")}-${n("month")}-${n("day")}`,
    dow: Math.max(0, WEEKDAY_LABELS.indexOf(wd as (typeof WEEKDAY_LABELS)[number])),
  };
}

function addUtcDays(ymd: string, days: number): string {
  const t = Date.parse(`${ymd}T12:00:00.000Z`) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Last finished Sun–Sat (Pacific). Snapshotted on Mondays. */
export function lastCompleteWeekRangePacific(now = new Date()): {
  sundayYmd: string;
  untilYmd: string;
} {
  const { ymd, dow } = pacificYmd(now);
  const thisSunday = addUtcDays(ymd, -dow);
  const lastSunday = addUtcDays(thisSunday, -7);
  return { sundayYmd: lastSunday, untilYmd: thisSunday };
}

export function formatWeekLabel(sundayYmd: string): string {
  const sat = addUtcDays(sundayYmd, 6);
  const fmt = (ymd: string) => {
    const d = new Date(`${ymd}T12:00:00.000Z`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  };
  return `${fmt(sundayYmd)} – ${fmt(sat)}`;
}

export async function computeWeekdayUsage(since: Date, until: Date): Promise<WeekdayUsageRow[]> {
  const empty: WeekdayUsageRow[] = WEEKDAY_LABELS.map((label, dow) => ({
    dow,
    label,
    sessions: 0,
    events: 0,
  }));
  if (!isDatabaseConfigured()) return empty;
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.$queryRaw<
    Array<{ dow: number; events: bigint | number; sessions: bigint | number }>
  >`
    SELECT
      EXTRACT(DOW FROM ("occurredAt" AT TIME ZONE 'America/Los_Angeles'))::int AS dow,
      COUNT(*)::int AS events,
      COUNT(DISTINCT "sessionKey")::int AS sessions
    FROM "AnalyticsEvent" e
    LEFT JOIN "AnalyticsSession" s ON s."sessionKey" = e."sessionKey"
    WHERE e."occurredAt" >= ${since}
      AND e."occurredAt" < ${until}
      AND COALESCE(e."pagePath", '') NOT LIKE '/admin%'
      AND COALESCE(e."pagePath", '') NOT LIKE '/api%'
      AND COALESCE(s."userAgent", '') !~* 'TrainStationLoop|HeadlessChrome|Playwright'
      AND COALESCE(s."userAgent", '') <> 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    GROUP BY 1
  `;
  for (const row of rows) {
    const dow = Number(row.dow);
    if (dow >= 0 && dow <= 6) {
      empty[dow] = {
        dow,
        label: WEEKDAY_LABELS[dow],
        sessions: Number(row.sessions) || 0,
        events: Number(row.events) || 0,
      };
    }
  }
  return empty;
}

export async function snapshotLastCompleteWeek(): Promise<{
  weekStart: string;
  label: string;
  rows: WeekdayUsageRow[];
}> {
  const { sundayYmd, untilYmd } = lastCompleteWeekRangePacific();
  const since = new Date(`${sundayYmd}T07:00:00.000Z`);
  const until = new Date(`${untilYmd}T07:00:00.000Z`);
  const rows = await computeWeekdayUsage(since, until);

  if (isDatabaseConfigured()) {
    const { prisma } = await import("@/lib/prisma");
    const startDate = new Date(`${sundayYmd}T00:00:00.000Z`);
    for (const row of rows) {
      await prisma.analyticsWeekdaySnapshot.upsert({
        where: { weekStart_dow: { weekStart: startDate, dow: row.dow } },
        create: {
          weekStart: startDate,
          dow: row.dow,
          sessions: row.sessions,
          events: row.events,
        },
        update: { sessions: row.sessions, events: row.events, computedAt: new Date() },
      });
    }
  }

  return { weekStart: sundayYmd, label: formatWeekLabel(sundayYmd), rows };
}

export async function loadLatestWeekdaySnapshot(): Promise<{
  label: string;
  rows: WeekdayUsageRow[];
} | null> {
  if (!isDatabaseConfigured()) return null;
  const { prisma } = await import("@/lib/prisma");
  try {
    const latest = await prisma.analyticsWeekdaySnapshot.findFirst({
      orderBy: { weekStart: "desc" },
      select: { weekStart: true },
    });
    if (!latest) return null;
    const rows = await prisma.analyticsWeekdaySnapshot.findMany({
      where: { weekStart: latest.weekStart },
      orderBy: { dow: "asc" },
    });
    if (rows.length < 7) return null;
    const ymd = latest.weekStart.toISOString().slice(0, 10);
    return {
      label: formatWeekLabel(ymd),
      rows: WEEKDAY_LABELS.map((label, dow) => {
        const hit = rows.find((r) => r.dow === dow);
        return { dow, label, sessions: hit?.sessions ?? 0, events: hit?.events ?? 0 };
      }),
    };
  } catch {
    return null;
  }
}
