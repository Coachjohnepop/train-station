import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { getWorkoutCycleById } from "@/lib/workout-cycle-db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const cycle = await getWorkoutCycleById(id);
  if (!cycle) {
    return NextResponse.json({ detail: "Cycle not found" }, { status: 404 });
  }
  return NextResponse.json(cycle);
}