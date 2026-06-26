export type AdminNavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  badge?: "chat";
  leadsBadge?: boolean;
};

const SHOW_LEADS = process.env.NEXT_PUBLIC_SHOW_ADMIN_LEADS === "true";

export const COACH_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Overview", match: (p) => p === "/admin" },
  {
    href: "/admin/programs",
    label: "Programs",
    match: (p) => p.startsWith("/admin/programs"),
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
    href: "/admin/members",
    label: "Members",
    match: (p) => p.startsWith("/admin/members"),
  },
  {
    href: "/admin/today",
    label: "Today",
    match: (p) => p.startsWith("/admin/today"),
  },
  {
    href: "/admin/landing",
    label: "Landing",
    match: (p) => p.startsWith("/admin/landing"),
  },
  {
    href: "/admin/chat",
    label: "Messages",
    match: (p) => p.startsWith("/admin/chat"),
    badge: "chat",
  },
  {
    href: "/admin/sms-hub",
    label: "SMS Hub",
    match: (p) => p.startsWith("/admin/sms-hub"),
  },
  {
    href: "/admin/bookings",
    label: "Bookings",
    match: (p) => p.startsWith("/admin/bookings"),
  },
];

export const PLATFORM_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin/platform",
    label: "Overview",
    match: (p) => p === "/admin/platform",
  },
  {
    href: "/admin/commission",
    label: "Payments",
    match: (p) => p.startsWith("/admin/commission"),
  },
  {
    href: "/admin/offers",
    label: "Offers",
    match: (p) => p.startsWith("/admin/offers"),
  },
  {
    href: "/admin/users",
    label: "Users",
    match: (p) => p.startsWith("/admin/users"),
  },
  {
    href: "/admin/reports",
    label: "Reports",
    match: (p) => p.startsWith("/admin/reports"),
  },
];

const PLATFORM_PATH_PREFIXES = [
  "/admin/platform",
  "/admin/commission",
  "/admin/offers",
  "/admin/users",
  "/admin/reports",
];

export function isPlatformAdminPath(pathname: string): boolean {
  return PLATFORM_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function defaultCoachAdminPath(): string {
  return "/admin";
}

export function defaultPlatformAdminPath(): string {
  return "/admin/platform";
}