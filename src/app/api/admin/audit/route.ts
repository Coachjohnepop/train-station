import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Platform audit log for M&A diligence.
 * GET /api/admin/audit?action=&actor=&entityType=&limit=50&before=
 */
export async function GET(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Audit log requires Postgres.", events: [], total: 0 },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action")?.trim() || "";
  const actor = url.searchParams.get("actor")?.trim() || "";
  const entityType = url.searchParams.get("entityType")?.trim() || "";
  const entityId = url.searchParams.get("entityId")?.trim() || "";
  const outcome = url.searchParams.get("outcome")?.trim() || "";
  const before = url.searchParams.get("before")?.trim() || "";
  const limitRaw = Number(url.searchParams.get("limit") || "50");
  const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));

  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (outcome) where.outcome = outcome;
  if (actor) {
    where.OR = [
      { actorEmail: { contains: actor, mode: "insensitive" } },
      { actorUserId: { contains: actor, mode: "insensitive" } },
      { actorRole: { contains: actor, mode: "insensitive" } },
    ];
  }
  if (before) {
    const d = new Date(before);
    if (!Number.isNaN(d.getTime())) where.occurredAt = { lt: d };
  }

  try {
    const events = await prisma.auditEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: limit,
      select: {
        id: true,
        occurredAt: true,
        action: true,
        outcome: true,
        actorUserId: true,
        actorEmail: true,
        actorRole: true,
        entityType: true,
        entityId: true,
        ip: true,
        metadata: true,
      },
    });

    return NextResponse.json(
      {
        events: events.map((e) => ({
          ...e,
          occurredAt: e.occurredAt.toISOString(),
        })),
        total: events.length,
        limit,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load audit log.";
    console.error("[admin/audit GET]", message);
    return NextResponse.json({ error: message, events: [], total: 0 }, { status: 500 });
  }
}
