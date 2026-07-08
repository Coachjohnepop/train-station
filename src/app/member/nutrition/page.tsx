import Link from "next/link";
import { getMemberContent } from "@/lib/member-content-store";

export const dynamic = "force-dynamic";

export default async function MemberNutritionPage() {
  const content = await getMemberContent();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/member/today" className="text-xs font-semibold text-[var(--accent)] hover:underline">
          ← Back to Today
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Nutritional guidance</h1>
        {content.nutritionIntro ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{content.nutritionIntro}</p>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Sample day templates by calorie level. Your coach can personalize these on your intro call.
          </p>
        )}
      </div>

      <div className="space-y-2">
        {content.nutritionTiers.map((tier) => (
          <details key={tier.id} className="card group p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{tier.label}</p>
                  <p className="text-xs text-[var(--muted)]">{tier.calories} calories · example day</p>
                </div>
                <span className="text-xs font-semibold text-[var(--accent)] group-open:rotate-90 transition-transform">
                  ▶
                </span>
              </div>
            </summary>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
              {tier.sampleDay || "Coach has not filled in this template yet."}
            </p>
          </details>
        ))}
      </div>

      <p className="text-xs text-[var(--muted)]">
        These are starting points — not medical advice. Talk to Coach Jeremy on your 15-minute intro if
        you want a plan tailored to you.
      </p>
    </div>
  );
}