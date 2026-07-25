export type AdminNavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  badge?: "chat";
  leadsBadge?: boolean;
  queueBadge?: boolean;
  coachSuggestionsBadge?: boolean;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

/** Show leads in coach nav unless explicitly disabled (launch default: on). */
const SHOW_LEADS = process.env.NEXT_PUBLIC_SHOW_ADMIN_LEADS !== "false";

const peopleItems: AdminNavItem[] = [
  {
    href: "/admin/queue",
    label: "Queue",
    match: (p) => p.startsWith("/admin/queue"),
    queueBadge: true,
  },
  {
    href: "/admin/members",
    label: "Members",
    match: (p) => p.startsWith("/admin/members"),
  },
  ...(SHOW_LEADS
    ? [
        {
          href: "/admin/leads",
          label: "Leads",
          match: (p: string) => p.startsWith("/admin/leads"),
          leadsBadge: true,
        },
      ]
    : []),
  {
    href: "/admin/bookings",
    label: "Bookings",
    match: (p) => p.startsWith("/admin/bookings"),
  },
];

export const COACH_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/admin/day",
        label: "Dashboard",
        match: (p) => p === "/admin" || p.startsWith("/admin/day"),
      },
    ],
  },
  {
    label: "People",
    items: peopleItems,
  },
  {
    /** First-class coach money tool — promo codes for Checkout (not buried under Site). */
    label: "Discount codes",
    items: [
      {
        href: "/admin/discounts",
        label: "Discount codes",
        match: (p) => p.startsWith("/admin/discounts"),
      },
    ],
  },
  {
    label: "Talk",
    items: [
      {
        href: "/admin/chat",
        label: "Messages",
        match: (p) => p.startsWith("/admin/chat"),
        badge: "chat",
      },
      // SMS Hub hidden from coach nav — messaging is in-app + app badge only (carrier SMS parked).
    ],
  },
  {
    label: "Live",
    items: [
      {
        href: "/admin/live",
        label: "Live Floor",
        match: (p) => p.startsWith("/admin/live"),
      },
      {
        href: "/admin/assign",
        label: "Assign",
        match: (p) => p.startsWith("/admin/assign"),
      },
      {
        href: "/admin/today",
        label: "Go to Today",
        match: (p) => p.startsWith("/admin/today"),
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        href: "/admin/programs",
        label: "Programs",
        match: (p) => p.startsWith("/admin/programs"),
      },
      {
        href: "/admin/templates",
        label: "Templates",
        match: (p) => p.startsWith("/admin/templates"),
      },
      {
        href: "/admin/workouts",
        label: "Workouts",
        match: (p) => p.startsWith("/admin/workouts"),
      },
      {
        href: "/admin/exercises",
        label: "Exercises",
        match: (p) => p.startsWith("/admin/exercises"),
      },
      {
        href: "/admin/equipment",
        label: "Equipment",
        match: (p) => p.startsWith("/admin/equipment"),
      },
    ],
  },
  {
    label: "Site",
    items: [
      {
        href: "/admin/landing",
        label: "Landing",
        match: (p) => p.startsWith("/admin/landing"),
      },
      {
        href: "/admin/gamification",
        label: "Gamification",
        match: (p) => p.startsWith("/admin/gamification"),
      },
      {
        href: "/admin/settings",
        label: "Settings",
        match: (p) => p.startsWith("/admin/settings"),
      },
    ],
  },
];

/** Flat list for callers that still expect a single array. */
export const COACH_NAV_ITEMS: AdminNavItem[] = COACH_NAV_GROUPS.flatMap((g) => g.items);

export const PLATFORM_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/admin/platform",
        label: "Dashboard",
        match: (p) => p === "/admin/platform",
      },
    ],
  },
  {
    label: "Commerce",
    items: [
      {
        href: "/admin/discounts",
        label: "Discount codes",
        match: (p) => p.startsWith("/admin/discounts"),
      },
      {
        href: "/admin/billing",
        label: "Billing",
        match: (p) => p.startsWith("/admin/billing"),
      },
      {
        href: "/admin/commission",
        label: "Dev & partnership",
        match: (p) => p.startsWith("/admin/commission"),
      },
      {
        href: "/admin/pricing",
        label: "Pricing",
        match: (p) => p.startsWith("/admin/pricing"),
      },
      {
        href: "/admin/offers",
        label: "Offers",
        match: (p) => p.startsWith("/admin/offers"),
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        match: (p) => p.startsWith("/admin/users"),
      },
      {
        href: "/admin/audit",
        label: "Audit log",
        match: (p) => p.startsWith("/admin/audit"),
      },
      {
        href: "/admin/reports",
        label: "Reports",
        match: (p) => p.startsWith("/admin/reports"),
      },
      {
        href: "/admin/insights",
        label: "Insights",
        match: (p) => p.startsWith("/admin/insights"),
      },
      {
        href: "/admin/coach-suggestions",
        label: "Coach suggestions",
        match: (p) => p.startsWith("/admin/coach-suggestions"),
        coachSuggestionsBadge: true,
      },
    ],
  },
  {
    /** Super-admin catalog knobs — not day-to-day coach UI. */
    label: "System",
    items: [
      {
        href: "/admin/prescriptions",
        label: "Prescription vars",
        match: (p) => p.startsWith("/admin/prescriptions"),
      },
    ],
  },
];

export const PLATFORM_NAV_ITEMS: AdminNavItem[] = PLATFORM_NAV_GROUPS.flatMap((g) => g.items);

const PLATFORM_PATH_PREFIXES = [
  "/admin/platform",
  "/admin/billing",
  "/admin/commission",
  "/admin/pricing",
  "/admin/offers",
  "/admin/users",
  "/admin/audit",
  "/admin/reports",
  "/admin/insights",
  "/admin/coach-suggestions",
  "/admin/prescriptions",
];

export function isPlatformAdminPath(pathname: string): boolean {
  return PLATFORM_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function defaultCoachAdminPath(): string {
  return "/admin/day";
}

export function defaultPlatformAdminPath(): string {
  return "/admin/platform";
}