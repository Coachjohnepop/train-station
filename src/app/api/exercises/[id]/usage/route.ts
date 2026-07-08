import { NextResponse } from "next/server";
import { getExerciseUsage } from "@/lib/exercise-usage";
import { requireStaff } from "@/lib/api-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const usage = await getExerciseUsage(id);
  return NextResponse.json(usage);
}
