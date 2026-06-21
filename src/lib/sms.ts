import path from "path";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "./demo-enrollments";
import { DEMO_USER_DIRECTORY, resolveDemoUserByEmail } from "@/lib/demo-user-directory";
import { listMembersForCoach } from "@/lib/demo-coach";
import { COACH_CALENDLY_URL } from "@/lib/brand";
import { memberProgramStartPath } from "@/lib/member-destinations";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";

export type DemoSmsLogEntry = {
  userId?: string;
  phone: string;
  message: string;
  source: string;
  direction?: "inbound" | "outbound";
  category?: string;
  taskDetails?: unknown;
  sentAt: string;
  smsLogId?: string;
};

type SmsLogStore = {
  logs: DemoSmsLogEntry[];
};

const DEV_FILE = path.join(process.cwd(), "prisma", "sms-logs.dev.json");
const BLOB_PATH = "demo/sms-logs.json";
const MAX_LOGS = 200;

let memoryStore: SmsLogStore | null = null;

let demoPhoneUsers = [
  { id: "demo-user-john-steph", email: "john@lemonvoice.com", name: "John & Steph", phone: "(555) 111-2235", dailyReminderTime: "06:30" },
  { id: "demo-user", email: "demo@thetrainstation.co", name: "Alex", phone: "(555) 987-6543", dailyReminderTime: "07:30" },
  { id: "demo-user-john", email: "chad@thetrainstation.co", name: "Chad", phone: "(555) 111-2233", dailyReminderTime: "06:30" },
  { id: "demo-user-stephanie", email: "kaite@thetrainstation.co", name: "Katie", phone: "(555) 111-2234", dailyReminderTime: "06:30" },
  { id: "demo-user-2", email: "jordan.member@example.com", name: "Jordan Lee", phone: "(555) 222-3344", dailyReminderTime: "08:00" },
  { id: "demo-coach-jeremy", email: "jeremy@thetrainstation.co", name: "Coach Jeremy", phone: "(555) 123-0001", dailyReminderTime: null },
];

function emptyStore(): SmsLogStore {
  return { logs: [] };
}

function setMemory(store: SmsLogStore) {
  memoryStore = store;
}

function normalizeStore(raw: unknown): SmsLogStore {
  if (Array.isArray(raw)) {
    return { logs: raw as DemoSmsLogEntry[] };
  }
  if (raw && typeof raw === "object" && Array.isArray((raw as SmsLogStore).logs)) {
    return { logs: (raw as SmsLogStore).logs };
  }
  return emptyStore();
}

export async function hydrateSmsLogs(): Promise<SmsLogStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory,
    fallback: emptyStore,
  });
  const normalized = normalizeStore(hydrated);
  if (!memoryStore || normalized.logs !== (hydrated as SmsLogStore).logs) {
    setMemory(normalized);
  }
  return normalized;
}

function readStore(): SmsLogStore {
  if (memoryStore) return memoryStore;
  memoryStore = normalizeStore(readLocalJson<unknown>(DEV_FILE));
  return memoryStore;
}

async function writeStore(store: SmsLogStore) {
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory,
  });
}

export async function getDemoSmsLogs(): Promise<DemoSmsLogEntry[]> {
  await hydrateSmsLogs();
  return [...readStore().logs];
}

export async function addDemoSmsLog(entry: Omit<DemoSmsLogEntry, "sentAt"> & { sentAt?: string }) {
  await hydrateSmsLogs();
  const store = readStore();
  const withMeta: DemoSmsLogEntry = {
    ...entry,
    sentAt: entry.sentAt || new Date().toISOString(),
  };
  store.logs.unshift(withMeta);
  if (store.logs.length > MAX_LOGS) store.logs.length = MAX_LOGS;
  await writeStore(store);
  return withMeta;
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function phonesMatch(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  return da.slice(-10) === db.slice(-10);
}

export function toE164(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

export async function getUsersWithPhones() {
  if (isDemoMode()) {
    return demoPhoneUsers.filter((u) => !!u.phone).map((u) => ({ ...u }));
  }
  const users = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, email: true, name: true, phone: true, dailyReminderTime: true },
    orderBy: { createdAt: "desc" },
  });
  return users.filter((u) => u.phone).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone!,
    dailyReminderTime: u.dailyReminderTime,
  }));
}

export async function findUserByPhone(inboundPhone: string) {
  const users = await getUsersWithPhones();
  return users.find((u) => phonesMatch(u.phone, inboundPhone)) ?? null;
}

function personalize(message: string, user: { name?: string | null; email: string; phone: string }) {
  const first = (user.name || user.email.split("@")[0]).split(" ")[0];
  return message
    .replace(/\{name\}/gi, user.name || first)
    .replace(/\{first\}/gi, first)
    .replace(/\{email\}/gi, user.email)
    .replace(/\{phone\}/gi, user.phone);
}

function twilioConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

async function deliverSms(phone: string, message: string): Promise<boolean> {
  const to = toE164(phone);
  if (twilioConfigured()) {
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      await client.messages.create({
        from: process.env.TWILIO_FROM!,
        to,
        body: message,
      });
      return true;
    } catch (e) {
      console.error("Twilio send failed", e);
      return false;
    }
  }
  console.log(`[SMS SIMULATED — set TWILIO_* envs] -> ${to}: ${message}`);
  return true;
}

export function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.thetrainstation.co";
}

export function coachAlertMessage(params: { sessionDate?: string; firstName?: string }) {
  const base = appBaseUrl();
  const link = params.sessionDate
    ? `${base}/member/today?date=${params.sessionDate}`
    : `${base}/member/chat`;
  const hi = params.firstName ? `Hi ${params.firstName}, ` : "";
  return `${hi}New update from Coach Jeremy — open The Train Station: ${link}`;
}

function coachReplySmsBody(message: string, firstName?: string) {
  const base = appBaseUrl();
  const link = `${base}/member/chat`;
  const hi = firstName ? `Hi ${firstName}, ` : "";
  const preview = message.length > 140 ? `${message.slice(0, 137)}…` : message;
  return `${hi}Coach Jeremy: ${preview} — Reply: ${link}`;
}

function welcomeSmsBody(params: { firstName: string; programSlug?: string }) {
  const base = appBaseUrl();
  const slug = params.programSlug || "adult";
  const start = `${base}${memberProgramStartPath(slug)}`;
  return (
    `Hi ${params.firstName}, welcome to The Train Station! Coach Jeremy here. ` +
    `Your setup is done — start Day 1: ${start} ` +
    `Book your intro call: ${COACH_CALENDLY_URL}`
  );
}

export async function sendWelcomeSms(params: {
  userId: string;
  phone: string;
  name: string;
  programSlug?: string;
}) {
  const phone = params.phone?.trim();
  if (!phone) return { sent: 0, reason: "no_phone" as const };

  const first = (params.name || "there").trim().split(/\s+/)[0] || "there";
  const body = welcomeSmsBody({ firstName: first, programSlug: params.programSlug });
  const ok = await deliverSms(phone, body);
  if (!ok) return { sent: 0, reason: "delivery_failed" as const };

  const logEntry = {
    userId: params.userId,
    phone,
    message: body,
    source: "welcome",
    direction: "outbound" as const,
  };

  if (isDemoMode()) {
    const saved = await addDemoSmsLog(logEntry);
    return { sent: 1, phone, sentAt: saved.sentAt };
  }

  const log = await prisma.smsLog.create({
    data: { userId: params.userId, phone, message: body },
  });
  return { sent: 1, phone, sentAt: log.sentAt.toISOString(), smsLogId: log.id };
}

export async function sendCoachReplySms(params: { memberId: string; message: string }) {
  const allWithPhones = await getUsersWithPhones();
  const user = allWithPhones.find((u) => u.id === params.memberId && u.phone);
  if (!user) return { sent: 0 };

  const first = (user.name || user.email.split("@")[0]).split(" ")[0];
  const body = coachReplySmsBody(params.message, first);
  const ok = await deliverSms(user.phone, body);
  if (!ok) return { sent: 0 };

  const logEntry = {
    userId: user.id,
    phone: user.phone,
    message: body,
    source: "coach-reply",
    direction: "outbound" as const,
  };

  if (isDemoMode()) {
    const saved = await addDemoSmsLog(logEntry);
    return { sent: 1, phone: user.phone, sentAt: saved.sentAt };
  }

  const log = await prisma.smsLog.create({
    data: { userId: user.id, phone: user.phone, message: body },
  });
  return { sent: 1, phone: user.phone, sentAt: log.sentAt.toISOString(), smsLogId: log.id };
}

export async function sendCoachChatAlert(params: {
  userIds: string[];
  sessionDate?: string;
  customBody?: string;
}) {
  const allWithPhones = await getUsersWithPhones();
  const idSet = new Set(params.userIds);
  const targets = allWithPhones.filter((u) => idSet.has(u.id) && u.phone);

  const results: any[] = [];
  for (const u of targets) {
    const first = (u.name || u.email.split("@")[0]).split(" ")[0];
    const body =
      params.customBody ||
      coachAlertMessage({ sessionDate: params.sessionDate, firstName: first });
    const personalized = personalize(body, { name: u.name, email: u.email, phone: u.phone });
    const ok = await deliverSms(u.phone, personalized);
    if (!ok) continue;

    const logEntry: any = {
      userId: u.id,
      phone: u.phone,
      message: personalized,
      source: "coach-chat-alert",
      direction: "outbound",
    };

    if (isDemoMode()) {
      const saved = await addDemoSmsLog(logEntry);
      results.push({ userId: u.id, phone: u.phone, message: personalized, sentAt: saved.sentAt });
    } else {
      const log = await prisma.smsLog.create({
        data: { userId: u.id, phone: u.phone, message: personalized },
      });
      results.push({ userId: u.id, phone: u.phone, message: personalized, sentAt: log.sentAt, smsLogId: log.id });
    }
  }

  return { sent: results.length, logs: results };
}

export async function logInboundMemberSms(params: {
  userId: string;
  phone: string;
  message: string;
}) {
  const logEntry = {
    userId: params.userId,
    phone: params.phone,
    message: params.message,
    source: "member-reply",
    direction: "inbound" as const,
  };

  if (isDemoMode()) {
    return addDemoSmsLog(logEntry);
  }

  const log = await prisma.smsLog.create({
    data: {
      userId: params.userId,
      phone: params.phone,
      message: params.message,
    },
  });
  return { ...logEntry, sentAt: log.sentAt.toISOString(), smsLogId: log.id };
}

export async function sendSmsBroadcast(params: {
  userIds?: string[];
  filter?: "all" | "members";
  message: string;
  category?: "fasted-cardio" | "sleep" | "exercise" | "general";
  taskDetails?: any;
}) {
  const { userIds, message, category = "general", taskDetails } = params;
  const allWithPhones = await getUsersWithPhones();
  let targets = allWithPhones;
  if (userIds && userIds.length > 0) {
    const idSet = new Set(userIds);
    targets = allWithPhones.filter((u) => idSet.has(u.id));
  }

  const results: any[] = [];
  for (const u of targets) {
    if (!u.phone) continue;
    const personalized = personalize(message, { name: u.name, email: u.email, phone: u.phone });
    const ok = await deliverSms(u.phone, personalized);
    if (!ok) continue;

    const logEntry: any = {
      userId: u.id,
      phone: u.phone,
      message: personalized,
      source: "broadcast",
      category,
      taskDetails: taskDetails || null,
      direction: "outbound",
    };

    if (isDemoMode()) {
      const saved = await addDemoSmsLog(logEntry);
      results.push({ user: u.email, phone: u.phone, message: personalized, sentAt: saved.sentAt, category, taskDetails });
    } else {
      const log = await prisma.smsLog.create({
        data: {
          userId: u.id,
          phone: u.phone,
          message: personalized,
        },
      });
      results.push({ user: u.email, phone: u.phone, message: personalized, sentAt: log.sentAt, category, taskDetails });
    }
  }

  return { sent: results.length, logs: results };
}

export async function createReminderLogForUser(user: any, message: string) {
  if (isDemoMode()) {
    const saved = await addDemoSmsLog({
      userId: user.id,
      phone: user.phone,
      message,
      source: "reminder",
      direction: "outbound",
    });
    return { user: user.email, phone: user.phone, message, sentAt: saved.sentAt };
  }
  const log = await prisma.smsLog.create({ data: { userId: user.id, phone: user.phone, message } });
  return { user: user.email, phone: user.phone, message, sentAt: log.sentAt };
}

export function listDemoMembersForCoach() {
  return listMembersForCoach();
}

export { resolveDemoUserByEmail };