import Link from "next/link";
import BookNutritionButton from "@/components/BookNutritionButton";
import { getMemberContent } from "@/lib/member-content-store";
import { nutritionIdeasForMeal, nutritionMealNav } from "@/lib/nutrition-meals";

export const dynamic = "force-dynamic";

export default async function MemberNutritionPage() {
  const content = await getMemberContent();
  const desk = content.nutritionDesk;
  const meals = nutritionMealNav(desk);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/member/today" className="text-xs font-semibold text-[var(--accent)] hover:underline">
          ← Back to Today
        </Link>
        <h1 className="mt-3 text-2xl font-bold">{desk.pageTitle}</h1>
        {content.nutritionIntro ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{content.nutritionIntro}</p>
        ) : null}
      </div>

      {meals.map((meal) => {
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
        <p className="text-sm font-semibold">{desk.advisoryTitle}</p>
        <p className="text-sm text-[var(--muted)]">{desk.advisoryBody}</p>
        <BookNutritionButton calendlyUrl={desk.calendlyUrl} cta={desk.advisoryCta} />
      </div>

      {desk.disclaimer ? (
        <p className="text-xs text-[var(--muted)]">{desk.disclaimer}</p>
      ) : null}
    </div>
  );
}
