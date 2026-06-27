import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Program catalog is coach-only; members see their enrolled rolling schedule on Today. */
export default function MemberProgramsPage() {
  redirect("/member/today");
}