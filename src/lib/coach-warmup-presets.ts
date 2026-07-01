/** Jeremy's standard pre-session warm-up — members earn bonus points if done before coach arrives. */
export const JEREMY_STANDARD_WARMUP_TEXT = `Warm-up (bonus points if done before coach arrives)
5 min bike, row, or brisk walk
Wall taps 20
Band pull-aparts 15
Lightweight bicep curls 15
Light shoulder press 15
Shrugs 15
Bosu ball squats 10
Jump squats 10`;

export function lessonPlanHasWarmup(text: string): boolean {
  return /warm[- ]?up|wall\s*taps?|bonus\s+points|5\s*min\s+bike/i.test(text);
}

export function injectWarmupIfMissing(text: string, includeWarmup: boolean): string {
  if (!includeWarmup || lessonPlanHasWarmup(text)) return text.trim();
  const body = text.trim();
  if (!body) return JEREMY_STANDARD_WARMUP_TEXT;
  return `${JEREMY_STANDARD_WARMUP_TEXT}\n\n${body}`;
}