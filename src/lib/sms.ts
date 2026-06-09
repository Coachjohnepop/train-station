import { prisma } from "@/lib/prisma";
import { isDemoMode } from "./demo-enrollments";

let demoSmsLogs: any[] = [];

// In-memory demo users with phones (kept in sync with the demo data in /api/users for broadcast targeting)
let demoPhoneUsers = [
  { id: "demo-user", email: "demo@thetrainstation.co", name: "Demo Member (Alex)", phone: "(555) 987-6543", dailyReminderTime: "07:30" },
  { id: "demo-user-2", email: "jordan.member@example.com", name: "Jordan Lee", phone: "(555) 222-3344", dailyReminderTime: "08:00" },
  { id: "demo-instr", email: "coach.sam@example.com", name: "Sam Coach", phone: "(555) 123-0001", dailyReminderTime: null },
];

export function getDemoSmsLogs() {
  return [...demoSmsLogs];
}

export function addDemoSmsLog(entry: any) {
  demoSmsLogs.unshift({ ...entry, sentAt: new Date().toISOString() });
  if (demoSmsLogs.length > 50) demoSmsLogs.pop();
  return entry;
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

function personalize(message: string, user: { name?: string | null; email: string; phone: string }) {
  const first = (user.name || user.email.split("@")[0]).split(" ")[0];
  return message
    .replace(/\{name\}/gi, user.name || first)
    .replace(/\{first\}/gi, first)
    .replace(/\{email\}/gi, user.email)
    .replace(/\{phone\}/gi, user.phone);
}

async function deliverSms(phone: string, message: string): Promise<boolean> {
  // Placeholder for real provider (Twilio, etc.). Add envs + npm i twilio when going live.
  // For now we always "succeed" and just log to console so admin sees what would be sent.
  const from = process.env.SMS_FROM_PHONE || "TrainStation";
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    try {
      // const twilioClient = (await import("twilio")).default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // await twilioClient.messages.create({ from: process.env.TWILIO_FROM, to: phone, body: message });
      console.log(`[SMS via Twilio] ${from} -> ${phone}: ${message}`);
    } catch (e) {
      console.error("Twilio send failed (placeholder)", e);
      return false;
    }
  } else {
    console.log(`[SMS SIMULATED] ${from} -> ${phone}: ${message}`);
  }
  return true;
}

export async function sendSmsBroadcast(params: {
  userIds?: string[]; // specific ids, or omit + use all with phones
  filter?: "all" | "members"; // future use
  message: string;
  category?: "fasted-cardio" | "sleep" | "exercise" | "general"; // eating coming soon
  taskDetails?: any; // e.g. { target: "80g protein", task: "20 pushups" }
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
    };

    if (isDemoMode()) {
      const saved = addDemoSmsLog(logEntry);
      results.push({ user: u.email, phone: u.phone, message: personalized, sentAt: saved.sentAt, category, taskDetails });
    } else {
      const log = await prisma.smsLog.create({
        data: {
          userId: u.id,
          phone: u.phone,
          message: personalized,
          // if schema supports extra fields, add category etc.
        },
      });
      results.push({ user: u.email, phone: u.phone, message: personalized, sentAt: log.sentAt, category, taskDetails });
    }
  }

  return { sent: results.length, logs: results };
}

// Also expose a helper if we want to unify daily reminders later
export async function createReminderLogForUser(user: any, message: string) {
  if (isDemoMode()) {
    const saved = addDemoSmsLog({ userId: user.id, phone: user.phone, message, source: "reminder" });
    return { user: user.email, phone: user.phone, message, sentAt: saved.sentAt };
  }
  const log = await prisma.smsLog.create({ data: { userId: user.id, phone: user.phone, message } });
  return { user: user.email, phone: user.phone, message, sentAt: log.sentAt };
}
