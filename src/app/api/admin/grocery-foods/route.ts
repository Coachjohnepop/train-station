import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  createApprovedGroceryFood,
  listApprovedGroceryFoods,
  updateApprovedGroceryFood,
} from "@/lib/approved-grocery-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;
  const archive = new URL(request.url).searchParams.get("archive");
  try {
    const foods = await listApprovedGroceryFoods({
      archive: archive === "archived" || archive === "all" ? archive : "active",
    });
    return NextResponse.json({ ok: true, foods });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load grocery foods.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as {
      name?: string;
      aliases?: string;
      category?: string;
      whyGood?: string;
      whyAvoid?: string;
      sortOrder?: number;
    };
    const food = await createApprovedGroceryFood({
      name: String(body.name || ""),
      aliases: body.aliases,
      category: body.category,
      whyGood: body.whyGood,
      whyAvoid: body.whyAvoid,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ ok: true, food }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not add food.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      aliases?: string;
      category?: string;
      whyGood?: string;
      whyAvoid?: string;
      sortOrder?: number;
      action?: "archive" | "restore";
    };
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const food = await updateApprovedGroceryFood(body.id, body);
    return NextResponse.json({ ok: true, food });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not save food.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
