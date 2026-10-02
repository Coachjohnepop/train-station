export const LEAD_LANES = ["inbox", "drip", "convert", "archive"] as const;

export type LeadLane = (typeof LEAD_LANES)[number];

export type LeadFilter = "all" | "drip" | "convert" | "archive";

export function normalizeLeadLane(value?: string | null): LeadLane {
  if (value === "drip" || value === "convert" || value === "archive" || value === "inbox") {
    return value;
  }
  return "inbox";
}

export function leadMatchesFilter(
  lead: { lane?: string | null },
  filter: LeadFilter,
): boolean {
  const lane = normalizeLeadLane(lead.lane);
  if (filter === "all") return lane !== "archive";
  return lane === filter;
}

export function countLeadsByFilter(
  leads: Array<{ lane?: string | null }>,
): Record<LeadFilter, number> {
  return {
    all: leads.filter((lead) => leadMatchesFilter(lead, "all")).length,
    drip: leads.filter((lead) => leadMatchesFilter(lead, "drip")).length,
    convert: leads.filter((lead) => leadMatchesFilter(lead, "convert")).length,
    archive: leads.filter((lead) => leadMatchesFilter(lead, "archive")).length,
  };
}
