import { redirect } from "next/navigation";
import CoachHelpSuggestionsInbox from "@/components/CoachHelpSuggestionsInbox";
import { getSessionUser } from "@/lib/auth";
import { canViewCoachHelpSuggestions } from "@/lib/coach-help-access";

export const dynamic = "force-dynamic";

export default async function CoachSuggestionsPage() {
  const session = await getSessionUser();
  if (!session || !canViewCoachHelpSuggestions(session)) {
    redirect("/admin/day");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Coach suggestions</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          From Jeremy&apos;s Ask Grok help panel — review and prioritize for the next build.
        </p>
      </div>
      <CoachHelpSuggestionsInbox />
    </div>
  );
}