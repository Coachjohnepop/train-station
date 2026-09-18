/**
 * B get-started walk: real Today console, not the ticket/program caricature.
 * Voice: Jeremy's recorded intro clip (from his video). We cannot clone TTS
 * from that video in this stack — captions carry the screen-by-screen lines.
 */

export const JEREMY_WALK_INTRO_SRC = "/audio/jeremy-app-walk-intro.mp3";

export type AppWalkPhase = "ask" | "today" | "set" | "rest" | "done";

export const APP_WALK_EXERCISES = [
  { name: "Air Squats", rx: "3 × 10" },
  { name: "Romanian Dead Lift", rx: "3 × 8" },
  { name: "Cool Down & Stretch", rx: "5 min" },
] as const;

export const APP_WALK_COPY: Record<
  Exclude<AppWalkPhase, "ask">,
  { title: string; line: string }
> = {
  today: {
    title: "Today",
    line: "This is Today — the list on your phone. Same board after you join.",
  },
  set: {
    title: "Log a set",
    line: "Tap the set. Weight in, check it off. That’s the habit.",
  },
  rest: {
    title: "Rest starts",
    line: "Rest is on the phone so you’re not guessing. Then the next set.",
  },
  done: {
    title: "That’s the console",
    line: "Bring-your-own isn’t open yet. Train Station Style puts you on Jeremy’s board now.",
  },
};

export const APP_WALK_ORDER: AppWalkPhase[] = ["ask", "today", "set", "rest", "done"];
