/**
 * B get-started walk: real Today console, not the ticket/program caricature.
 * Voice: free macOS Eddy (US) TTS clips in /audio/walk-*.mp3.
 */

export type AppWalkPhase = "ask" | "today" | "set" | "rest" | "done";

export const WALK_VOICE_NAME = "Eddy (English (US))";

export const WALK_VOICE_SRC: Record<Exclude<AppWalkPhase, "ask">, string> = {
  today: "/audio/walk-today.mp3",
  set: "/audio/walk-set.mp3",
  rest: "/audio/walk-rest.mp3",
  done: "/audio/walk-done.mp3",
};

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
