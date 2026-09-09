/**
 * Station pulse — turn raw hits into coach-readable insights + a testable plan.
 * Guest landing is judged separately from member/admin workout noise.
 */

export type InsightTone = "good" | "watch" | "fix";
export type InsightPillar = "better" | "effective" | "fun";

export type Insight = {
  id: string;
  pillar: InsightPillar;
  tone: InsightTone;
  title: string;
  body: string;
  stat?: string;
};

export type PlanItem = {
  id: string;
  priority: number;
  pillar: InsightPillar;
  title: string;
  why: string;
  doNext: string;
  test: string;
};

export type FunnelSnapshot = {
  homepageViews: number;
  tourOpens: number;
  tourCloses: number;
  tourCompletes: number;
  tourGetStarted: number;
  startMembership: number;
  exploreContent: number;
  joinViews: number;
  signupViews: number;
  signups: number;
  paidCount: number;
};

export type NamedCount = { key: string; count: number };

export type InsightInput = {
  days: number;
  views: number;
  clicks: number;
  sessions: number;
  homepageViews: number;
  joinViews: number;
  signupViews: number;
  signups: number;
  paidCount: number;
  facebookViews: number;
  facebookClicks: number;
  mobileViews: number;
  desktopViews: number;
  leaderboardViews: number;
  chatViews: number;
  musicTaps: number;
  workoutFinishClicks: number;
  namedActions: Record<string, number>;
  namedTexts: Record<string, number>;
};

export type AnalyticsPlaybook = {
  funnel: FunnelSnapshot;
  devices: NamedCount[];
  sources: NamedCount[];
  namedClicks: NamedCount[];
  better: Insight[];
  effective: Insight[];
  fun: Insight[];
  plan: PlanItem[];
};

export function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

export function formatPct(part: number, whole: number): string {
  const n = pct(part, whole);
  return n == null ? "—" : `${n}%`;
}

function named(map: Record<string, number>, ...keys: string[]): number {
  return keys.reduce((sum, key) => sum + (map[key] ?? 0), 0);
}

function textCount(map: Record<string, number>, match: (label: string) => boolean): number {
  let n = 0;
  for (const [label, count] of Object.entries(map)) {
    if (match(label.toLowerCase())) n += count;
  }
  return n;
}

export function buildFunnel(input: InsightInput): FunnelSnapshot {
  const tourOpens =
    named(
      input.namedActions,
      "hero-free-tour",
      "hero-free-tour-return",
      "menu-free-tour",
    ) || textCount(input.namedTexts, (t) => t === "free tour");
  const startMembership =
    named(
      input.namedActions,
      "hero-start-membership",
      "hero-start-membership-return",
      "menu-join-week",
      "nav-join-week",
      "nav-memberships",
      "tour-get-started",
    ) || textCount(input.namedTexts, (t) => t === "start membership" || t === "get started");
  const tourCloses =
    named(input.namedActions, "close-tour") ||
    textCount(input.namedTexts, (t) => t === "close tour");
  const tourCompletes = named(
    input.namedActions,
    "tour-continue-free",
    "tour-pick-ticket",
  );
  const tourGetStarted = named(input.namedActions, "tour-get-started");
  const exploreContent = named(input.namedActions, "hero-explore-content");

  return {
    homepageViews: input.homepageViews,
    tourOpens,
    tourCloses,
    tourCompletes,
    tourGetStarted,
    startMembership,
    exploreContent,
    joinViews: input.joinViews,
    signupViews: input.signupViews,
    signups: input.signups,
    paidCount: input.paidCount,
  };
}

function windowLabel(days: number): string {
  if (days <= 1) return "today";
  return `the last ${days} days`;
}

export function buildPlaybook(input: InsightInput): AnalyticsPlaybook {
  const funnel = buildFunnel(input);
  const window = windowLabel(input.days);
  const better: Insight[] = [];
  const effective: Insight[] = [];
  const fun: Insight[] = [];
  const plan: PlanItem[] = [];

  const mobileShare = pct(input.mobileViews, input.mobileViews + input.desktopViews);
  const bailRate = pct(funnel.tourCloses, funnel.tourOpens);
  const ticketRate = pct(funnel.startMembership, funnel.homepageViews);
  const tourRate = pct(funnel.tourOpens, funnel.homepageViews);
  const joinFromHome = pct(funnel.joinViews, funnel.homepageViews);
  const signupFromJoin = pct(funnel.signupViews, funnel.joinViews);
  const accountFromSignup = pct(funnel.signups, funnel.signupViews);
  const fbShare = pct(input.facebookViews, input.views);

  if (mobileShare != null && mobileShare >= 60) {
    better.push({
      id: "phone-first",
      pillar: "better",
      tone: "watch",
      title: "This is a phone site",
      body: `${mobileShare}% of views are mobile. Facebook in-app browsers do not hover. Every landing change has to work with a thumb, first tap.`,
      stat: `${mobileShare}% mobile`,
    });
  } else if (input.views > 0) {
    better.push({
      id: "desktop-mix",
      pillar: "better",
      tone: "good",
      title: "Traffic is mixed desktop and phone",
      body: "Check both widths, but still tap-test the hero on a real iPhone before calling a landing change done.",
      stat: mobileShare != null ? `${mobileShare}% mobile` : undefined,
    });
  }

  if (funnel.tourOpens > 0 && (bailRate ?? 0) >= 25) {
    better.push({
      id: "tour-bail",
      pillar: "better",
      tone: "fix",
      title: "The tour is losing people mid-play",
      body: `${funnel.tourCloses} closed it vs ${funnel.tourOpens} opens ${window}. Get started has to stay on screen the whole time — hover-only would never show on iPhone.`,
      stat: `${bailRate}% closed`,
    });
  } else if (funnel.tourGetStarted > 0) {
    better.push({
      id: "tour-dock",
      pillar: "better",
      tone: "good",
      title: "People can board while the tour plays",
      body: `${funnel.tourGetStarted} tapped Get started during the auto-play. Keep that dock; do not hide it behind hover.`,
      stat: `${funnel.tourGetStarted} Get started`,
    });
  }

  if (funnel.homepageViews >= 8 && (ticketRate ?? 0) < 10 && (tourRate ?? 0) > (ticketRate ?? 0)) {
    better.push({
      id: "first-click-tour",
      pillar: "better",
      tone: "fix",
      title: "First tap is still the tour, not tickets",
      body: `Free Tour ${funnel.tourOpens} vs Start membership ${funnel.startMembership} ${window}. Tickets belong on top. Measure for a week before touching the hero again.`,
      stat: `${formatPct(funnel.startMembership, funnel.tourOpens)} tickets vs tour`,
    });
  }

  if (funnel.joinViews >= 5 && funnel.signups === 0) {
    effective.push({
      id: "join-leak",
      pillar: "effective",
      tone: "fix",
      title: "They reach tickets. Nobody finishes.",
      body: `${funnel.joinViews} ticket-page views and ${funnel.signupViews} signup views ${window}, with ${funnel.signups} new member accounts. The leak is the ticket picker or the signup form — not the Facebook post.`,
      stat: `${funnel.joinViews} join · ${funnel.signups} signups`,
    });
  } else if (funnel.signups > 0) {
    effective.push({
      id: "signups-landed",
      pillar: "effective",
      tone: "good",
      title: "Boarding is completing",
      body: `${funnel.signups} new member account${funnel.signups === 1 ? "" : "s"} ${window}. Paid checkouts: ${funnel.paidCount}.`,
      stat: `${funnel.signups} signups`,
    });
  }

  if (input.facebookViews >= 5 && funnel.signups === 0) {
    effective.push({
      id: "fb-no-board",
      pillar: "effective",
      tone: "fix",
      title: "Facebook is sending people. We are not seating them.",
      body: `${input.facebookViews} Facebook views and ${input.facebookClicks} clicks ${window}, zero new accounts. The post is working. The next screen after the tap is not.`,
      stat: `${input.facebookViews} FB views`,
    });
  } else if (input.facebookViews > 0) {
    effective.push({
      id: "fb-present",
      pillar: "effective",
      tone: "watch",
      title: "Facebook is a real source",
      body: `${input.facebookViews} views tagged from Facebook ${window} (${formatPct(input.facebookViews, input.views)} of all views). Watch Station pulse live when Jeremy posts.`,
      stat: fbShare != null ? `${fbShare}% of views` : undefined,
    });
  }

  if (funnel.homepageViews >= 8) {
    effective.push({
      id: "funnel-shape",
      pillar: "effective",
      tone: joinFromHome != null && joinFromHome < 20 ? "watch" : "good",
      title: "Guest path: home → tickets → signup",
      body: `${funnel.homepageViews} homepage · ${funnel.joinViews} tickets (${formatPct(funnel.joinViews, funnel.homepageViews)}) · ${funnel.signupViews} signup (${formatPct(funnel.signupViews, funnel.joinViews)}) · ${funnel.signups} accounts (${formatPct(funnel.signups, funnel.signupViews)}).`,
      stat: `${formatPct(funnel.signups, funnel.homepageViews)} home → account`,
    });
  }

  if (funnel.exploreContent > funnel.startMembership && funnel.exploreContent >= 3) {
    effective.push({
      id: "browse-not-board",
      pillar: "effective",
      tone: "watch",
      title: "Explore is beating Start membership",
      body: `Explore Content ${funnel.exploreContent} vs Start membership ${funnel.startMembership}. Browsing is fine after a ticket tap — not instead of one.`,
    });
  }

  if (input.musicTaps >= 2) {
    fun.push({
      id: "theme-song",
      pillar: "fun",
      tone: "good",
      title: "People want the Theme Song",
      body: `${input.musicTaps} taps on background music ${window}. Keep the song on the first screen. Do not replace it with the rest horn.`,
      stat: `${input.musicTaps} plays`,
    });
  }

  if (funnel.tourCompletes > 0) {
    fun.push({
      id: "tour-finish",
      pillar: "fun",
      tone: "good",
      title: "Someone finished the tour",
      body: `${funnel.tourCompletes} hit Continue with Free or Pick a ticket after the auto-play. The tour idea is good; leading with it is not.`,
      stat: `${funnel.tourCompletes} finished`,
    });
  } else if (funnel.tourOpens >= 5) {
    fun.push({
      id: "tour-no-finish",
      pillar: "fun",
      tone: "watch",
      title: "The tour rarely makes it to the end",
      body: `${funnel.tourOpens} opens, ${funnel.tourCompletes} finished ${window}. Shorten it, or make Get started louder than Skip / Close.`,
    });
  }

  if (input.workoutFinishClicks >= 5) {
    fun.push({
      id: "class-energy",
      pillar: "fun",
      tone: "good",
      title: "Members are checking sets",
      body: `${input.workoutFinishClicks} finish / set-complete taps ${window}. That is the product working. Do not mix those clicks into the guest funnel.`,
      stat: `${input.workoutFinishClicks} finish taps`,
    });
  }

  if (input.leaderboardViews + input.chatViews > 0) {
    fun.push({
      id: "social-loop",
      pillar: "fun",
      tone: "good",
      title: "Leaderboard and chat are getting opened",
      body: `Leaderboard ${input.leaderboardViews} · chat ${input.chatViews} ${window}. Those are the engagement loops — keep them one tap from Today.`,
    });
  }

  if (better.length === 0 && input.views === 0) {
    better.push({
      id: "no-traffic",
      pillar: "better",
      tone: "watch",
      title: "No hits in this window yet",
      body: "Open the public site on a phone and tap around — events should land here within a few seconds.",
    });
  }

  plan.push({
    id: "phone-verify",
    priority: 1,
    pillar: "better",
    title: "Prove every landing change on an iPhone",
    why: mobileShare != null && mobileShare >= 60
      ? `${mobileShare}% of views are phones, and Facebook opens in-app Safari.`
      : "Jeremy’s Facebook share is iPhone. Hover never fires.",
    doNext: "After any hero or tour tweak, open thetrainstation.co in iPhone Safari (and Facebook in-app if you can) and tap Start membership, Free Tour, Get started, Close.",
    test: "Pass only if the first thumb tap is tickets, Get started is visible the whole tour, and Close is at least 44px.",
  });

  if (funnel.joinViews >= 3 && funnel.signups === 0) {
    plan.push({
      id: "ticket-one-tap",
      priority: 2,
      pillar: "effective",
      title: "Make the first ticket one tap",
      why: `${funnel.joinViews} people saw tickets and ${funnel.signups} created an account ${window}.`,
      doNext: "On /join, put Explorer / Free as the first giant button. Hide program collage until a ticket is chosen. Time-to-first-ticket should be one tap, not a hunt.",
      test: "Watch join views → signup views → new accounts for 7 days. Success is signup views ≥ 40% of join views, and at least one Facebook session creating an account.",
    });
  }

  plan.push({
    id: "one-change",
    priority: 3,
    pillar: "effective",
    title: "One landing change at a time",
    why: "Start membership is now first and Get started stays on the tour. If we change three things, we will not know what worked.",
    doNext: "Leave the hero alone for a week. Read Station pulse daily when Jeremy posts. Next candidate is the ticket page, not another hero swap.",
    test: "Compare this week vs last: Start membership taps, tour-get-started, close-tour, /join views, /signup views, new accounts. Guest clicks only — ignore Set 1 / Exercise finished.",
  });

  plan.push({
    id: "named-actions",
    priority: 4,
    pillar: "better",
    title: "Name every guest button",
    why: "Workout cards dump huge click labels and drown the marketing signal. Guest CTAs need data-analytics-action.",
    doNext: "Keep named actions on Start membership, Free Tour, Get started, Close tour, Skip, Continue with Free, Pick a ticket. Ignore member set checks in this dashboard.",
    test: "In Station pulse → named clicks, those actions appear as keys, not as a paragraph of exercise copy.",
  });

  if (funnel.tourOpens >= 3 && funnel.tourCompletes === 0) {
    plan.push({
      id: "shorter-tour",
      priority: 5,
      pillar: "fun",
      title: "Shorten the tour or exit earlier to tickets",
      why: `${funnel.tourOpens} opens and ${funnel.tourCompletes} finished ${window}.`,
      doNext: "If Get started still loses to Close after a week, cut the auto-play to workout + one ticket beat (~8 sec) and end on Pick a ticket.",
      test: "tour-get-started + tour-pick-ticket + tour-continue-free should beat close-tour.",
    });
  } else {
    plan.push({
      id: "keep-song",
      priority: 5,
      pillar: "fun",
      title: "Keep Theme Song on the first screen",
      why: input.musicTaps > 0
        ? `${input.musicTaps} people reached for the music ${window}.`
        : "The Facebook first impression is sound + motion, not a form.",
      doNext: "Theme Song stays on the landing. Rest horn stays on set-check only.",
      test: "Music taps should not drop after a landing change. Rest horn must not duck the song.",
    });
  }

  plan.sort((a, b) => a.priority - b.priority);

  const devices: NamedCount[] = [
    { key: "mobile", count: input.mobileViews },
    { key: "desktop", count: input.desktopViews },
  ].filter((row) => row.count > 0);

  const sources: NamedCount[] = [
    { key: "facebook", count: input.facebookViews },
    { key: "other", count: Math.max(0, input.views - input.facebookViews) },
  ].filter((row) => row.count > 0);

  const namedClicks = Object.entries(input.namedActions)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    funnel,
    devices,
    sources,
    namedClicks,
    better,
    effective,
    fun,
    plan,
  };
}

export function emptyInsightInput(days: number): InsightInput {
  return {
    days,
    views: 0,
    clicks: 0,
    sessions: 0,
    homepageViews: 0,
    joinViews: 0,
    signupViews: 0,
    signups: 0,
    paidCount: 0,
    facebookViews: 0,
    facebookClicks: 0,
    mobileViews: 0,
    desktopViews: 0,
    leaderboardViews: 0,
    chatViews: 0,
    musicTaps: 0,
    workoutFinishClicks: 0,
    namedActions: {},
    namedTexts: {},
  };
}
