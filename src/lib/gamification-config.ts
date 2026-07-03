import "server-only";

import { getCoachSettings } from "@/lib/coach-settings-store";
import {
  DEFAULT_GAMIFICATION_POINTS,
  type GamificationEventType,
  type GamificationPointsMap,
} from "@/lib/gamification-types";

export async function getGamificationPointsConfig(): Promise<GamificationPointsMap> {
  const settings = await getCoachSettings();
  return settings.gamificationPoints;
}

export async function getGamificationPointValue(type: GamificationEventType): Promise<number> {
  const config = await getGamificationPointsConfig();
  return config[type];
}

export function withDefaultGamificationPoints(
  config?: Partial<GamificationPointsMap> | null,
): GamificationPointsMap {
  return { ...DEFAULT_GAMIFICATION_POINTS, ...config };
}