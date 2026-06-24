import "server-only";

import { BRAND_NAME } from "@/lib/brand";
import { listMembersForCoach } from "@/lib/demo-coach";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { getAllSignInAccounts } from "@/lib/member-accounts-store";
import { listMemberProfiles } from "@/lib/member-profiles-store";
import { addDemoSmsLog, type DemoSmsLogEntry } from "@/lib/sms";

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.thetrainstation.co";
}
import { isDemoMode } from "@/lib/demo-enrollments";
import { getDemoUserSettings } from "@/lib/demo-reminders";
import { prisma } from "@/lib/prisma";

import { sendResendEmail, transactionalSubject } from "@/lib/resend-mail";

export type HubRecipient = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  dailyReminderTime?: string | null;
};

export type HubDeliveryResult = {
  sent: number;
  channel: "email" | "sms" | "simulated";
  logs: Array<{
    userId: string;
    email: string;
    phone?: string;
    message: string;
    sentAt: string;
    emailed?: boolean;
    category?: string;
  }>;
};

/** True when we should use email + in-app hub instead of a paid SMS number. */
export function messageHubActive(): boolean {
  if (process.env.MESSAGE_HUB_MODE === "false") return false;
  if (process.env.MESSAGE_HUB_MODE === "true") return true;
  const twilio =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM;
  return !twilio;
}

export function hubMemberChatUrl(sessionDate?: string): string {
  const base = appBaseUrl();
  if (sessionDate) return `${base}/member/today?date=${sessionDate}`;
  return `${base}/member/chat`;
}

async function sendHubEmail(params: {
  to: string;
  subject: string;
  text: string;
  ctaUrl?: string;
}): Promise<boolean> {
  return sendResendEmail({
    to: params.to,
    subject: params.subject,
    text: params.text,
    ctaUrl: params.ctaUrl,
    ctaLabel: params.ctaUrl ? "Open in The Train Station" : undefined,
    tags: [{ name: "category", value: "message-hub" }],
  });
}

export async function getHubRecipients(): Promise<HubRecipient[]> {
  if (isDemoMode()) {
    const byId = new Map<string, HubRecipient>();

    for (const member of listMembersForCoach()) {
      const settings = getDemoUserSettings(member.id);
      byId.set(member.id, {
        id: member.id,
        email: member.email,
        name: member.name,
        phone: settings.phone || member.phone || null,
        dailyReminderTime: settings.dailyReminderTime ?? null,
      });
    }

    try {
      const profiles = await listMemberProfiles();
      for (const profile of profiles) {
        const directory = resolveDemoUser(profile.userId);
        if (!directory?.email) continue;
        const current = byId.get(profile.userId);
        byId.set(profile.userId, {
          id: profile.userId,
          email: directory.email,
          name: directory.name || current?.name || "Member",
          phone: profile.phone || current?.phone || directory.phone || null,
          dailyReminderTime: profile.dailyReminderTime ?? current?.dailyReminderTime ?? null,
        });
      }
    } catch {}

    try {
      const accounts = await getAllSignInAccounts();
      for (const [email, account] of Object.entries(accounts)) {
        if (account.role !== "MEMBER") continue;
        const directory = resolveDemoUser(account.userId);
        const current = byId.get(account.userId);
        byId.set(account.userId, {
          id: account.userId,
          email: directory?.email || email,
          name: account.name || directory?.name || current?.name || "Member",
          phone: account.phone || current?.phone || directory?.phone || null,
          dailyReminderTime: current?.dailyReminderTime ?? null,
        });
      }
    } catch {}

    return [...byId.values()].filter((u) => u.email.includes("@"));
  }

  const users = await prisma.user.findMany({
    where: { role: "MEMBER", hidden: false },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      dailyReminderTime: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name || u.email.split("@")[0],
    phone: u.phone,
    dailyReminderTime: u.dailyReminderTime,
  }));
}

function personalize(
  message: string,
  user: { name?: string | null; email: string; phone?: string | null },
): string {
  const first = (user.name || user.email.split("@")[0]).split(" ")[0];
  return message
    .replace(/\{name\}/gi, user.name || first)
    .replace(/\{first\}/gi, first)
    .replace(/\{email\}/gi, user.email)
    .replace(/\{phone\}/gi, user.phone || "");
}

async function logHubMessage(
  entry: Omit<DemoSmsLogEntry, "sentAt"> & { sentAt?: string; category?: string },
): Promise<{ sentAt: string }> {
  const withChannel = {
    ...entry,
    source: entry.source || "hub",
    direction: entry.direction || ("outbound" as const),
    phone: entry.phone || "hub",
  };

  if (isDemoMode()) {
    const saved = await addDemoSmsLog(withChannel as DemoSmsLogEntry);
    return { sentAt: saved.sentAt };
  }

  const log = await prisma.smsLog.create({
    data: {
      userId: entry.userId || "unknown",
      phone: withChannel.phone,
      message: entry.message,
    },
  });
  return { sentAt: log.sentAt.toISOString() };
}

export async function sendHubNotification(params: {
  recipient: HubRecipient;
  message: string;
  subject?: string;
  deepLink?: string;
  source?: string;
  category?: string;
  coachName?: string;
}): Promise<{ emailed: boolean; sentAt: string }> {
  const link = params.deepLink || hubMemberChatUrl();
  const coach = params.coachName || "Your coach";
  const first = params.recipient.name.split(" ")[0] || "there";
  const preview =
    params.message.length > 280 ? `${params.message.slice(0, 277)}…` : params.message;

  const subject = params.subject || transactionalSubject("hub");
  const text =
    `Hi ${first},\n\n` +
    `${coach} sent you an update:\n\n` +
    `${preview}\n\n` +
    `Open in The Train Station to read and reply. Your coach never sees your phone number.\n\n` +
    `— ${BRAND_NAME}`;

  const emailed = await sendHubEmail({
    to: params.recipient.email,
    subject,
    text,
    ctaUrl: link,
  });

  const { sentAt } = await logHubMessage({
    userId: params.recipient.id,
    phone: params.recipient.phone || params.recipient.email,
    message: `[Hub${emailed ? " email" : ""}] ${preview} → ${link}`,
    source: params.source || "hub",
    category: params.category,
    direction: "outbound",
  });

  return { emailed, sentAt };
}

export async function sendHubBroadcast(params: {
  userIds?: string[];
  message: string;
  category?: string;
  coachName?: string;
  deepLink?: string;
}): Promise<HubDeliveryResult> {
  let targets = await getHubRecipients();
  if (params.userIds?.length) {
    const idSet = new Set(params.userIds);
    targets = targets.filter((u) => idSet.has(u.id));
  }

  const logs: HubDeliveryResult["logs"] = [];
  let sent = 0;

  for (const recipient of targets) {
    const body = personalize(params.message, recipient);
    const result = await sendHubNotification({
      recipient,
      message: body,
      source: "hub-broadcast",
      category: params.category,
      coachName: params.coachName,
      deepLink: params.deepLink,
    });
    if (result.emailed) sent += 1;
    logs.push({
      userId: recipient.id,
      email: recipient.email,
      phone: recipient.phone || undefined,
      message: body,
      sentAt: result.sentAt,
      emailed: result.emailed,
      category: params.category,
    });
  }

  return {
    sent: messageHubActive() ? sent || logs.length : sent,
    channel: messageHubActive() ? (sent > 0 ? "email" : "simulated") : "sms",
    logs,
  };
}

export async function notifyCoachOfMemberReply(params: {
  memberName: string;
  memberEmail: string;
  message: string;
}): Promise<void> {
  const coachEmail =
    process.env.COACH_NOTIFY_EMAIL?.trim() ||
    process.env.LEAD_NOTIFY_EMAIL?.split(",")[0]?.trim() ||
    "jeremy@thetrainstation.co";

  const link = `${appBaseUrl()}/admin/chat`;
  const preview = params.message.length > 200 ? `${params.message.slice(0, 197)}…` : params.message;

  await sendHubEmail({
    to: coachEmail,
    subject: `${params.memberName} replied — ${BRAND_NAME}`,
    text:
      `${params.memberName} (${params.memberEmail}) sent a message:\n\n` +
      `${preview}\n\n` +
      `Reply in the hub — your phone stays private.`,
    ctaUrl: link,
  });
}