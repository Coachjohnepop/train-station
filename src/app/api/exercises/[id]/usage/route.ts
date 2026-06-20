import { NextResponse } from "next/server";
import { getExerciseUsage } from "@/lib/exercise-usage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usage = await getExerciseUsage(id);
  return NextResponse.json(usage);
}
