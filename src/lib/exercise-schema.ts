import { z } from "zod";
import {
  SET_APPROACHES,
  WEIGHT_TIERS,
  ALL_REP_PATTERN_IDS,
  approachNeedsReps,
  approachNeedsRepPattern,
  isValidSetCountForApproach,
} from "@/lib/workout-schemes";

const approachIds = SET_APPROACHES.map((s) => s.id) as [string, ...string[]];
const tierIds = WEIGHT_TIERS.map((t) => t.id) as [string, ...string[]];
const repPatternIds = ALL_REP_PATTERN_IDS as unknown as [string, ...string[]];

const setCountSchema = z.number().int().min(1).max(10);

export const exerciseFieldsSchema = {
  defaultSetScheme: z.enum(approachIds).optional().nullable(),
  defaultSets: setCountSchema.optional().nullable(),
  defaultWeightTier: z.enum(tierIds).optional().nullable(),
};

export const workoutSetCountSchema = setCountSchema;

export const workoutPrescriptionSchema = z
  .object({
    setScheme: z.enum(approachIds),
    repPattern: z.enum(repPatternIds).optional().nullable(),
    reps: z.string().max(20).optional().nullable(),
    sets: workoutSetCountSchema,
    weightTier: z.enum(tierIds),
    restSec: z.number().int().nonnegative().optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!isValidSetCountForApproach(data.sets, data.setScheme)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid set count for this approach",
        path: ["sets"],
      });
    }
    if (approachNeedsRepPattern(data.setScheme) && !data.repPattern) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rep pattern or dance count required",
        path: ["repPattern"],
      });
    }
    if (approachNeedsReps(data.setScheme) && !data.reps) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reps per set required",
        path: ["reps"],
      });
    }
  });