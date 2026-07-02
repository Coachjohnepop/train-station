import {
  injectWarmupIfMissing,
  lessonPlanHasWarmup,
} from "@/lib/coach-warmup-presets";
import {
  parseSmsWorkout,
  type ParsedSmsExercise,
  type ParsedSmsWorkout,
} from "@/lib/sms-workout-parser";

export type LessonPlanQuestion = {
  id: string;
  prompt: string;
  hint?: string;
  choices?: string[];
};

export type LessonPlanInterpretResult = {
  normalizedText: string;
  workout: ParsedSmsWorkout;
  questions: LessonPlanQuestion[];
  includeWarmup: boolean;
  warmupInjected: boolean;
  usedAi: boolean;
  confidence: "high" | "medium" | "low";
};

const VAGUE_EXERCISE =
  /^(press|curl|squat|row|raise|extension|lunge|fly|crunch)$/i;

function detectQuestions(
  workout: ParsedSmsWorkout,
  rawText: string,
): LessonPlanQuestion[] {
  const questions: LessonPlanQuestion[] = [];

  if (workout.exercises.length === 0) {
    questions.push({
      id: "no-exercises",
      prompt: "I couldn't find any exercises. What are the main lifts or blocks for this session?",
      hint: "List exercises one per line with sets/reps if you know them.",
    });
    return questions;
  }

  const mainExercises = workout.exercises.filter((e) => e.section !== "notes");
  const missingReps = mainExercises.filter(
    (e) => e.section === "main" && (e.reps === "—" || !e.reps) && e.sets <= 1,
  );
  if (missingReps.length > 0 && missingReps.length <= 4) {
    for (const ex of missingReps) {
      questions.push({
        id: `reps-${slugify(ex.name)}`,
        prompt: `How many sets and reps for "${ex.name}"?`,
        hint: "e.g. 4 sets of 10,10,10,10 or 3x12",
      });
    }
  }

  for (const ex of mainExercises) {
    if (VAGUE_EXERCISE.test(ex.name.trim())) {
      questions.push({
        id: `clarify-${slugify(ex.name)}`,
        prompt: `"${ex.name}" is vague — which variation?`,
        choices: guessChoices(ex.name),
      });
    }
  }

  if (/leg\s*press/i.test(rawText) && !/machine|hack|horizontal/i.test(rawText)) {
    questions.push({
      id: "leg-press-type",
      prompt: "Which leg press setup?",
      choices: ["Machine leg press", "Hack squat", "Horizontal leg press"],
    });
  }

  if (workout.title === "Coach SMS Workout" && rawText.split("\n").filter(Boolean).length > 3) {
    questions.push({
      id: "session-title",
      prompt: "What should we call this session?",
      hint: "e.g. Lower Day, Upper Push, Isolation/Core",
    });
  }

  if (!lessonPlanHasWarmup(rawText)) {
    questions.push({
      id: "include-warmup",
      prompt: "Include Jeremy's standard warm-up (wall taps, bands, light curls, Bosu/jump squats)?",
      choices: ["Yes — add standard warm-up", "No — main workout only"],
    });
  }

  const seen = new Set<string>();
  return questions.filter((q) => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  }).slice(0, 6);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
}

function guessChoices(name: string): string[] {
  const n = name.toLowerCase();
  if (n === "press") {
    return ["Bench press", "Shoulder press", "Leg press", "Chest press machine"];
  }
  if (n === "curl") return ["Bicep curl", "Hammer curl", "Tricep extension"];
  if (n === "squat") return ["Back squat", "Goblet squat", "Bulgarian split squat"];
  if (n === "row") return ["Cable row", "Barbell row", "Machine row"];
  return ["Specify in answer"];
}

function applyAnswerToText(text: string, question: LessonPlanQuestion, answer: string): string {
  const a = answer.trim();
  if (!a) return text;

  if (question.id === "no-exercises") {
    return `${text.trim()}\n\n${a}`;
  }
  if (question.id === "session-title") {
    const lines = text.trim().split("\n");
    if (lines.length > 0 && !lessonPlanHasWarmup(lines[0])) {
      return `${a}\n${lines.join("\n")}`;
    }
    return `${a}\n\n${text.trim()}`;
  }
  if (question.id === "include-warmup") {
    return text;
  }
  if (question.id.startsWith("reps-")) {
    const namePart = question.id.replace("reps-", "").replace(/-/g, " ");
    return `${text.trim()}\n${namePart} ${a}`;
  }
  if (question.id.startsWith("clarify-") || question.id === "leg-press-type") {
    const vague = question.prompt.match(/"([^"]+)"/)?.[1];
    if (vague && text.toLowerCase().includes(vague.toLowerCase())) {
      return text.replace(new RegExp(`\\b${escapeRegExp(vague)}\\b`, "i"), a);
    }
    return `${text.trim()}\n${a}`;
  }
  return `${text.trim()}\n${a}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreConfidence(workout: ParsedSmsWorkout, questionCount: number): "high" | "medium" | "low" {
  if (workout.exercises.length === 0 || questionCount >= 4) return "low";
  if (questionCount >= 2) return "medium";
  const main = workout.exercises.filter((e) => e.section === "main");
  if (main.length >= 2 && main.every((e) => e.reps && e.reps !== "—")) return "high";
  return "medium";
}

async function interpretWithXai(
  text: string,
  templateMemberName?: string,
): Promise<{ normalizedText: string; workout: ParsedSmsWorkout; questions: LessonPlanQuestion[] } | null> {
  const { xaiChatCompletion } = await import("@/lib/xai-chat");

  const system = `You interpret coach lesson plans for a fitness app. Output JSON only:
{
  "title": "session title",
  "normalizedText": "full workout text one exercise per line with sets/reps",
  "exercises": [{"name":"","sets":1,"reps":"","notes":"","section":"warmup|main|cooldown"}],
  "questions": [{"id":"unique","prompt":"","hint":"","choices":[]}]
}
Rules:
- Jeremy's sessions usually include a warm-up (bike, wall taps, bands, light curls, shoulder press, shrugs, Bosu/jump squats).
- Ask clarifying questions only when exercise names are ambiguous or sets/reps are missing.
- Keep coach's voice; don't invent heavy weights.
- section warmup for warm-up blocks, main for working sets.`;

  const user = templateMemberName
    ? `Coach built this for ${templateMemberName}:\n\n${text}`
    : text;

  try {
    const result = await xaiChatCompletion(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      {
        model: process.env.XAI_LESSON_PLAN_MODEL?.trim() || undefined,
        reasoningEffort: "low",
        temperature: 0.2,
        responseFormat: { type: "json_object" },
      },
    );
    if ("error" in result) return null;
    const content = result.content;
    const parsed = JSON.parse(content) as {
      title?: string;
      normalizedText?: string;
      exercises?: ParsedSmsExercise[];
      questions?: LessonPlanQuestion[];
    };
    const normalizedText = (parsed.normalizedText || text).trim();
    const workout: ParsedSmsWorkout = {
      title: parsed.title || "Coach SMS Workout",
      exercises: Array.isArray(parsed.exercises) && parsed.exercises.length > 0
        ? parsed.exercises
        : parseSmsWorkout(normalizedText).exercises,
      rawText: normalizedText,
    };
    return {
      normalizedText,
      workout,
      questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 6) : [],
    };
  } catch {
    return null;
  }
}

export function applyLessonPlanAnswers(
  text: string,
  questions: LessonPlanQuestion[],
  answers: Record<string, string>,
  includeWarmup: boolean,
): string {
  let out = text.trim();
  for (const q of questions) {
    const ans = answers[q.id];
    if (!ans) continue;
    if (q.id === "include-warmup") {
      if (/^yes/i.test(ans)) {
        out = injectWarmupIfMissing(out, true);
      }
      continue;
    }
    out = applyAnswerToText(out, q, ans);
  }
  return injectWarmupIfMissing(out, includeWarmup);
}

export async function interpretLessonPlan(opts: {
  rawText: string;
  includeWarmup?: boolean;
  templateMemberName?: string;
  answers?: Record<string, string>;
  priorQuestions?: LessonPlanQuestion[];
}): Promise<LessonPlanInterpretResult> {
  const {
    rawText,
    includeWarmup: includeWarmupOpt = true,
    templateMemberName,
    answers = {},
    priorQuestions = [],
  } = opts;

  let text = rawText.trim();
  let usedAi = false;

  if (Object.keys(answers).length > 0 && priorQuestions.length > 0) {
    const warmupAnswer = answers["include-warmup"];
    const wantsWarmup =
      includeWarmupOpt &&
      (!warmupAnswer || /^yes/i.test(warmupAnswer));
    text = applyLessonPlanAnswers(text, priorQuestions, answers, wantsWarmup);
  }

  const ai = await interpretWithXai(text, templateMemberName);
  let workout: ParsedSmsWorkout;
  let questions: LessonPlanQuestion[];

  if (ai) {
    usedAi = true;
    workout = ai.workout;
    questions = ai.questions;
    text = ai.normalizedText;
  } else {
    const withWarmup = injectWarmupIfMissing(text, includeWarmupOpt);
    workout = parseSmsWorkout(withWarmup);
    text = withWarmup;
    questions = detectQuestions(workout, text);
  }

  const warmupInjected = includeWarmupOpt && !lessonPlanHasWarmup(rawText) && lessonPlanHasWarmup(text);
  const confidence = scoreConfidence(workout, questions.length);

  return {
    normalizedText: text,
    workout,
    questions,
    includeWarmup: includeWarmupOpt,
    warmupInjected,
    usedAi,
    confidence,
  };
}