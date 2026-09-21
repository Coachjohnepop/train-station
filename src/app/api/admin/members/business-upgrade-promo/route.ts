import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  countEligiblePayingRequests,
  drawMonthlyUpgradePromo,
  loadMonthlyPromo,
  monthKeyLabel,
  pacificMonthKey,
  previousPacificMonthKey,
} from "@/lib/business-upgrade-monthly-promo";

export const dynamic = "force-dynamic";

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentKey = pacificMonthKey();
  const previousKey = previousPacificMonthKey();
  const [current, previous, currentEligible, previousEligible] = await Promise.all([
    loadMonthlyPromo(currentKey),
    loadMonthlyPromo(previousKey),
    countEligiblePayingRequests(currentKey),
    countEligiblePayingRequests(previousKey),
  ]);

  return NextResponse.json({
    ok: true,
    current: {
      monthKey: currentKey,
      monthLabel: monthKeyLabel(currentKey),
      eligibleCount: current?.drawnAt ? current.eligibleCount : currentEligible,
      drawn: Boolean(current?.drawnAt),
      winnerEmail: current?.winnerEmail ?? null,
      winnerUserId: current?.winnerUserId ?? null,
      drawnAt: current?.drawnAt ?? null,
    },
    previous: previous
      ? {
          monthKey: previous.monthKey,
          monthLabel: previous.monthLabel,
          eligibleCount: previous.eligibleCount,
          drawn: Boolean(previous.drawnAt),
          winnerEmail: previous.winnerEmail,
          winnerUserId: previous.winnerUserId,
          drawnAt: previous.drawnAt,
        }
      : {
          monthKey: previousKey,
          monthLabel: monthKeyLabel(previousKey),
          eligibleCount: previousEligible,
          drawn: false,
          winnerEmail: null,
          winnerUserId: null,
          drawnAt: null,
        },
  });
}

const postSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid month." }, { status: 400 });
  }

  const monthKey = parsed.data.monthKey || pacificMonthKey();
  const result = await drawMonthlyUpgradePromo({
    monthKey,
    actor: session.email || session.id,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    alreadyDrawn: result.alreadyDrawn,
    promo: result.promo,
    winnerName: result.winnerName,
    message: result.alreadyDrawn
      ? `${result.promo.monthLabel} already has a drawing.`
      : result.promo.winnerEmail
        ? `${result.winnerName} won ${result.promo.monthLabel}'s complimentary Business Class upgrade.`
        : `${result.promo.monthLabel}: no paying Coach Class requests in the drawing.`,
  });
}
