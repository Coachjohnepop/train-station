export const ANALYTICS_EVENT_TYPES = [
  "page_view",
  "page_click",
  "signup_step",
  "workout_started",
  "workout_completed",
  "exercise_logged",
  "program_enrolled",
  "subscription_started",
  "subscription_canceled",
  "booking_created",
  "live_session_joined",
  "coach_content_edit",
  "workout_certified",
  "custom",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type AnalyticsEventInput = {
  eventType: AnalyticsEventType | string;
  occurredAt?: string;
  sessionKey?: string;
  anonymousId?: string;
  pagePath?: string;
  pageTitle?: string;
  pageSection?: string;
  referrer?: string;
  elementId?: string;
  elementText?: string;
  elementRole?: string;
  clickHref?: string;
  clickAction?: string;
  programId?: string;
  programSlug?: string;
  workoutId?: string;
  exerciseId?: string;
  enrollmentId?: string;
  tierSlug?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  deviceType?: string;
  properties?: Record<string, unknown>;
};

export type AnalyticsSessionContext = {
  sessionKey: string;
  anonymousId?: string;
  landingPath?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  deviceType?: string;
  userAgent?: string;
};

export type AnalyticsIngestPayload = {
  session: AnalyticsSessionContext;
  events: AnalyticsEventInput[];
};