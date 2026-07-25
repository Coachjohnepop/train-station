export type AlertChannels = {
  inApp: boolean;
  sms: boolean;
  email: boolean;
};

export type CoachAlertEvent =
  | "newMember"
  | "warmupStarted"
  | "intakeScheduled"
  | "workoutLogged";

export type CoachAlertPrefs = Record<CoachAlertEvent, AlertChannels>;

export const DEFAULT_ALERT_CHANNELS: AlertChannels = {
  inApp: true,
  sms: false,
  email: true,
};

export function defaultCoachAlertPrefs(): CoachAlertPrefs {
  return {
    newMember: { ...DEFAULT_ALERT_CHANNELS },
    warmupStarted: { inApp: true, sms: true, email: false },
    intakeScheduled: { inApp: true, sms: false, email: true },
    /** Default: Messages + email so coach sees what the member did. */
    workoutLogged: { inApp: true, sms: false, email: true },
  };
}

export function normalizeAlertChannels(raw: unknown): AlertChannels {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ALERT_CHANNELS };
  const data = raw as Partial<AlertChannels>;
  return {
    inApp: data.inApp !== false,
    sms: Boolean(data.sms),
    email: data.email !== false,
  };
}

export function normalizeCoachAlertPrefs(raw: unknown): CoachAlertPrefs {
  const defaults = defaultCoachAlertPrefs();
  if (!raw || typeof raw !== "object") return defaults;
  const data = raw as Partial<Record<CoachAlertEvent, unknown>>;
  return {
    newMember: normalizeAlertChannels(data.newMember ?? defaults.newMember),
    warmupStarted: normalizeAlertChannels(data.warmupStarted ?? defaults.warmupStarted),
    intakeScheduled: normalizeAlertChannels(data.intakeScheduled ?? defaults.intakeScheduled),
    workoutLogged: normalizeAlertChannels(data.workoutLogged ?? defaults.workoutLogged),
  };
}

/** Per-event prefs: member override wins when set, else global. */
export function resolveAlertChannels(
  globalPrefs: CoachAlertPrefs,
  memberOverrides: Partial<CoachAlertPrefs> | null | undefined,
  event: CoachAlertEvent,
): AlertChannels {
  const override = memberOverrides?.[event];
  if (override) return normalizeAlertChannels(override);
  return globalPrefs[event];
}