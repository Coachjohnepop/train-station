"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  bookingToIcs,
  downloadIcsFile,
  googleCalendarTemplateUrl,
} from "@/lib/calendar-links";

type BookingRow = {
  id: string;
  memberEmail: string;
  scheduledAt: string;
  createdAt?: string;
  durationMin: number;
  status: string;
  notes?: string | null;
  zoomUrl?: string | null;
  zoomHostUrl?: string | null;
  calendlyRescheduleUrl?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
};

function memberLabel(b: BookingRow) {
  return b.user?.name?.trim() || b.memberEmail.split("@")[0];
}

function timeUnknown(b: BookingRow) {
  if (!b.createdAt) return false;
  return Math.abs(new Date(b.scheduledAt).getTime() - new Date(b.createdAt).getTime()) < 120_000;
}

export default function CoachCalendarPanel() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", { cache: "no-store" });
      const data = await res.json().catch(() => []);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = useMemo(() => {
    const start = Date.now() - 30 * 60 * 1000;
    return rows
      .filter((b) => b.status !== "cancelled" && b.status !== "completed")
      .filter((b) => new Date(b.scheduledAt).getTime() >= start)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 8);
  }, [rows]);

  return (
    <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-sky-100">Coach calendar</h2>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            1:1s booked on Calendly. Zoom already gets them — add to Google here, or connect Google
            inside Calendly so new ones land automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/bookings" className="btn-ghost text-[10px]">
            All bookings
          </Link>
          <Link href="/admin/alerts" className="btn-ghost text-[10px]">
            Alerts
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-[var(--muted)]">Loading appointments…</p>
      ) : upcoming.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          No upcoming 1:1s in the app yet. New Calendly books also land in{" "}
          <Link href="/admin/alerts" className="text-accent hover:underline">
            Alerts
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {upcoming.map((b) => {
            const start = new Date(b.scheduledAt);
            const end = new Date(start.getTime() + (b.durationMin || 15) * 60_000);
            const title = `Intro · ${memberLabel(b)}`;
            const details = [
              `Member: ${memberLabel(b)} <${b.memberEmail}>`,
              b.notes,
              "The Train Station",
            ]
              .filter(Boolean)
              .join("\n");
            const gcal = googleCalendarTemplateUrl({
              title,
              start,
              end,
              details,
              location: b.zoomUrl || b.zoomHostUrl || undefined,
            });
            const when = start.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            const unknown = timeUnknown(b);
            return (
              <li
                key={b.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              >
                <p className="text-sm font-semibold">
                  {memberLabel(b)}
                  <span className="ml-2 text-xs font-normal text-[var(--muted)]">{when}</span>
                </p>
                {unknown ? (
                  <p className="mt-0.5 text-[11px] text-amber-200">
                    Slot time not synced from Calendly — this is when they booked.{" "}
                    <Link href="/admin/bookings" className="underline">
                      Connect Calendly API
                    </Link>{" "}
                    to pull the real meeting time.
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={gcal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary px-3 py-1 text-[11px]"
                  >
                    Add to Google Calendar
                  </a>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1 text-[11px]"
                    onClick={() =>
                      downloadIcsFile(
                        `intro-${memberLabel(b).replace(/\s+/g, "-").toLowerCase()}`,
                        bookingToIcs({
                          id: b.id,
                          title,
                          start,
                          end,
                          description: details,
                          location: b.zoomUrl || undefined,
                        }),
                      )
                    }
                  >
                    Download .ics
                  </button>
                  {b.zoomHostUrl || b.zoomUrl ? (
                    <a
                      href={b.zoomHostUrl || b.zoomUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost px-3 py-1 text-[11px]"
                    >
                      Open Zoom
                    </a>
                  ) : null}
                  <Link
                    href={`/admin/chat?member=${encodeURIComponent(b.memberEmail)}`}
                    className="btn-ghost px-3 py-1 text-[11px]"
                  >
                    Message
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
