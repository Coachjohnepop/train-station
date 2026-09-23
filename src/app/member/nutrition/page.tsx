import Link from "next/link";
import BookNutritionButton from "@/components/BookNutritionButton";
import NutritionIdeasBoard from "@/components/NutritionIdeasBoard";
import { getMemberContent } from "@/lib/member-content-store";
import { nutritionIdeasForMeal, nutritionMealNav } from "@/lib/nutrition-meals";

export const dynamic = "force-dynamic";

export default async function MemberNutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ meal?: string }>;
}) {
  const content = await getMemberContent();
  const desk = content.nutritionDesk;
  const meals = nutritionMealNav(desk).map((meal) => ({
    ...meal,
    ideas: nutritionIdeasForMeal(content.nutritionTiers, meal.id),
  }));
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/member/today" className="text-xs font-semibold text-[var(--accent)] hover:underline">
          ← Back to Today
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Meal Ideas</h1>
        {content.nutritionIntro ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{content.nutritionIntro}</p>
        ) : null}
      </div>

      <NutritionIdeasBoard meals={meals} initialMeal={sp.meal} />

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
