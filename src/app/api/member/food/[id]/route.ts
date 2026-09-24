import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimateFoodParts } from "@/lib/food-estimate";
import { cleanFoodText, foodPartsFilled } from "@/lib/food-log";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.foodEntry.findFirst({
    where: { id, userId: session.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parts = {
    protein: cleanFoodText(body?.protein),
    starch: cleanFoodText(body?.starch),
    fat: cleanFoodText(body?.fat),
    extras: cleanFoodText(body?.extras),
  };
  if (!foodPartsFilled(parts)) {
    return NextResponse.json({ error: "Add at least one food." }, { status: 400 });
  }
  const estimate = await estimateFoodParts(parts);
  const saved = await prisma.foodEntry.update({
    where: { id },
    data: {
      protein: estimate.protein,
      starch: estimate.starch,
      fat: estimate.fat,
      extras: estimate.extras,
      calories: estimate.calories,
      proteinG: estimate.proteinG,
      carbG: estimate.carbG,
      fatG: estimate.fatG,
      saturatedFatG: estimate.saturatedFatG,
      fiberG: estimate.fiberG,
      sugarG: estimate.sugarG,
      addedSugarG: estimate.addedSugarG,
      sodiumMg: estimate.sodiumMg,
      cholesterolMg: estimate.cholesterolMg,
      serving: estimate.serving,
      source: estimate.source,
    },
  });
  return NextResponse.json({
    ok: true,
    entry: {
      id: saved.id,
      calories: saved.calories,
      source: saved.source,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const row = await prisma.foodEntry.findFirst({
    where: { id, userId: session.id },
    select: { id: true },
  });
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await prisma.foodEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
