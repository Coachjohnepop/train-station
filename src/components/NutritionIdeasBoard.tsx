"use client";

import { useState } from "react";

type Idea = { id: string; label: string; calories: number; text: string };
type Meal = { id: string; label: string; ideas: Idea[] };

export default function NutritionIdeasBoard({
  meals,
  initialMeal,
}: {
  meals: Meal[];
  initialMeal?: string;
}) {
  const first = meals.some((meal) => meal.id === initialMeal) ? initialMeal! : meals[0]?.id;
  const [tab, setTab] = useState(first);

  return (
    <div>
      <div className="mb-3 flex gap-2 md:hidden">
        {meals.map((meal) => (
          <button
            key={meal.id}
            type="button"
            onClick={() => setTab(meal.id)}
            className={`flex-1 rounded-full px-2 py-2 text-sm font-semibold ${
              tab === meal.id
                ? "bg-[var(--ramp-gold)] text-[#1a1204]"
                : "border border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {meal.label.replace(/ ideas$/i, "")}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {meals.map((meal) => (
          <section
            key={meal.id}
            id={meal.id}
            className={`scroll-mt-28 space-y-2 ${tab === meal.id ? "block" : "hidden"} md:block`}
          >
            <h2 className="text-lg font-semibold">{meal.label}</h2>
            {meal.ideas.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Coach has not filled this in yet.</p>
            ) : (
              <ul className="space-y-2">
                {meal.ideas.map((idea) => (
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
        ))}
      </div>
    </div>
  );
}
