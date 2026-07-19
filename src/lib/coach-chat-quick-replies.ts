/**
 * Static coach quick-replies for 1:1 Messages.
 * Insert into compose — coach edits blanks then sends (no new API).
 */

export type CoachQuickReply = {
  id: string;
  /** Short chip label */
  label: string;
  /** Longer title for accessibility */
  title: string;
  /** Body with {name} and optional ____ blanks */
  body: string;
};

export const COACH_QUICK_REPLIES: CoachQuickReply[] = [
  {
    id: "macros",
    label: "Macros",
    title: "Personal nutrition / macros",
    body: `Hey {name} — personal targets after our intro:

Calories: ____
Protein: ____ g
Carbs: ____ g
Fat: ____ g

Guidelines:
- Prioritize protein each meal
- Drink water throughout the day
- Adjust carbs around training days if needed

Reply here if anything feels off or you want a tweak.`,
  },
  {
    id: "welcome",
    label: "Welcome",
    title: "Welcome new member",
    body: `Welcome aboard, {name}!

You're set for Coach Class access. Next steps:
1) Finish onboarding if you haven't
2) Check Member → Today for your workout
3) Message me here anytime with questions

Looking forward to training with you.`,
  },
  {
    id: "checkin",
    label: "Check-in",
    title: "How are you feeling?",
    body: `Quick check-in, {name} —

How are energy, sleep, and soreness this week (1–10)?
Anything we should adjust on Gym or Home days?

Reply when you can — even one line helps.`,
  },
  {
    id: "rest",
    label: "Rest day",
    title: "Rest / recovery day",
    body: `{name} — take today as recovery.

Light walk, mobility, sleep priority. No need to force a hard session.

If something is nagging (pain vs normal soreness), tell me here.`,
  },
  {
    id: "great-job",
    label: "Great job",
    title: "Positive feedback",
    body: `Great work today, {name} — consistency is the win.

Keep logging sets so I can see progress. See you next session.`,
  },
];

export function fillCoachQuickReply(
  template: string,
  vars: { name?: string | null },
): string {
  const first =
    (vars.name || "there").trim().split(/\s+/)[0] || "there";
  return template.replace(/\{name\}/gi, first);
}
