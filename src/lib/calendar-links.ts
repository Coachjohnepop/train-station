/** Google Calendar “Add event” + ICS for coach 1:1s. No Google OAuth. */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC stamp Google Calendar TEMPLATE expects: 20260915T134300Z */
export function googleCalendarUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function googleCalendarTemplateUrl(input: {
  title: string;
  start: Date;
  end: Date;
  details?: string;
  location?: string;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${googleCalendarUtcStamp(input.start)}/${googleCalendarUtcStamp(input.end)}`,
  });
  if (input.details?.trim()) params.set("details", input.details.trim());
  if (input.location?.trim()) params.set("location", input.location.trim());
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function bookingToIcs(input: {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
}): string {
  const uid = `${input.id}@thetrainstation.co`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Train Station//Coach Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${googleCalendarUtcStamp(new Date())}`,
    `DTSTART:${googleCalendarUtcStamp(input.start)}`,
    `DTEND:${googleCalendarUtcStamp(input.end)}`,
    `SUMMARY:${icsEscape(input.title)}`,
  ];
  if (input.description?.trim()) lines.push(`DESCRIPTION:${icsEscape(input.description.trim())}`);
  if (input.location?.trim()) lines.push(`LOCATION:${icsEscape(input.location.trim())}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcsFile(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  a.click();
  URL.revokeObjectURL(href);
}
