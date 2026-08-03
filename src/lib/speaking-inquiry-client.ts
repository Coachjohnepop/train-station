/** Client-safe constants for the speaking intake wizard (no server-only imports). */

export const SPEAKING_EVENT_TYPES = [
  { id: "keynote", label: "Keynote" },
  { id: "seminar", label: "Seminar / presentation" },
  { id: "workshop", label: "Hands-on workshop" },
  { id: "panel", label: "Panel / Q&A" },
  { id: "corporate", label: "Corporate / team training" },
  { id: "school", label: "School / youth org" },
  { id: "other", label: "Other" },
] as const;

export const SPEAKING_FORMATS = [
  { id: "virtual", label: "Virtual (Zoom)" },
  { id: "in_person", label: "In person" },
  { id: "hybrid", label: "Hybrid" },
  { id: "undecided", label: "Not sure yet" },
] as const;

export const SPEAKING_AUDIENCE_SIZES = [
  { id: "under_25", label: "Under 25" },
  { id: "25_75", label: "25–75" },
  { id: "75_200", label: "75–200" },
  { id: "200_plus", label: "200+" },
  { id: "unknown", label: "Not sure" },
] as const;

export const SPEAKING_BUDGET_RANGES = [
  { id: "open", label: "Open / flexible" },
  { id: "under_1k", label: "Under $1,000" },
  { id: "1k_3k", label: "$1,000–$3,000" },
  { id: "3k_5k", label: "$3,000–$5,000" },
  { id: "5k_plus", label: "$5,000+" },
  { id: "prefer_not", label: "Prefer not to say" },
] as const;
