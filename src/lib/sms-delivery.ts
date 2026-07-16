import "server-only";

import twilio from "twilio";
import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit-event";
import { isOutboundMessagingEnabled } from "@/lib/messaging-gate";
import { normalizePhoneDigits, toE164, twilioConfigured } from "@/lib/sms-phone";

export type SmsDirection = "outbound" | "inbound";

export type DeliverSmsParams = {
  phone: string;
  message: string;
  userId?: string | null;
  source: string;
  direction?: SmsDirection;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
  /** When true, skip Twilio and only record (inbound already received). */
  recordOnly?: boolean;
  /**
   * When true, do not call Twilio (hub email already sent, or external delivery).
   * Still writes durable ledger + audit.
   */
  skipProvider?: boolean;
  /** Force channel label (e.g. email_hub). */
  channel?: "sms" | "email_hub" | "simulated";
  actorUserId?: string | null;
  actorEmail?: string | null;
  /** Mark ledger status when skipProvider (default sent). */
  externalStatus?: string;
};

export type DeliverSmsResult = {
  ok: boolean;
  smsLogId?: string;
  simulated: boolean;
  status: string;
  channel: string;
  phoneE164?: string;
  providerSid?: string;
  reason?:
    | "paused"
    | "opt_out"
    | "no_phone"
    | "invalid_phone"
    | "delivery_failed"
    | "recorded";
  errorCode?: string;
  errorMessage?: string;
  sentAt: string;
};

function digitsOk(phone: string): boolean {
  const d = normalizePhoneDigits(phone);
  return d.length >= 10 && d.length <= 15;
}

/** Effective SMS opt-out: opted out more recently than opted in. */
export async function userSmsOptedOut(userId: string | null | undefined): Promise<boolean> {
  if (!userId || !isDatabaseConfigured()) return false;
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { smsOptOutAt: true, smsOptInAt: true },
    });
    if (!u?.smsOptOutAt) return false;
    if (!u.smsOptInAt) return true;
    return u.smsOptOutAt.getTime() >= u.smsOptInAt.getTime();
  } catch {
    return false;
  }
}

export async function setUserSmsOptOut(params: {
  userId: string;
  phone?: string;
  source?: string;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await prisma.user.update({
    where: { id: params.userId },
    data: {
      smsOptOutAt: new Date(),
      ...(params.phone ? { phoneE164: toE164(params.phone) } : {}),
    },
  });
  await recordAuditEvent({
    action: "sms.opt_out",
    outcome: "success",
    actorUserId: params.userId,
    entityType: "User",
    entityId: params.userId,
    metadata: { source: params.source || "keyword", phone: params.phone },
  });
}

export async function setUserSmsOptIn(params: {
  userId: string;
  phone?: string;
  source?: string;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await prisma.user.update({
    where: { id: params.userId },
    data: {
      smsOptInAt: new Date(),
      smsConsentAt: new Date(),
      ...(params.phone ? { phoneE164: toE164(params.phone) } : {}),
    },
  });
  await recordAuditEvent({
    action: "sms.opt_in",
    outcome: "success",
    actorUserId: params.userId,
    entityType: "User",
    entityId: params.userId,
    metadata: { source: params.source || "keyword", phone: params.phone },
  });
}

async function appendDeliveryEvent(params: {
  smsLogId: string;
  eventType: string;
  status?: string | null;
  detail?: string | null;
  rawPayload?: Record<string, unknown> | null;
}) {
  if (!isDatabaseConfigured()) return;
  try {
    await prisma.smsDeliveryEvent.create({
      data: {
        smsLogId: params.smsLogId,
        eventType: params.eventType,
        status: params.status ?? null,
        detail: params.detail ?? null,
        rawPayload: (params.rawPayload ?? undefined) as object | undefined,
      },
    });
  } catch (e) {
    console.error("[sms] delivery event write failed", e);
  }
}

async function createDbSmsLog(data: {
  userId?: string | null;
  phone: string;
  message: string;
  direction: SmsDirection;
  source: string;
  channel: string;
  status: string;
  provider?: string | null;
  providerSid?: string | null;
  providerStatus?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  category?: string | null;
  simulated: boolean;
  metadata?: Record<string, unknown> | null;
  deliveredAt?: Date | null;
}): Promise<{ id: string; sentAt: Date }> {
  const row = await prisma.smsLog.create({
    data: {
      userId: data.userId ?? null,
      phone: data.phone,
      message: data.message,
      direction: data.direction,
      source: data.source,
      channel: data.channel,
      status: data.status,
      provider: data.provider ?? null,
      providerSid: data.providerSid ?? null,
      providerStatus: data.providerStatus ?? null,
      errorCode: data.errorCode ?? null,
      errorMessage: data.errorMessage ?? null,
      category: data.category ?? null,
      simulated: data.simulated,
      metadata: (data.metadata ?? undefined) as object | undefined,
      deliveredAt: data.deliveredAt ?? null,
    },
  });
  return { id: row.id, sentAt: row.sentAt };
}

/**
 * Single outbound/inbound path: gate → opt-out → provider → durable SmsLog + audit.
 * When Postgres is configured, always writes DB (never demo JSON).
 */
export async function deliverSmsAudited(params: DeliverSmsParams): Promise<DeliverSmsResult> {
  const direction = params.direction ?? "outbound";
  const nowIso = new Date().toISOString();
  const rawPhone = (params.phone || "").trim();

  if (!rawPhone) {
    return {
      ok: false,
      simulated: !twilioConfigured(),
      status: "skipped_no_phone",
      channel: params.channel || "sms",
      reason: "no_phone",
      sentAt: nowIso,
    };
  }

  // External channel (hub email) may use email as address — skip E.164 validation
  if (params.skipProvider && direction === "outbound") {
    const address = digitsOk(rawPhone) ? toE164(rawPhone) : rawPhone;
    return recordExternalOutbound({
      ...params,
      phone: address,
    });
  }

  if (!digitsOk(rawPhone)) {
    const result: DeliverSmsResult = {
      ok: false,
      simulated: !twilioConfigured(),
      status: "skipped_invalid_phone",
      channel: params.channel || "sms",
      reason: "invalid_phone",
      phoneE164: toE164(rawPhone),
      sentAt: nowIso,
    };
    if (isDatabaseConfigured()) {
      const log = await createDbSmsLog({
        userId: params.userId,
        phone: rawPhone,
        message: params.message,
        direction,
        source: params.source,
        channel: result.channel,
        status: result.status,
        simulated: result.simulated,
        category: params.category,
        metadata: params.metadata,
      });
      result.smsLogId = log.id;
      result.sentAt = log.sentAt.toISOString();
      await appendDeliveryEvent({
        smsLogId: log.id,
        eventType: "blocked",
        status: result.status,
        detail: "invalid phone",
      });
      await recordAuditEvent({
        action: direction === "inbound" ? "sms.inbound" : "sms.send",
        outcome: "denied",
        actorUserId: params.actorUserId ?? params.userId,
        actorEmail: params.actorEmail,
        entityType: "SmsLog",
        entityId: log.id,
        metadata: { reason: "invalid_phone", source: params.source },
      });
    }
    return result;
  }

  const phoneE164 = toE164(rawPhone);

  // Inbound record-only (already received from carrier)
  if (params.recordOnly || direction === "inbound") {
    return recordInboundOrNote({
      ...params,
      phone: phoneE164,
      direction: "inbound",
    });
  }

  // Kill switch
  if (!(await isOutboundMessagingEnabled())) {
    return finalizeBlocked({
      params,
      phoneE164,
      status: "skipped_paused",
      reason: "paused",
      detail: "outbound messaging paused",
    });
  }

  // Opt-out
  if (await userSmsOptedOut(params.userId)) {
    return finalizeBlocked({
      params,
      phoneE164,
      status: "blocked_opt_out",
      reason: "opt_out",
      detail: "user opted out of SMS",
    });
  }

  const live = twilioConfigured();
  const simulated = !live;
  const channel = params.channel || (simulated ? "simulated" : "sms");

  let providerSid: string | undefined;
  let providerStatus: string | undefined;
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  let ok = false;
  let status = "failed";

  if (live) {
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const statusCallback =
        process.env.TWILIO_STATUS_CALLBACK_URL?.trim() ||
        (process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/sms/status`
          : undefined);
      const msg = await client.messages.create({
        from: process.env.TWILIO_FROM!,
        to: phoneE164,
        body: params.message,
        ...(statusCallback ? { statusCallback } : {}),
      });
      providerSid = msg.sid;
      providerStatus = msg.status;
      ok = true;
      status = msg.status === "failed" || msg.status === "undelivered" ? msg.status : "sent";
    } catch (e: unknown) {
      const err = e as { code?: string | number; message?: string; status?: number };
      errorCode = err.code != null ? String(err.code) : undefined;
      errorMessage = err.message || String(e);
      console.error("Twilio send failed", e);
      ok = false;
      status = "failed";
    }
  } else {
    console.log(`[SMS SIMULATED — set TWILIO_* envs] -> ${phoneE164}: ${params.message}`);
    ok = true;
    status = "sent";
    providerStatus = "simulated";
  }

  const sentAt = nowIso;

  if (!isDatabaseConfigured()) {
    const { addDemoSmsLog } = await import("@/lib/sms");
    const saved = await addDemoSmsLog({
      userId: params.userId || undefined,
      phone: phoneE164,
      message: params.message,
      source: params.source,
      direction: "outbound",
      category: params.category || undefined,
      taskDetails: params.metadata || undefined,
    });
    return {
      ok,
      smsLogId: saved.smsLogId,
      simulated: true,
      status: ok ? "sent" : "failed",
      channel: "simulated",
      phoneE164,
      reason: ok ? undefined : "delivery_failed",
      errorCode,
      errorMessage,
      sentAt: saved.sentAt,
    };
  }

  const log = await createDbSmsLog({
    userId: params.userId,
    phone: phoneE164,
    message: params.message,
    direction: "outbound",
    source: params.source,
    channel,
    status,
    provider: live ? "twilio" : "none",
    providerSid,
    providerStatus,
    errorCode,
    errorMessage,
    category: params.category,
    simulated,
    metadata: params.metadata,
  });

  await appendDeliveryEvent({
    smsLogId: log.id,
    eventType: ok ? "provider_accepted" : "failed",
    status,
    detail: errorMessage || providerStatus || undefined,
    rawPayload: providerSid ? { sid: providerSid, providerStatus } : errorCode ? { errorCode, errorMessage } : null,
  });

  await recordAuditEvent({
    action: "sms.send",
    outcome: ok ? "success" : "failure",
    actorUserId: params.actorUserId ?? null,
    actorEmail: params.actorEmail ?? null,
    entityType: "SmsLog",
    entityId: log.id,
    metadata: {
      source: params.source,
      userId: params.userId,
      phone: phoneE164,
      simulated,
      providerSid,
      status,
      errorCode,
    },
  });

  // Best-effort: keep phoneE164 in sync on user
  if (params.userId && phoneE164) {
    try {
      await prisma.user.update({
        where: { id: params.userId },
        data: { phoneE164 },
      });
    } catch {
      /* user may not exist in edge cases */
    }
  }

  return {
    ok,
    smsLogId: log.id,
    simulated,
    status,
    channel,
    phoneE164,
    providerSid,
    reason: ok ? undefined : "delivery_failed",
    errorCode,
    errorMessage,
    sentAt: log.sentAt.toISOString() || sentAt,
  };
}

async function finalizeBlocked(args: {
  params: DeliverSmsParams;
  phoneE164: string;
  status: string;
  reason: DeliverSmsResult["reason"];
  detail: string;
}): Promise<DeliverSmsResult> {
  const { params, phoneE164, status, reason, detail } = args;
  const simulated = !twilioConfigured();
  const channel = params.channel || (simulated ? "simulated" : "sms");
  const nowIso = new Date().toISOString();

  if (!isDatabaseConfigured()) {
    console.log(`[SMS — ${reason}] -> ${phoneE164}: ${params.message.slice(0, 80)}…`);
    return {
      ok: false,
      simulated,
      status,
      channel,
      phoneE164,
      reason,
      sentAt: nowIso,
    };
  }

  const log = await createDbSmsLog({
    userId: params.userId,
    phone: phoneE164,
    message: params.message,
    direction: "outbound",
    source: params.source,
    channel,
    status,
    provider: "none",
    simulated,
    category: params.category,
    metadata: { ...(params.metadata || {}), blockReason: reason },
  });

  await appendDeliveryEvent({
    smsLogId: log.id,
    eventType: "blocked",
    status,
    detail,
  });

  await recordAuditEvent({
    action: "sms.send",
    outcome: "denied",
    actorUserId: params.actorUserId ?? null,
    actorEmail: params.actorEmail ?? null,
    entityType: "SmsLog",
    entityId: log.id,
    metadata: { reason, source: params.source, userId: params.userId, phone: phoneE164 },
  });

  console.log(`[SMS — ${reason}] -> ${phoneE164}: ${params.message.slice(0, 80)}…`);

  return {
    ok: false,
    smsLogId: log.id,
    simulated,
    status,
    channel,
    phoneE164,
    reason,
    sentAt: log.sentAt.toISOString(),
  };
}

async function recordExternalOutbound(params: DeliverSmsParams & { phone: string }): Promise<DeliverSmsResult> {
  const channel = params.channel || "email_hub";
  const status = params.externalStatus || "sent";
  const provider = channel === "email_hub" ? "resend" : "none";

  if (!isDatabaseConfigured()) {
    const { addDemoSmsLog } = await import("@/lib/sms");
    const saved = await addDemoSmsLog({
      userId: params.userId || undefined,
      phone: params.phone,
      message: params.message,
      source: params.source,
      direction: "outbound",
      category: params.category || undefined,
      taskDetails: params.metadata || undefined,
    });
    return {
      ok: true,
      smsLogId: saved.smsLogId,
      simulated: true,
      status,
      channel,
      phoneE164: params.phone,
      reason: "recorded",
      sentAt: saved.sentAt,
    };
  }

  const log = await createDbSmsLog({
    userId: params.userId,
    phone: params.phone,
    message: params.message,
    direction: "outbound",
    source: params.source,
    channel,
    status,
    provider,
    simulated: channel === "simulated",
    category: params.category,
    metadata: params.metadata,
  });

  await appendDeliveryEvent({
    smsLogId: log.id,
    eventType: "created",
    status,
    detail: `external channel ${channel}`,
  });

  await recordAuditEvent({
    action: "sms.send",
    outcome: "success",
    actorUserId: params.actorUserId ?? null,
    actorEmail: params.actorEmail ?? null,
    entityType: "SmsLog",
    entityId: log.id,
    metadata: {
      source: params.source,
      channel,
      skipProvider: true,
      userId: params.userId,
      phone: params.phone,
    },
  });

  return {
    ok: true,
    smsLogId: log.id,
    simulated: channel === "simulated",
    status,
    channel,
    phoneE164: params.phone,
    reason: "recorded",
    sentAt: log.sentAt.toISOString(),
  };
}

async function recordInboundOrNote(params: DeliverSmsParams & { phone: string }): Promise<DeliverSmsResult> {
  const nowIso = new Date().toISOString();
  const channel = params.channel || "sms";

  if (!isDatabaseConfigured()) {
    const { addDemoSmsLog } = await import("@/lib/sms");
    const saved = await addDemoSmsLog({
      userId: params.userId || undefined,
      phone: params.phone,
      message: params.message,
      source: params.source,
      direction: "inbound",
      category: params.category || undefined,
    });
    return {
      ok: true,
      smsLogId: saved.smsLogId,
      simulated: true,
      status: "received",
      channel,
      phoneE164: params.phone,
      reason: "recorded",
      sentAt: saved.sentAt,
    };
  }

  const log = await createDbSmsLog({
    userId: params.userId,
    phone: params.phone,
    message: params.message,
    direction: "inbound",
    source: params.source,
    channel,
    status: "received",
    provider: twilioConfigured() ? "twilio" : "none",
    simulated: !twilioConfigured(),
    category: params.category,
    metadata: params.metadata,
  });

  await appendDeliveryEvent({
    smsLogId: log.id,
    eventType: "created",
    status: "received",
    detail: "inbound received",
    rawPayload: params.metadata || null,
  });

  await recordAuditEvent({
    action: "sms.inbound",
    outcome: "success",
    actorUserId: params.userId ?? null,
    entityType: "SmsLog",
    entityId: log.id,
    metadata: { source: params.source, phone: params.phone },
  });

  return {
    ok: true,
    smsLogId: log.id,
    simulated: !twilioConfigured(),
    status: "received",
    channel,
    phoneE164: params.phone,
    reason: "recorded",
    sentAt: log.sentAt.toISOString() || nowIso,
  };
}

/** Apply Twilio status callback to an existing SmsLog by provider SID. */
export async function applyTwilioStatusCallback(params: {
  messageSid: string;
  messageStatus: string;
  errorCode?: string | null;
  rawPayload?: Record<string, unknown>;
}): Promise<{ updated: boolean; smsLogId?: string }> {
  if (!isDatabaseConfigured() || !params.messageSid) {
    return { updated: false };
  }

  const existing = await prisma.smsLog.findFirst({
    where: { providerSid: params.messageSid },
    orderBy: { sentAt: "desc" },
  });
  if (!existing) {
    await recordAuditEvent({
      action: "sms.status_callback",
      outcome: "info",
      entityType: "TwilioMessage",
      entityId: params.messageSid,
      metadata: { messageStatus: params.messageStatus, unmatched: true },
    });
    return { updated: false };
  }

  const delivered =
    params.messageStatus === "delivered"
      ? new Date()
      : existing.deliveredAt;

  await prisma.smsLog.update({
    where: { id: existing.id },
    data: {
      status: params.messageStatus,
      providerStatus: params.messageStatus,
      errorCode: params.errorCode ?? existing.errorCode,
      deliveredAt: delivered,
    },
  });

  await appendDeliveryEvent({
    smsLogId: existing.id,
    eventType: "status_callback",
    status: params.messageStatus,
    detail: params.errorCode ? `errorCode=${params.errorCode}` : null,
    rawPayload: params.rawPayload || null,
  });

  await recordAuditEvent({
    action: "sms.status_callback",
    outcome:
      params.messageStatus === "failed" || params.messageStatus === "undelivered"
        ? "failure"
        : "success",
    entityType: "SmsLog",
    entityId: existing.id,
    metadata: {
      messageSid: params.messageSid,
      messageStatus: params.messageStatus,
      errorCode: params.errorCode,
    },
  });

  return { updated: true, smsLogId: existing.id };
}

/** List recent ledger rows for coach hub (DB when available). */
export async function listSmsLedger(limit = 50) {
  if (!isDatabaseConfigured()) {
    const { getDemoSmsLogs } = await import("@/lib/sms");
    const logs = await getDemoSmsLogs();
    return logs.slice(0, limit).map((l) => ({
      id: l.smsLogId,
      userId: l.userId,
      phone: l.phone,
      message: l.message,
      direction: l.direction || "outbound",
      source: l.source,
      channel: "simulated",
      status: "sent",
      category: l.category,
      simulated: true,
      sentAt: l.sentAt,
      user: null as { email: string; name: string | null } | null,
    }));
  }

  const rows = await prisma.smsLog.findMany({
    orderBy: { sentAt: "desc" },
    take: limit,
    include: { user: { select: { email: true, name: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    phone: r.phone,
    message: r.message,
    direction: r.direction,
    source: r.source,
    channel: r.channel,
    status: r.status,
    providerSid: r.providerSid,
    providerStatus: r.providerStatus,
    errorCode: r.errorCode,
    category: r.category,
    simulated: r.simulated,
    sentAt: r.sentAt.toISOString(),
    deliveredAt: r.deliveredAt?.toISOString() ?? null,
    user: r.user,
  }));
}
