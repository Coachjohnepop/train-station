import { NextResponse } from "next/server";
import { addDemoSmsLog } from "@/lib/sms";
import { appendMemberSmsToChat } from "@/lib/coach-chat";
import { isDemoMode } from "@/lib/demo-enrollments";
import { getDemoUserSettings } from "@/lib/demo-reminders";
import fs from "fs";
import path from "path";

function processTaskReply(message: string) {
  const lower = message.toLowerCase().trim();
  const updates: any = { processed: true };

  // Eating / protein
  if (lower.includes("protein") || lower.includes("ate") || lower.includes("logged") || lower.includes("g ")) {
    updates.type = "eating";
    // Try to extract number for protein
    const proteinMatch = lower.match(/(\d+)\s*g/);
    if (proteinMatch) updates.protein = parseInt(proteinMatch[1]);
    updates.mealsNote = message.trim();
  }

  // Fasted cardio
  if (lower.includes("cardio") || lower.includes("fasted")) {
    updates.type = "fasted-cardio";
    const minMatch = lower.match(/(\d+)\s*min/);
    updates.durationMin = minMatch ? parseInt(minMatch[1]) : 20;
  }

  // Sleep
  if (lower.includes("sleep") || lower.includes("hour") || /\d+\.?\d*\s*h/.test(lower)) {
    updates.type = "sleep";
    const hourMatch = lower.match(/(\d+\.?\d*)\s*(hour|h)/);
    updates.hours = hourMatch ? parseFloat(hourMatch[1]) : 7;
  }

  // Quick exercise / "done"
  if (lower.includes("done") || lower.includes("pushup") || lower.includes("exercise") || lower.includes("finished")) {
    updates.type = "exercise";
    updates.taskCompleted = "pushups or quick finisher";
    updates.reported = "done via SMS";
  }

  return updates;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== "string" || message.trim().length < 3) {
    return NextResponse.json({ error: "Message is required (min 3 chars)" }, { status: 400 });
  }

  const trimmed = message.trim();

  if (isDemoMode()) {
    const userSettings = getDemoUserSettings("demo-user");
    const logEntry = {
      userId: "demo-user",
      phone: userSettings.phone || "(555) 987-6543",
      message: `[Member reply] ${trimmed}`,
      source: "member-reply",
      direction: "inbound",
    };

    const saved = addDemoSmsLog(logEntry);
    appendMemberSmsToChat({
      memberId: "demo-user",
      body: trimmed,
      phone: logEntry.phone,
    });

    // Process reply for structured categories (eating, cardio, sleep, exercise)
    const processed = processTaskReply(trimmed);

    if (processed.type === "eating" && processed.protein) {
      // Append/update to eating-logs.dev.json (simple demo append to latest or day 5)
      try {
        const p = path.join(process.cwd(), "prisma/eating-logs.dev.json");
        let data: any = {};
        if (fs.existsSync(p)) data = JSON.parse(fs.readFileSync(p, "utf8"));
        if (!data["demo-user"]) data["demo-user"] = {};
        if (!data["demo-user"]["muscle-max"]) data["demo-user"]["muscle-max"] = {};
        const day = "5"; // extend previous data
        data["demo-user"]["muscle-max"][day] = {
          ...(data["demo-user"]["muscle-max"][day] || {}),
          proteinTarget: processed.protein,
          meals: processed.mealsNote ? [processed.mealsNote] : ["SMS reported meal"],
          notes: "Reported via SMS reply",
          loggedAt: new Date().toISOString(),
        };
        fs.writeFileSync(p, JSON.stringify(data, null, 2));
      } catch (e) { console.error("Failed to update eating logs from SMS reply", e); }
    }

    if (processed.type === "fasted-cardio") {
      try {
        const p = path.join(process.cwd(), "prisma/fasted-cardio.dev.json");
        let data: any = { "demo-user": [] };
        if (fs.existsSync(p)) data = JSON.parse(fs.readFileSync(p, "utf8"));
        data["demo-user"].push({
          date: new Date().toISOString().slice(0,10),
          durationMin: processed.durationMin,
          completed: true,
          source: "sms",
        });
        fs.writeFileSync(p, JSON.stringify(data, null, 2));
      } catch {}
    }

    if (processed.type === "sleep") {
      try {
        const p = path.join(process.cwd(), "prisma/sleep-logs.dev.json");
        let data: any = { "demo-user": [] };
        if (fs.existsSync(p)) data = JSON.parse(fs.readFileSync(p, "utf8"));
        data["demo-user"].push({
          date: new Date().toISOString().slice(0,10),
          hours: processed.hours,
          source: "sms",
        });
        fs.writeFileSync(p, JSON.stringify(data, null, 2));
      } catch {}
    }

    if (processed.type === "exercise") {
      // Log quick exercise completion (can be shown in coach views)
      try {
        const p = path.join(process.cwd(), "prisma/sms-tasks.dev.json");
        let data: any = { "demo-user": [] };
        if (fs.existsSync(p)) data = JSON.parse(fs.readFileSync(p, "utf8"));
        data["demo-user"].push({
          task: processed.taskCompleted || "quick exercise",
          completed: true,
          reportedVia: "sms",
          at: new Date().toISOString(),
        });
        fs.writeFileSync(p, JSON.stringify(data, null, 2));
      } catch {}
    }

    return NextResponse.json({ success: true, sentAt: saved.sentAt, processed });
  }

  // TODO: real inbound webhook simulation or actual provider inbound
  return NextResponse.json({ success: false, error: "Real inbound SMS not wired yet" }, { status: 501 });
}
