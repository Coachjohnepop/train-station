import Link from "next/link";
import { getMemberContent } from "@/lib/member-content-store";
import { NUTRITION_MEALS, nutritionIdeasForMeal } from "@/lib/nutrition-meals";

export const dynamic = "force-dynamic";

export default async function MemberNutritionPage() {
  const content = await getMemberContent();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/member/today" className="text-xs font-semibold text-[var(--accent)] hover:underline">
          ← Back to Today
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Nutrition</h1>
        {content.nutritionIntro ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{content.nutritionIntro}</p>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Meal ideas from your coach&apos;s sample days. Swap foods you like — this is a starting
            point, not a prescription.
          </p>
        )}
      </div>

      {NUTRITION_MEALS.map((meal) => {
        const ideas = nutritionIdeasForMeal(content.nutritionTiers, meal.id);
        return (
          <section key={meal.id} id={meal.id} className="scroll-mt-28 space-y-2">
            <h2 className="text-lg font-semibold">{meal.label}</h2>
            {ideas.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Coach has not filled in {meal.label.toLowerCase()} yet.</p>
            ) : (
              <ul className="space-y-2">
                {ideas.map((idea) => (
                  <li key={`${meal.id}-${idea.id}`} className="card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {idea.label}
                      <span className="font-medium normal-case tracking-normal">
                        {" "}
                        · {idea.calories.toLocaleString()} cal
                      </span>
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed">{idea.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <div id="advisory" className="card space-y-3 p-4">
        <p className="text-sm font-semibold">Menu advisory</p>
        <p className="text-sm text-[var(--muted)]">
          Want Jeremy to build a personal menu around your goals and schedule? Join the advisory
          list — it is not medical advice, and it is not a meal-delivery plan.
        </p>
        <Link href="/signup?interest=nutrition" className="btn-primary inline-flex min-h-11 items-center px-4 text-sm">
          Sign up for menu advisory
        </Link>
      </div>

      <p className="text-xs text-[var(--muted)]">
        These are starting points — not medical advice. Talk to Coach Jeremy on your 15-minute intro if
        you want a plan tailored to you.
      </p>
    </div>
  );
}
