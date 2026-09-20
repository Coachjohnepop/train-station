import "server-only";

import {
  LANDING_AB_CONTROL,
  LANDING_AB_LIVE,
  LANDING_AB_META,
  LANDING_AB_TEST,
  LANDING_AB_VARIANTS,
  type LandingAbArmStatus,
  type LandingAbVariant,
} from "@/lib/landing-ab";
import { isDatabaseConfigured } from "@/lib/database-config";
import { isDemoMode } from "@/lib/demo-exercises";

export type { LandingAbArmStatus };

export type LandingAbArmRow = {
  variant: LandingAbVariant;
  letter: string;
  name: string;
  status: LandingAbArmStatus;
  sessions: number;
  clicks: number;
  signupHits: number;
  membershipHits: number;
  howItWorksHits: number;
  styleHits: number;
  forkOwn: number;
  forkJeremy: number;
  forkIngest: number;
  forkJeremyGo: number;
};

export type LandingJourneyRow = {
  id: string;
  label: string;
  sessions: number;
};

export type LandingAbReport = {
  live: LandingAbVariant[];
  control: LandingAbVariant;
  test: typeof LANDING_AB_TEST;
  arms: LandingAbArmRow[];
  liveTotalSessions: number;
  journeys: LandingJourneyRow[];
};

function emptyArm(variant: LandingAbVariant): LandingAbArmRow {
  return {
    variant,
    ...LANDING_AB_META[variant],
    sessions: 0,
    clicks: 0,
    signupHits: 0,
    membershipHits: 0,
    howItWorksHits: 0,
    styleHits: 0,
    forkOwn: 0,
    forkJeremy: 0,
    forkIngest: 0,
    forkJeremyGo: 0,
  };
}

function emptyReport(): LandingAbReport {
  return {
    live: [...LANDING_AB_LIVE],
    control: LANDING_AB_CONTROL,
    test: LANDING_AB_TEST,
    arms: LANDING_AB_VARIANTS.map(emptyArm),
    liveTotalSessions: 0,
    journeys: [],
  };
}

function isVariant(v: string | null | undefined): v is LandingAbVariant {
  return Boolean(v && (LANDING_AB_VARIANTS as readonly string[]).includes(v));
}

export async function getLandingAbReport(since: Date): Promise<LandingAbReport> {
  const base = emptyReport();
  if (!isDatabaseConfigured() || isDemoMode()) return base;

  const { prisma } = await import("@/lib/prisma");
  try {
    const sessionRows = await prisma.$queryRaw<
      Array<{ variant: string; sessions: bigint | number }>
    >`
      WITH first_ev AS (
        SELECT DISTINCT ON (e."sessionKey")
          e."sessionKey",
          e.properties->>'landingVariant' AS v
        FROM "AnalyticsEvent" e
        LEFT JOIN "AnalyticsSession" sess ON sess."sessionKey" = e."sessionKey"
        WHERE e."occurredAt" >= ${since}
          AND e.properties->>'landingVariant' IN ('tour', 'jeremy', 'floor', 'class')
          AND e."sessionKey" IS NOT NULL
          AND COALESCE(sess."userAgent", '') !~* 'TrainStationLoop|HeadlessChrome|Playwright'
          AND COALESCE(sess."userAgent", '') <> 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        ORDER BY e."sessionKey", e."occurredAt" ASC
      ),
      assigned AS (
        SELECT COALESCE(
          CASE
            WHEN s."utmContent" IN ('tour', 'jeremy', 'floor', 'class') THEN s."utmContent"
          END,
          f.v
        ) AS variant
        FROM "AnalyticsSession" s
        LEFT JOIN first_ev f ON f."sessionKey" = s."sessionKey"
        WHERE s."lastActivityAt" >= ${since}
          AND COALESCE(s."userAgent", '') !~* 'TrainStationLoop|HeadlessChrome|Playwright'
          AND COALESCE(s."userAgent", '') <> 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      )
      SELECT variant, COUNT(*)::int AS sessions
      FROM assigned
      WHERE variant IS NOT NULL
      GROUP BY variant
    `;

    const eventRows = await prisma.$queryRaw<
      Array<{
        variant: string;
        clicks: bigint | number;
        signup_hits: bigint | number;
        membership_hits: bigint | number;
        how_it_works: bigint | number;
        style_hits: bigint | number;
        fork_own: bigint | number;
        fork_jeremy: bigint | number;
        fork_ingest: bigint | number;
        fork_jeremy_go: bigint | number;
      }>
    >`
      SELECT
        e.properties->>'landingVariant' AS variant,
        COUNT(*) FILTER (WHERE e."eventType" = 'page_click')::int AS clicks,
        COUNT(*) FILTER (
          WHERE COALESCE(e."clickHref", e."pagePath", '') ILIKE '%signup%'
        )::int AS signup_hits,
        COUNT(*) FILTER (
          WHERE COALESCE(e."clickAction", '') ILIKE '%start-membership%'
        )::int AS membership_hits,
        COUNT(*) FILTER (
          WHERE COALESCE(e."clickAction", '') IN (
            'hero-free-tour', 'hero-b-see-the-app', 'hero-b-auto-walk', 'hero-b-auto-tour'
          )
        )::int AS how_it_works,
        COUNT(*) FILTER (
          WHERE COALESCE(e."clickAction", '') IN (
            'hero-b-train-station-style', 'walk-train-station-style', 'hero-b-try-it-now'
          )
        )::int AS style_hits,
        COUNT(*) FILTER (
          WHERE COALESCE(e."clickAction", '') IN ('b-fork-own', 'hero-b-have-workout')
        )::int AS fork_own,
        COUNT(*) FILTER (
          WHERE COALESCE(e."clickAction", '') IN ('b-fork-jeremy', 'hero-b-want-jeremy')
        )::int AS fork_jeremy,
        COUNT(*) FILTER (
          WHERE COALESCE(e."clickAction", '') IN ('b-ingest', 'b-byow-ingest')
        )::int AS fork_ingest,
        COUNT(*) FILTER (
          WHERE COALESCE(e."clickAction", '') IN ('b-jeremy-go', 'b-jeremy-today')
        )::int AS fork_jeremy_go
      FROM "AnalyticsEvent" e
      LEFT JOIN "AnalyticsSession" s ON s."sessionKey" = e."sessionKey"
      WHERE e."occurredAt" >= ${since}
        AND e.properties->>'landingVariant' IN ('tour', 'jeremy', 'floor', 'class')
        AND COALESCE(s."userAgent", '') !~* 'TrainStationLoop|HeadlessChrome|Playwright'
        AND COALESCE(s."userAgent", '') <> 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      GROUP BY 1
    `;

    const journeyRows = await prisma.$queryRaw<
      Array<{ door: string; sessions: bigint | number }>
    >`
      WITH first_page AS (
        SELECT DISTINCT ON (e."sessionKey")
          e."sessionKey",
          COALESCE(e."pagePath", '/') AS path,
          COALESCE(e."referrer", '') AS referrer
        FROM "AnalyticsEvent" e
        LEFT JOIN "AnalyticsSession" s ON s."sessionKey" = e."sessionKey"
        WHERE e."occurredAt" >= ${since}
          AND e."eventType" = 'page_view'
          AND e."sessionKey" IS NOT NULL
          AND COALESCE(s."userAgent", '') !~* 'TrainStationLoop|HeadlessChrome|Playwright'
          AND COALESCE(s."userAgent", '') <> 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        ORDER BY e."sessionKey", e."occurredAt" ASC
      )
      SELECT
        CASE
          WHEN referrer ILIKE '%allaboard.fit%' THEN 'allaboard'
          WHEN path = '/' THEN 'home'
          WHEN path LIKE '/l/class%' THEN 'class'
          WHEN path LIKE '/l/jeremy%' THEN 'jeremy_door'
          WHEN path LIKE '/l/floor%' THEN 'floor'
          WHEN path LIKE '/l/tour%' THEN 'tour_door'
          WHEN path LIKE '/signup%' THEN 'signup'
          WHEN path LIKE '/join%' THEN 'join'
          WHEN path LIKE '/member%' THEN 'member'
          ELSE 'other'
        END AS door,
        COUNT(*)::int AS sessions
      FROM first_page
      GROUP BY 1
    `;

    const byVariant = new Map(base.arms.map((a) => [a.variant, { ...a }]));
    for (const row of sessionRows) {
      if (!isVariant(row.variant)) continue;
      const arm = byVariant.get(row.variant);
      if (arm) arm.sessions = Number(row.sessions) || 0;
    }
    for (const row of eventRows) {
      if (!isVariant(row.variant)) continue;
      const arm = byVariant.get(row.variant);
      if (!arm) continue;
      arm.clicks = Number(row.clicks) || 0;
      arm.signupHits = Number(row.signup_hits) || 0;
      arm.membershipHits = Number(row.membership_hits) || 0;
      arm.howItWorksHits = Number(row.how_it_works) || 0;
      arm.styleHits = Number(row.style_hits) || 0;
      arm.forkOwn = Number(row.fork_own) || 0;
      arm.forkJeremy = Number(row.fork_jeremy) || 0;
      arm.forkIngest = Number(row.fork_ingest) || 0;
      arm.forkJeremyGo = Number(row.fork_jeremy_go) || 0;
    }

    const JOURNEY_LABELS: Record<string, string> = {
      allaboard: "allaboard.fit → 6:30am class",
      home: "Homepage `/` (A/B split)",
      class: "6:30am class `/l/class`",
      jeremy_door: "Get started door `/l/jeremy`",
      floor: "Floor `/l/floor`",
      tour_door: "Tour door `/l/tour`",
      signup: "Straight to signup",
      join: "Straight to tickets `/join`",
      member: "Already in the app `/member`",
      other: "Other first page",
    };
    const journeys = journeyRows
      .map((row) => ({
        id: row.door,
        label: JOURNEY_LABELS[row.door] || row.door,
        sessions: Number(row.sessions) || 0,
      }))
      .sort((a, b) => b.sessions - a.sessions);

    const arms = LANDING_AB_VARIANTS.map((v) => byVariant.get(v)!);
    const liveTotalSessions = arms
      .filter((a) => (LANDING_AB_LIVE as readonly string[]).includes(a.variant))
      .reduce((n, a) => n + a.sessions, 0);

    return {
      live: [...LANDING_AB_LIVE],
      control: LANDING_AB_CONTROL,
      test: LANDING_AB_TEST,
      arms,
      liveTotalSessions,
      journeys,
    };
  } catch (e) {
    console.warn("[landing-ab-report]", e instanceof Error ? e.message : e);
    return base;
  }
}
