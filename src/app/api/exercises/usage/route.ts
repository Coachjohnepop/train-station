import { NextResponse } from "next/server";
import { getAllExerciseUsages } from "@/lib/exercise-usage";

export async function GET() {
  // Returns lightweight usage summaries for the entire library.
  // Used by the Exercise Library table to show "Used in X programs" without N+1.
  const usages = await getAllExerciseUsages();
  return NextResponse.json(usages);
}
