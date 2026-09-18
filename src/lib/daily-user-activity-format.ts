/** Pure helpers for the Daily activity desk. No DB / server-only. */

export const ACTIVITY_TIME_ZONE = "America/Los_Angeles";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DailyActivityEvent = {
  at: string;
  kind: string;
  label: string;
};

export type DailyUserWorkout = {
  name: string;
  completed: boolean;
  progress: number;
};

export type DailyUserActivity = {
  userId: string;
  name: string;
  email: string;
  role: string;
  plan: string | null;
  planLabel: string;
  memberHref: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  headlines: string[];
  workouts: DailyUserWorkout[];
  setsChecked: number;
  exercisesFinished: number;
  joinedZoom: boolean;
  messagesSent: number;
  messagesReceived: number;
  bookings: Array<{ at: string; status: string }>;
  measurements: number;
  payments: Array<{ cents: number; label: string }>;
  signedUp: boolean;
  pages: Array<{ path: string; label: string; views: number }>;
  timeline: DailyActivityEvent[];
  device: string | null;
};

export type DailyQuietMember = {
  userId: string;
  name: string;
  email: string;
  planLabel: string;
  memberHref: string;
};

export type DailyGuestSummary = {
  sessions: number;
  pageViews: number;
  topPages: Array<{ path: string; label: string; views: number }>;
  notableClicks: Array<{ label: string; count: number }>;
};

export type DailyActivityReport = {
  date: string;
  dateLabel: string;
  timeZone: string;
  storage: "database" | "demo";
  users: DailyUserActivity[];
  quietMembers: DailyQuietMember[];
  guests: DailyGuestSummary;
};

export function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && ISO_DATE.test(value));
}

export function addCalendarDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

export function todayIsoInZone(now = new Date(), timeZone = ACTIVITY_TIME_ZONE): string {
  try {
    return now.toLocaleDateString("en-CA", { timeZone });
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function yesterdayIso(now = new Date(), timeZone = ACTIVITY_TIME_ZONE): string {
  return addCalendarDays(todayIsoInZone(now, timeZone), -1);
}

/**
 * Inclusive start / exclusive end for a calendar date in the gym timezone.
 * Tries PDT then PST so DST does not shift the day.
 */
export function pacificDayBounds(iso: string): { start: Date; end: Date } {
  if (!isIsoDate(iso)) {
    throw new Error(`Invalid date ${iso}`);
  }
  for (const offset of ["-07:00", "-08:00"] as const) {
    const start = new Date(`${iso}T00:00:00${offset}`);
    const local = start.toLocaleDateString("en-CA", { timeZone: ACTIVITY_TIME_ZONE });
    if (local === iso) {
      return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
    }
  }
  const start = new Date(`${iso}T00:00:00-07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function formatActivityDateLabel(iso: string, timeZone = ACTIVITY_TIME_ZONE): string {
  const { start } = pacificDayBounds(iso);
  return start.toLocaleDateString("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatActivityTime(iso: string, timeZone = ACTIVITY_TIME_ZONE): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function friendlyPath(pagePath: string | null | undefined): string {
  const path = (pagePath || "").split("?")[0] || "/";
  if (path === "/") return "Homepage";
  if (path.startsWith("/member/today")) return "Today";
  if (path.startsWith("/member/nutrition")) return "Nutrition";
  if (path.startsWith("/member/messages") || path.startsWith("/member/chat")) return "Messages";
  if (path.startsWith("/member/scores")) return "Scores";
  if (path.startsWith("/member/gear")) return "Gear";
  if (path.startsWith("/member/onboard")) return "Onboard";
  if (path.startsWith("/member/measurements")) return "Measurements";
  if (path.startsWith("/member")) return "Member app";
  if (path.startsWith("/join")) return "Tickets";
  if (path.startsWith("/signup")) return "Signup";
  if (path.startsWith("/login")) return "Login";
  if (path.startsWith("/how-it-works") || path.startsWith("/tour")) return "How it Works";
  if (path.startsWith("/admin/day")) return "Dashboard";
  if (path.startsWith("/admin/today")) return "Go to Today";
  if (path.startsWith("/admin/live")) return "Live Floor";
  if (path.startsWith("/admin/programs")) return "Programs";
  if (path.startsWith("/admin/exercises")) return "Exercises";
  if (path.startsWith("/admin/members")) return "Members";
  if (path.startsWith("/admin/chat")) return "Messages";
  if (path.startsWith("/admin/videos")) return "Videos";
  if (path.startsWith("/admin/landing")) return "Landing";
  if (path.startsWith("/admin/assign")) return "Assign";
  if (path.startsWith("/admin/bookings")) return "Bookings";
  if (path.startsWith("/admin/activity")) return "Daily activity";
  if (path.startsWith("/admin")) return "Coach desk";
  return path;
}

export function countCompletedSets(completedSets: unknown): number {
  if (!completedSets) return 0;
  if (Array.isArray(completedSets)) return completedSets.length;
  if (typeof completedSets !== "object") return 0;
  let n = 0;
  for (const value of Object.values(completedSets as Record<string, unknown>)) {
    if (Array.isArray(value)) n += value.length;
    else if (typeof value === "number" && Number.isFinite(value)) n += value;
    else if (value && typeof value === "object") n += Object.keys(value).length;
  }
  return n;
}

export function displayActivityName(name: string | null | undefined, email: string): string {
  const trimmed = (name || "").trim();
  if (trimmed) return trimmed;
  const local = email.split("@")[0] || "Member";
  return local.replace(/[._]/g, " ");
}

export type UserActivityFacts = {
  userId: string;
  name: string;
  email: string;
  role: string;
  plan: string | null;
  planLabel: string;
  memberHref: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  workouts: DailyUserWorkout[];
  classAssigned: string | null;
  classPosted: string | null;
  setsChecked: number;
  exercisesFinished: number;
  joinedZoom: boolean;
  startedZoom: boolean;
  messagesSent: number;
  messagesReceived: number;
  bookings: Array<{ at: string; status: string }>;
  measurements: number;
  payments: Array<{ cents: number; label: string }>;
  signedUp: boolean;
  pages: Array<{ path: string; label: string; views: number }>;
  timeline: DailyActivityEvent[];
  device: string | null;
  coachEdits: string[];
};

function listAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function headlinesFromFacts(facts: UserActivityFacts): string[] {
  const lines: string[] = [];
  if (facts.signedUp) lines.push("Created an account");
  if (facts.payments.length) {
    lines.push(`Paid ${facts.payments.map((p) => p.label).join(", ")}`);
  }
  if (facts.classPosted) lines.push(`Posted class: ${facts.classPosted}`);
  if (facts.classAssigned) lines.push(`On class: ${facts.classAssigned}`);
  if (facts.workouts.length) {
    const grouped = new Map<string, { name: string; n: number; completed: boolean; progress: number }>();
    for (const w of facts.workouts) {
      const cur = grouped.get(w.name);
      if (!cur) grouped.set(w.name, { name: w.name, n: 1, completed: w.completed, progress: w.progress });
      else cur.n += 1;
    }
    const names = [...grouped.values()].map((w) => {
      const base = w.completed ? w.name : `${w.name} (${w.progress}% logged)`;
      return w.n > 1 ? `${base} (×${w.n})` : base;
    });
    lines.push(`Logged ${listAnd(names)}`);
  }
  if (facts.setsChecked > 0) {
    lines.push(
      `Checked ${facts.setsChecked} set${facts.setsChecked === 1 ? "" : "s"}` +
        (facts.exercisesFinished
          ? ` · ${facts.exercisesFinished} exercise${facts.exercisesFinished === 1 ? "" : "s"} finished`
          : ""),
    );
  } else if (facts.exercisesFinished > 0) {
    lines.push(
      `Finished ${facts.exercisesFinished} exercise${facts.exercisesFinished === 1 ? "" : "s"}`,
    );
  }
  if (facts.startedZoom) lines.push("Started live Zoom");
  if (facts.joinedZoom) lines.push("Joined live Zoom");
  if (facts.messagesSent > 0) {
    lines.push(`Sent ${facts.messagesSent} message${facts.messagesSent === 1 ? "" : "s"}`);
  }
  if (facts.messagesReceived > 0 && facts.role === "MEMBER") {
    lines.push(
      `Got ${facts.messagesReceived} coach message${facts.messagesReceived === 1 ? "" : "s"}`,
    );
  }
  if (facts.bookings.length) {
    lines.push(`Booked intro (${facts.bookings[0].status || "pending"})`);
  }
  if (facts.measurements > 0) {
    lines.push(
      `Entered measurements${facts.measurements > 1 ? ` (${facts.measurements} check-ins)` : ""}`,
    );
  }
  if (facts.coachEdits.length) {
    lines.push(`Coach edits: ${listAnd(facts.coachEdits.slice(0, 4))}`);
  }
  if (facts.pages.length && lines.length === 0) {
    lines.push(`Opened ${listAnd(facts.pages.slice(0, 3).map((p) => p.label))}`);
  } else if (facts.pages.length && !facts.workouts.length && facts.setsChecked === 0) {
    const memberPages = facts.pages.filter((p) => !p.path.startsWith("/admin"));
    if (memberPages.length) {
      lines.push(`Visited ${listAnd(memberPages.slice(0, 3).map((p) => p.label))}`);
    }
  }
  if (lines.length === 0) lines.push("Opened the app");
  return lines;
}

export function sortActiveUsers(users: DailyUserActivity[]): DailyUserActivity[] {
  return [...users].sort((a, b) => {
    const aWork = a.workouts.length + a.setsChecked;
    const bWork = b.workouts.length + b.setsChecked;
    if (Boolean(aWork) !== Boolean(bWork)) return aWork ? -1 : 1;
    const aStaff = a.role !== "MEMBER" ? 1 : 0;
    const bStaff = b.role !== "MEMBER" ? 1 : 0;
    if (aStaff !== bStaff) return aStaff - bStaff;
    const aLast = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bLast = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    return bLast - aLast;
  });
}

export function emptyGuestSummary(): DailyGuestSummary {
  return { sessions: 0, pageViews: 0, topPages: [], notableClicks: [] };
}

export function emptyDailyActivityReport(date: string, storage: "database" | "demo"): DailyActivityReport {
  return {
    date,
    dateLabel: isIsoDate(date) ? formatActivityDateLabel(date) : date,
    timeZone: ACTIVITY_TIME_ZONE,
    storage,
    users: [],
    quietMembers: [],
    guests: emptyGuestSummary(),
  };
}
