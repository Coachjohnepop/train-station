export type DayFinisher = {
  userId: string;
  name: string;
};

export function displayFinisherFirstName(name: string | null | undefined, email: string): string {
  const trimmed = (name || "").trim();
  if (/^lemon\s+john$/i.test(trimmed)) return "John";
  if (trimmed) return trimmed.split(/\s+/)[0] || trimmed;
  const local = email.split("@")[0] || "Member";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function attachFinisherNames<T extends { calendarDate?: string; iso: string }>(
  days: T[],
  finishersByDate: Record<string, DayFinisher[]>,
): Array<T & { finisherNames: string[] }> {
  return days.map((day) => {
    const key =
      day.calendarDate && /^\d{4}-\d{2}-\d{2}$/.test(day.calendarDate)
        ? day.calendarDate
        : /^\d{4}-\d{2}-\d{2}$/.test(day.iso)
          ? day.iso
          : "";
    return {
      ...day,
      finisherNames: key ? (finishersByDate[key] || []).map((f) => f.name) : [],
    };
  });
}
