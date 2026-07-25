/**
 * Searchable catalog of admin apps, pages, and deep links.
 * Used by the coach/platform nav search bar (AdminAppSearch).
 */

export type AdminSearchWorkspace = "coach" | "platform" | "both" | "public";

export type AdminSearchItem = {
  /** Unique id for React keys */
  id: string;
  /** Primary label shown in results */
  title: string;
  /** Short blurb under the title */
  description: string;
  /** Destination path (may include query) */
  href: string;
  /** Coach / platform / both / public member-facing */
  workspace: AdminSearchWorkspace;
  /** Section chip in results */
  group: string;
  /** Extra terms for fuzzy-ish matching (aliases, synonyms) */
  keywords: string[];
};

export const ADMIN_APP_SEARCH_INDEX: AdminSearchItem[] = [
  // ── Coach · Overview ─────────────────────────────────────────────
  {
    id: "coach-dashboard",
    title: "Dashboard",
    description: "Day board — plan, publish, roster",
    href: "/admin/day",
    workspace: "coach",
    group: "Overview",
    keywords: ["board", "home", "day hub", "coach home", "overview"],
  },
  {
    id: "coach-queue",
    title: "Queue",
    description: "Pending approvals, mark paid, onboarding",
    href: "/admin/queue",
    workspace: "coach",
    group: "People",
    keywords: ["approve", "pending", "mark paid", "inbox", "payment queue"],
  },
  {
    id: "coach-members",
    title: "Members",
    description: "Roster, payment status, program position",
    href: "/admin/members",
    workspace: "coach",
    group: "People",
    keywords: ["roster", "clients", "students", "athletes", "paid", "venmo"],
  },
  {
    id: "coach-leads",
    title: "Leads",
    description: "Landing form inquiries",
    href: "/admin/leads",
    workspace: "coach",
    group: "People",
    keywords: ["prospects", "waitlist", "inquiries", "signups"],
  },
  {
    id: "coach-bookings",
    title: "Bookings",
    description: "Calendly / intake bookings",
    href: "/admin/bookings",
    workspace: "coach",
    group: "People",
    keywords: ["calendly", "intake", "calls", "appointments", "schedule calls"],
  },
  {
    id: "coach-messages",
    title: "Messages",
    description: "1:1 coach–member chat",
    href: "/admin/chat",
    workspace: "coach",
    group: "Talk",
    keywords: ["chat", "dm", "inbox", "sms", "text", "thread", "macros"],
  },
  {
    id: "coach-live-floor",
    title: "Live Floor",
    description: "Class live room & Zoom host tools",
    href: "/admin/live",
    workspace: "coach",
    group: "Live",
    keywords: ["zoom", "class", "broadcast", "host", "video"],
  },
  {
    id: "coach-assign",
    title: "Assign",
    description: "Assign workouts to members",
    href: "/admin/assign",
    workspace: "coach",
    group: "Live",
    keywords: ["assign workout", "give workout", "prescribe"],
  },
  {
    id: "coach-go-to-today",
    title: "Go to Today",
    description: "Live floor sets, checkoffs, sticky video",
    href: "/admin/today",
    workspace: "coach",
    group: "Live",
    keywords: ["today", "sets", "floor", "live coaching", "checkoff"],
  },
  {
    id: "coach-programs",
    title: "Programs",
    description: "Program calendar builder, multi-part days, paste",
    href: "/admin/programs",
    workspace: "coach",
    group: "Content",
    keywords: [
      "calendar",
      "builder",
      "adult",
      "week",
      "gym",
      "home",
      "template paste",
      "28-day",
      "cycle",
      "multipart",
    ],
  },
  {
    id: "coach-templates",
    title: "Templates",
    description: "Workout templates & archive shelf",
    href: "/admin/templates",
    workspace: "coach",
    group: "Content",
    keywords: ["paste", "clone", "archive", "28 day pack", "library"],
  },
  {
    id: "coach-workouts",
    title: "Workouts",
    description: "Workout library & editor",
    href: "/admin/workouts",
    workspace: "coach",
    group: "Content",
    keywords: ["sessions", "class plan", "lesson plan", "builder"],
  },
  {
    id: "coach-exercises",
    title: "Exercises",
    description: "Exercise catalog + archive shelf",
    href: "/admin/exercises",
    workspace: "coach",
    group: "Content",
    keywords: ["library", "catalog", "youtube", "movement", "archive exercise"],
  },
  {
    id: "coach-equipment",
    title: "Equipment",
    description: "Gear catalog for member shop",
    href: "/admin/equipment",
    workspace: "coach",
    group: "Content",
    keywords: ["gear", "shop", "amazon", "product", "equipment catalog"],
  },
  {
    id: "coach-landing",
    title: "Landing",
    description: "Public landing media, videos, Venmo QR",
    href: "/admin/landing",
    workspace: "coach",
    group: "Site",
    keywords: ["youtube", "welcome", "free ticket", "brand", "media", "venmo qr"],
  },
  {
    id: "coach-discounts",
    title: "Discount codes",
    description: "Create promo / coupon codes for Checkout",
    href: "/admin/discounts",
    workspace: "coach",
    group: "Discount codes",
    keywords: [
      "promo",
      "coupon",
      "promotion code",
      "percent off",
      "feedback50",
      "stripe discount",
      "referral code",
      "first free",
      "discount code",
    ],
  },
  {
    id: "coach-gamification",
    title: "Gamification",
    description: "Scores, free pool, promos, hall of fame",
    href: "/admin/gamification",
    workspace: "coach",
    group: "Site",
    keywords: ["points", "scores", "leaderboard", "free week", "prize", "season"],
  },
  {
    id: "coach-settings",
    title: "Settings",
    description: "Coach prefs, Zoom Connect, push alerts",
    href: "/admin/settings",
    workspace: "coach",
    group: "Site",
    keywords: ["zoom", "connect", "pin", "alerts", "push", "preferences"],
  },
  {
    id: "coach-sms-hub",
    title: "SMS Hub",
    description: "Carrier SMS ledger (parked — prefer Messages)",
    href: "/admin/sms-hub",
    workspace: "coach",
    group: "Talk",
    keywords: ["twilio", "text message", "sms workout", "carrier"],
  },
  {
    id: "coach-plan",
    title: "Lesson plan",
    description: "Class day lesson plan builder",
    href: "/admin/plan",
    workspace: "coach",
    group: "Live",
    keywords: ["lesson", "class plan", "session plan"],
  },

  // ── Platform · Commerce ──────────────────────────────────────────
  {
    id: "platform-dashboard",
    title: "Platform dashboard",
    description: "Platform workspace home",
    href: "/admin/platform",
    workspace: "platform",
    group: "Platform",
    keywords: ["ops", "admin home", "super admin"],
  },
  {
    id: "platform-billing",
    title: "Billing",
    description: "Transactions, refunds, subscriptions",
    href: "/admin/billing",
    workspace: "platform",
    group: "Commerce",
    keywords: ["stripe", "money", "charges", "payments desk", "mrr"],
  },
  {
    id: "platform-billing-discounts",
    title: "Billing · Discounts",
    description: "Same discount tools inside Billing desk",
    href: "/admin/billing?tab=discounts",
    workspace: "platform",
    group: "Commerce",
    keywords: ["promo tab", "coupon billing", "promotion codes"],
  },
  {
    id: "platform-billing-refunds",
    title: "Billing · Refunds",
    description: "Full & partial refunds ledger",
    href: "/admin/billing?tab=refunds",
    workspace: "platform",
    group: "Commerce",
    keywords: ["refund", "chargeback", "return money"],
  },
  {
    id: "platform-billing-transactions",
    title: "Billing · Transactions",
    description: "Stripe charges search",
    href: "/admin/billing?tab=transactions",
    workspace: "platform",
    group: "Commerce",
    keywords: ["charges", "payments", "card", "receipts"],
  },
  {
    id: "platform-billing-subscriptions",
    title: "Billing · Subscriptions",
    description: "Active memberships list",
    href: "/admin/billing?tab=subscriptions",
    workspace: "platform",
    group: "Commerce",
    keywords: ["recurring", "cancel", "subscription list"],
  },
  {
    id: "platform-commission",
    title: "Dev & partnership",
    description: "Fee pool, Connect payouts, platform admin fee",
    href: "/admin/commission",
    workspace: "platform",
    group: "Commerce",
    keywords: [
      "commission",
      "connect",
      "payout",
      "275",
      "platform fee",
      "partner",
      "john share",
      "mrr pool",
    ],
  },
  {
    id: "platform-pricing",
    title: "Pricing",
    description: "Membership product prices",
    href: "/admin/pricing",
    workspace: "platform",
    group: "Commerce",
    keywords: ["plans", "ticket prices", "stripe prices", "member business pro"],
  },
  {
    id: "platform-offers",
    title: "Offers",
    description: "Custom packages & merch offers",
    href: "/admin/offers",
    workspace: "platform",
    group: "Commerce",
    keywords: ["packages", "merchandise", "custom training", "quote"],
  },
  {
    id: "platform-users",
    title: "Users",
    description: "Staff & account roles",
    href: "/admin/users",
    workspace: "platform",
    group: "Operations",
    keywords: ["accounts", "roles", "admin users", "instructor", "password"],
  },
  {
    id: "platform-audit",
    title: "Audit log",
    description: "Diligence trail — mark paid, refunds, tips",
    href: "/admin/audit",
    workspace: "platform",
    group: "Operations",
    keywords: ["diligence", "m&a", "history", "compliance", "dsar"],
  },
  {
    id: "platform-reports",
    title: "Reports",
    description: "Ops reports",
    href: "/admin/reports",
    workspace: "platform",
    group: "Operations",
    keywords: ["analytics", "export", "report"],
  },
  {
    id: "platform-insights",
    title: "Insights",
    description: "Member progress & usage insights",
    href: "/admin/insights",
    workspace: "platform",
    group: "Operations",
    keywords: ["analytics", "stats", "progress", "mart"],
  },
  {
    id: "platform-coach-suggestions",
    title: "Coach suggestions",
    description: "Help-assistant suggestions inbox",
    href: "/admin/coach-suggestions",
    workspace: "platform",
    group: "Operations",
    keywords: ["grok", "help", "feedback", "ai suggestions"],
  },
  {
    id: "platform-prescriptions",
    title: "Prescription vars",
    description: "Rep scheme / prescription catalog knobs",
    href: "/admin/prescriptions",
    workspace: "platform",
    group: "System",
    keywords: ["sets", "reps", "scheme", "prescription examples"],
  },

  // ── Public / member surfaces coaches often jump to ───────────────
  {
    id: "public-landing",
    title: "Public site (home)",
    description: "Live marketing home",
    href: "/",
    workspace: "public",
    group: "Public",
    keywords: ["thetrainstation", "marketing", "homepage"],
  },
  {
    id: "public-join",
    title: "Join / tickets",
    description: "Membership plan picker",
    href: "/join",
    workspace: "public",
    group: "Public",
    keywords: ["signup", "pricing public", "plans", "tickets"],
  },
  {
    id: "member-today",
    title: "Member · Today",
    description: "Member app today hub (preview as member)",
    href: "/member/today",
    workspace: "public",
    group: "Member app",
    keywords: ["student today", "member home", "workout today"],
  },
  {
    id: "member-checkout",
    title: "Member · Checkout",
    description: "Where members enter discount codes",
    href: "/member/checkout",
    workspace: "public",
    group: "Member app",
    keywords: ["pay", "promo field", "venmo checkout", "stripe checkout"],
  },
  {
    id: "member-account",
    title: "Member · Account",
    description: "Member account, tips, notifications",
    href: "/member/account",
    workspace: "public",
    group: "Member app",
    keywords: ["tip coach", "profile", "password", "alerts"],
  },
  {
    id: "member-messages",
    title: "Member · Messages",
    description: "Member chat with coach",
    href: "/member/chat",
    workspace: "public",
    group: "Member app",
    keywords: ["member chat", "student messages"],
  },
  {
    id: "member-gear",
    title: "Member · Gear",
    description: "Equipment shop",
    href: "/member/equipment",
    workspace: "public",
    group: "Member app",
    keywords: ["shop", "amazon gear"],
  },
  {
    id: "member-scores",
    title: "Member · Scores",
    description: "Leaderboard / gamification",
    href: "/member/leaderboard",
    workspace: "public",
    group: "Member app",
    keywords: ["leaderboard", "points", "rank"],
  },
  {
    id: "member-book",
    title: "Member · Book Call",
    description: "Book intake / coach call",
    href: "/member/book",
    workspace: "public",
    group: "Member app",
    keywords: ["calendly member", "book meeting"],
  },
];

export type AdminSearchScope = {
  canCoach: boolean;
  canPlatform: boolean;
};

function itemVisible(item: AdminSearchItem, scope: AdminSearchScope): boolean {
  if (item.workspace === "public" || item.workspace === "both") return true;
  if (item.workspace === "coach") return scope.canCoach;
  if (item.workspace === "platform") return scope.canPlatform;
  return true;
}

function scoreItem(item: AdminSearchItem, q: string): number {
  if (!q) return 0;
  const title = item.title.toLowerCase();
  const desc = item.description.toLowerCase();
  const group = item.group.toLowerCase();
  const href = item.href.toLowerCase();
  const kw = item.keywords.map((k) => k.toLowerCase());

  let score = 0;
  if (title === q) score += 100;
  else if (title.startsWith(q)) score += 80;
  else if (title.includes(q)) score += 50;

  if (kw.some((k) => k === q)) score += 70;
  else if (kw.some((k) => k.startsWith(q))) score += 45;
  else if (kw.some((k) => k.includes(q))) score += 30;

  if (group.includes(q)) score += 15;
  if (desc.includes(q)) score += 12;
  if (href.includes(q)) score += 10;

  // Multi-word: all tokens must appear somewhere
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const hay = [title, desc, group, href, ...kw].join(" ");
    if (tokens.every((t) => hay.includes(t))) score += 25;
    else score = 0;
  }

  return score;
}

export function searchAdminApps(
  query: string,
  scope: AdminSearchScope,
  limit = 12,
): AdminSearchItem[] {
  const visible = ADMIN_APP_SEARCH_INDEX.filter((item) => itemVisible(item, scope));
  const q = query.trim().toLowerCase();
  if (!q) {
    // Default: prioritise coach day tools + discounts when empty focus
    const preferred = [
      "coach-dashboard",
      "coach-go-to-today",
      "coach-messages",
      "coach-programs",
      "coach-members",
      "coach-discounts",
      "coach-queue",
      "platform-billing",
    ];
    const ordered = preferred
      .map((id) => visible.find((i) => i.id === id))
      .filter((i): i is AdminSearchItem => Boolean(i));
    const rest = visible.filter((i) => !preferred.includes(i.id));
    return [...ordered, ...rest].slice(0, limit);
  }

  return visible
    .map((item) => ({ item, score: scoreItem(item, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map((r) => r.item);
}
