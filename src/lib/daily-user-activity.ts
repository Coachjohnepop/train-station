import "server-only";

import { memberCardPath } from "@/lib/member-card-path";
import { isDatabaseConfigured } from "@/lib/database-config";
import { isDemoMode } from "@/lib/demo-exercises";
import { signupPlanLabel, type SignupPlan } from "@/lib/signup-plans";
import {
  ACTIVITY_TIME_ZONE,
  countCompletedSets,
  displayActivityName,
  emptyDailyActivityReport,
  emptyGuestSummary,
  formatActivityDateLabel,
  friendlyPath,
  headlinesFromFacts,
  isIsoDate,
  pacificDayBounds,
  sortActiveUsers,
  yesterdayIso,
  type DailyActivityEvent,
  type DailyActivityReport,
  type DailyGuestSummary,
  type DailyQuietMember,
  type DailyUserActivity,
  type UserActivityFacts,
} from "@/lib/daily-user-activity-format";

const SKIP_EMAIL = /@example\.com$/i;
const DEMO_MEMBER_EMAIL = /@(thetrainstation\.co)$/i;
const EVENT_CAP = 12_000;
const TIMELINE_CAP = 14;

type PageCount = { path: string; label: string; views: number };

function planLabelFor(plan: string | null | undefined): string {
  if (!plan) return "—";
  return signupPlanLabel(plan as SignupPlan);
}

function touchTime(current: string | null, next: Date | string | null | undefined, mode: "min" | "max"): string | null {
  if (!next) return current;
  const iso = typeof next === "string" ? next : next.toISOString();
  if (!current) return iso;
  if (mode === "min") return iso < current ? iso : current;
  return iso > current ? iso : current;
}

function addPage(pages: Map<string, number>, path: string | null | undefined) {
  const key = (path || "/").split("?")[0] || "/";
  pages.set(key, (pages.get(key) ?? 0) + 1);
}

function pageList(pages: Map<string, number>, take = 6): PageCount[] {
  return [...pages.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([path, views]) => ({ path, label: friendlyPath(path), views }));
}

function pushTimeline(list: DailyActivityEvent[], event: DailyActivityEvent) {
  if (list.length >= TIMELINE_CAP) return;
  const last = list[list.length - 1];
  if (last && last.kind === event.kind && last.label === event.label) return;
  list.push(event);
}

function moneyLabel(cents: number, currency = "usd"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(0)}`;
  }
}

function notableClickLabel(text: string | null | undefined, action: string | null | undefined): string | null {
  const raw = `${text || ""} ${action || ""}`.replace(/\s+/g, " ").trim();
  if (!raw) return null;
  if (/^set \d+$/i.test(raw)) return null;
  if (raw.length > 80) return `${raw.slice(0, 80)}…`;
  return raw;
}

export async function getDailyUserActivity(dateInput?: string | null): Promise<DailyActivityReport> {
  const date = isIsoDate(dateInput) ? dateInput : yesterdayIso();

  if (!isDatabaseConfigured() || isDemoMode()) {
    return emptyDailyActivityReport(date, "demo");
  }

  const { prisma } = await import("@/lib/prisma");
  const { start, end } = pacificDayBounds(date);

  const [
    users,
    profiles,
    events,
    logs,
    liveSessions,
    gami,
    messages,
    bookings,
    measurements,
    payments,
    classSessions,
    zoomDay,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { hidden: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.memberProfile.findMany({
      select: { userId: true, plan: true, paymentStatus: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: "asc" },
      take: EVENT_CAP,
      select: {
        occurredAt: true,
        eventType: true,
        pagePath: true,
        elementText: true,
        clickAction: true,
        userId: true,
        anonymousId: true,
        sessionKey: true,
        deviceType: true,
      },
    }),
    prisma.workoutLog.findMany({
      where: { performedAt: { gte: start, lt: end } },
      select: {
        userId: true,
        performedAt: true,
        completed: true,
        progress: true,
        workout: { select: { name: true } },
      },
    }),
    prisma.liveWorkoutSession.findMany({
      where: { sessionDate: date },
      select: {
        userId: true,
        workoutId: true,
        finishedExercises: true,
        completedSets: true,
        updatedAt: true,
      },
    }),
    prisma.gamificationEvent.findMany({
      where: { at: { gte: start, lt: end } },
      select: { userId: true, type: true, label: true, at: true, points: true },
    }),
    prisma.coachChatMessage.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: {
        authorId: true,
        authorRole: true,
        authorName: true,
        body: true,
        createdAt: true,
        thread: { select: { memberId: true } },
      },
    }),
    prisma.booking.findMany({
      where: {
        OR: [
          { createdAt: { gte: start, lt: end } },
          { scheduledAt: { gte: start, lt: end } },
        ],
      },
      select: {
        userId: true,
        memberEmail: true,
        scheduledAt: true,
        createdAt: true,
        status: true,
      },
    }),
    prisma.userMeasurement.findMany({
      where: { measuredAt: { gte: start, lt: end } },
      select: { userId: true, measuredAt: true, weightLbs: true },
    }),
    prisma.factSubscriptionPayment.findMany({
      where: { paidAt: { gte: start, lt: end }, status: "paid" },
      select: { userId: true, amountCents: true, currency: true, paidAt: true, tierSlug: true },
    }),
    prisma.coachTodaySession.findMany({
      where: {
        OR: [{ sessionDate: date }, { createdAt: { gte: start, lt: end } }],
      },
      select: {
        sessionDate: true,
        title: true,
        userIds: true,
        createdAt: true,
        createdBy: true,
      },
    }),
    prisma.liveClassZoomDay.findUnique({
      where: { sessionDate: date },
      select: { record: true, updatedAt: true },
    }).catch(() => null),
  ]);

  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  const liveWorkoutIds = [...new Set(liveSessions.map((s) => s.workoutId).filter(Boolean))];
  const liveWorkouts = liveWorkoutIds.length
    ? await prisma.workout.findMany({
        where: { id: { in: liveWorkoutIds } },
        select: { id: true, name: true },
      })
    : [];
  const workoutNameById = new Map(liveWorkouts.map((w) => [w.id, w.name]));

  type Bag = UserActivityFacts & {
    pagesMap: Map<string, number>;
  };

  const bags = new Map<string, Bag>();

  function bagFor(userId: string): Bag | null {
    const existing = bags.get(userId);
    if (existing) return existing;
    const user = userById.get(userId);
    if (!user || SKIP_EMAIL.test(user.email)) return null;
    const profile = profileByUser.get(userId);
    const next: Bag = {
      userId,
      name: displayActivityName(user.name, user.email),
      email: user.email,
      role: user.role,
      plan: profile?.plan ?? null,
      planLabel: planLabelFor(profile?.plan),
      memberHref: user.role === "MEMBER" ? memberCardPath(userId) : `/admin/users?q=${encodeURIComponent(user.email)}`,
      firstSeenAt: null,
      lastSeenAt: null,
      workouts: [],
      classAssigned: null,
      classPosted: null,
      setsChecked: 0,
      exercisesFinished: 0,
      joinedZoom: false,
      startedZoom: false,
      messagesSent: 0,
      messagesReceived: 0,
      bookings: [],
      measurements: 0,
      payments: [],
      signedUp: false,
      pages: [],
      timeline: [],
      device: null,
      coachEdits: [],
      pagesMap: new Map(),
    };
    bags.set(userId, next);
    return next;
  }

  for (const user of users) {
    if (user.createdAt >= start && user.createdAt < end && !SKIP_EMAIL.test(user.email)) {
      const bag = bagFor(user.id);
      if (bag) {
        bag.signedUp = true;
        bag.firstSeenAt = touchTime(bag.firstSeenAt, user.createdAt, "min");
        bag.lastSeenAt = touchTime(bag.lastSeenAt, user.createdAt, "max");
        pushTimeline(bag.timeline, {
          at: user.createdAt.toISOString(),
          kind: "signup",
          label: "Created account",
        });
      }
    }
  }

  for (const event of events) {
    if (!event.userId) continue;
    const bag = bagFor(event.userId);
    if (!bag) continue;
    bag.firstSeenAt = touchTime(bag.firstSeenAt, event.occurredAt, "min");
    bag.lastSeenAt = touchTime(bag.lastSeenAt, event.occurredAt, "max");
    if (event.deviceType && !bag.device) bag.device = event.deviceType;
    if (event.eventType === "page_view") addPage(bag.pagesMap, event.pagePath);
    if (event.eventType === "live_session_joined") {
      bag.joinedZoom = true;
      pushTimeline(bag.timeline, {
        at: event.occurredAt.toISOString(),
        kind: "zoom",
        label: "Joined live Zoom",
      });
    }
    if (event.eventType === "coach_content_edit") {
      const label = notableClickLabel(event.elementText, event.clickAction) || "Edited content";
      if (!bag.coachEdits.includes(label)) bag.coachEdits.push(label);
      pushTimeline(bag.timeline, {
        at: event.occurredAt.toISOString(),
        kind: "edit",
        label,
      });
    }
    if (event.eventType === "page_click") {
      const label = notableClickLabel(event.elementText, event.clickAction);
      if (label && /join|deploy|book|start membership|ping coach|replace video|save/i.test(label)) {
        pushTimeline(bag.timeline, {
          at: event.occurredAt.toISOString(),
          kind: "click",
          label,
        });
      }
    }
  }

  for (const log of logs) {
    const bag = bagFor(log.userId);
    if (!bag) continue;
    const name = log.workout?.name || "Workout";
    bag.workouts.push({ name, completed: log.completed, progress: log.progress });
    bag.firstSeenAt = touchTime(bag.firstSeenAt, log.performedAt, "min");
    bag.lastSeenAt = touchTime(bag.lastSeenAt, log.performedAt, "max");
    pushTimeline(bag.timeline, {
      at: log.performedAt.toISOString(),
      kind: "workout",
      label: log.completed ? `Logged ${name}` : `Logged ${name} (${log.progress}%)`,
    });
  }

  for (const session of liveSessions) {
    const bag = bagFor(session.userId);
    if (!bag) continue;
    const sets = countCompletedSets(session.completedSets);
    const finished = Array.isArray(session.finishedExercises) ? session.finishedExercises.length : 0;
    bag.setsChecked += sets;
    bag.exercisesFinished += finished;
    bag.firstSeenAt = touchTime(bag.firstSeenAt, session.updatedAt, "min");
    bag.lastSeenAt = touchTime(bag.lastSeenAt, session.updatedAt, "max");
    const workoutName = workoutNameById.get(session.workoutId);
    if (sets > 0 || finished > 0) {
      pushTimeline(bag.timeline, {
        at: session.updatedAt.toISOString(),
        kind: "sets",
        label:
          `${sets} set${sets === 1 ? "" : "s"} checked` +
          (workoutName ? ` on ${workoutName}` : "") +
          (finished ? ` · ${finished} finished` : ""),
      });
    }
  }

  for (const ev of gami) {
    const bag = bagFor(ev.userId);
    if (!bag) continue;
    bag.firstSeenAt = touchTime(bag.firstSeenAt, ev.at, "min");
    bag.lastSeenAt = touchTime(bag.lastSeenAt, ev.at, "max");
    pushTimeline(bag.timeline, {
      at: ev.at.toISOString(),
      kind: "score",
      label: `${ev.label || ev.type} (+${ev.points})`,
    });
  }

  for (const message of messages) {
    const system = /^system$/i.test(message.authorRole || "") || /train station/i.test(message.authorName || "");
    if (!system) {
      const sender = bagFor(message.authorId);
      if (sender) {
        sender.messagesSent += 1;
        sender.firstSeenAt = touchTime(sender.firstSeenAt, message.createdAt, "min");
        sender.lastSeenAt = touchTime(sender.lastSeenAt, message.createdAt, "max");
        const snippet = (message.body || "").replace(/\s+/g, " ").trim().slice(0, 80);
        pushTimeline(sender.timeline, {
          at: message.createdAt.toISOString(),
          kind: "message",
          label: snippet ? `Sent: ${snippet}` : "Sent a message",
        });
      }
    }
    const memberId = message.thread?.memberId;
    if (memberId && memberId !== message.authorId) {
      const member = bagFor(memberId);
      if (member) {
        if (!system) member.messagesReceived += 1;
        member.firstSeenAt = touchTime(member.firstSeenAt, message.createdAt, "min");
        member.lastSeenAt = touchTime(member.lastSeenAt, message.createdAt, "max");
      }
    }
  }

  for (const booking of bookings) {
    const user =
      (booking.userId ? userById.get(booking.userId) : null) ||
      userByEmail.get((booking.memberEmail || "").toLowerCase());
    if (!user) continue;
    const bag = bagFor(user.id);
    if (!bag) continue;
    bag.bookings.push({ at: booking.scheduledAt.toISOString(), status: booking.status });
    bag.firstSeenAt = touchTime(bag.firstSeenAt, booking.createdAt, "min");
    bag.lastSeenAt = touchTime(bag.lastSeenAt, booking.createdAt, "max");
    pushTimeline(bag.timeline, {
      at: booking.createdAt.toISOString(),
      kind: "booking",
      label: `Intro booking (${booking.status})`,
    });
  }

  for (const row of measurements) {
    const bag = bagFor(row.userId);
    if (!bag) continue;
    bag.measurements += 1;
    bag.firstSeenAt = touchTime(bag.firstSeenAt, row.measuredAt, "min");
    bag.lastSeenAt = touchTime(bag.lastSeenAt, row.measuredAt, "max");
    const weight = row.weightLbs != null ? ` · ${row.weightLbs} lb` : "";
    pushTimeline(bag.timeline, {
      at: row.measuredAt.toISOString(),
      kind: "measure",
      label: `Measurements${weight}`,
    });
  }

  for (const pay of payments) {
    if (!pay.userId) continue;
    const bag = bagFor(pay.userId);
    if (!bag) continue;
    const label = moneyLabel(pay.amountCents, pay.currency);
    bag.payments.push({ cents: pay.amountCents, label });
    bag.firstSeenAt = touchTime(bag.firstSeenAt, pay.paidAt, "min");
    bag.lastSeenAt = touchTime(bag.lastSeenAt, pay.paidAt, "max");
    pushTimeline(bag.timeline, {
      at: pay.paidAt.toISOString(),
      kind: "pay",
      label: `Paid ${label}`,
    });
  }

  for (const session of classSessions) {
    const title = session.title || "Class";
    if (session.sessionDate === date) {
      for (const userId of session.userIds || []) {
        const bag = bagFor(userId);
        if (bag && !bag.classAssigned) bag.classAssigned = title;
      }
    }
    if (session.createdAt >= start && session.createdAt < end) {
      const creator =
        (session.createdBy && userById.get(session.createdBy)) ||
        (session.createdBy ? userByEmail.get(session.createdBy.toLowerCase()) : null) ||
        users.find((u) => u.role === "INSTRUCTOR" || u.role === "ADMIN");
      if (creator) {
        const bag = bagFor(creator.id);
        if (bag) {
          bag.classPosted = `${title} (${session.userIds?.length || 0} on roster)`;
          bag.firstSeenAt = touchTime(bag.firstSeenAt, session.createdAt, "min");
          bag.lastSeenAt = touchTime(bag.lastSeenAt, session.createdAt, "max");
          pushTimeline(bag.timeline, {
            at: session.createdAt.toISOString(),
            kind: "class",
            label: `Posted ${title} for ${session.sessionDate}`,
          });
        }
      }
    }
  }

  const zoomRecord =
    zoomDay?.record && typeof zoomDay.record === "object"
      ? (zoomDay.record as { hostStartedAt?: string; hostCoachEmail?: string | null })
      : null;
  if (zoomRecord?.hostStartedAt) {
    const started = new Date(zoomRecord.hostStartedAt);
    if (started >= start && started < end) {
      const host =
        (zoomRecord.hostCoachEmail
          ? userByEmail.get(zoomRecord.hostCoachEmail.toLowerCase())
          : null) || users.find((u) => u.role === "INSTRUCTOR" || u.role === "ADMIN");
      if (host) {
        const bag = bagFor(host.id);
        if (bag) {
          bag.startedZoom = true;
          bag.firstSeenAt = touchTime(bag.firstSeenAt, started, "min");
          bag.lastSeenAt = touchTime(bag.lastSeenAt, started, "max");
          pushTimeline(bag.timeline, {
            at: started.toISOString(),
            kind: "zoom",
            label: "Started live Zoom",
          });
        }
      }
    }
  }

  const guests: DailyGuestSummary = emptyGuestSummary();
  const guestPages = new Map<string, number>();
  const guestClicks = new Map<string, number>();
  const guestSessions = new Set<string>();
  for (const event of events) {
    if (event.userId) continue;
    if (event.sessionKey) guestSessions.add(event.sessionKey);
    else if (event.anonymousId) guestSessions.add(event.anonymousId);
    if (event.eventType === "page_view") {
      guests.pageViews += 1;
      addPage(guestPages, event.pagePath);
    }
    if (event.eventType === "page_click") {
      const label = notableClickLabel(event.elementText, event.clickAction);
      if (label) guestClicks.set(label, (guestClicks.get(label) ?? 0) + 1);
    }
  }
  guests.sessions = guestSessions.size;
  guests.topPages = pageList(guestPages, 8);
  guests.notableClicks = [...guestClicks.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));

  const activeUsers: DailyUserActivity[] = [];
  for (const bag of bags.values()) {
    bag.pages = pageList(bag.pagesMap, 6);
    bag.timeline.sort((a, b) => a.at.localeCompare(b.at));
    const hasSignal =
      bag.workouts.length > 0 ||
      bag.setsChecked > 0 ||
      bag.exercisesFinished > 0 ||
      bag.joinedZoom ||
      bag.startedZoom ||
      bag.messagesSent > 0 ||
      bag.bookings.length > 0 ||
      bag.measurements > 0 ||
      bag.payments.length > 0 ||
      bag.signedUp ||
      bag.classPosted ||
      bag.pagesMap.size > 0 ||
      bag.coachEdits.length > 0;
    if (!hasSignal) continue;
    activeUsers.push({
      userId: bag.userId,
      name: bag.name,
      email: bag.email,
      role: bag.role,
      plan: bag.plan,
      planLabel: bag.planLabel,
      memberHref: bag.memberHref,
      firstSeenAt: bag.firstSeenAt,
      lastSeenAt: bag.lastSeenAt,
      headlines: headlinesFromFacts(bag),
      workouts: bag.workouts,
      setsChecked: bag.setsChecked,
      exercisesFinished: bag.exercisesFinished,
      joinedZoom: bag.joinedZoom,
      messagesSent: bag.messagesSent,
      messagesReceived: bag.messagesReceived,
      bookings: bag.bookings,
      measurements: bag.measurements,
      payments: bag.payments,
      signedUp: bag.signedUp,
      pages: bag.pages,
      timeline: bag.timeline,
      device: bag.device,
    });
  }

  const activeIds = new Set(activeUsers.map((u) => u.userId));
  const quietMembers: DailyQuietMember[] = users
    .filter(
      (u) =>
        u.role === "MEMBER" &&
        !activeIds.has(u.id) &&
        !SKIP_EMAIL.test(u.email) &&
        !DEMO_MEMBER_EMAIL.test(u.email),
    )
    .map((u) => ({
      userId: u.id,
      name: displayActivityName(u.name, u.email),
      email: u.email,
      planLabel: planLabelFor(profileByUser.get(u.id)?.plan),
      memberHref: memberCardPath(u.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    date,
    dateLabel: formatActivityDateLabel(date),
    timeZone: ACTIVITY_TIME_ZONE,
    storage: "database",
    users: sortActiveUsers(activeUsers),
    quietMembers,
    guests,
  };
}

export { yesterdayIso, isIsoDate };
