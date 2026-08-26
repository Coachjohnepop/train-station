"use client";

import { useEffect, useState } from "react";
import AdminBookingZoomActions from "@/components/AdminBookingZoomActions";
import AdminCalendlyConnect from "@/components/AdminCalendlyConnect";
import SmsWorkoutOverridePanel from "@/components/SmsWorkoutOverridePanel";
import TimeScrollPicker from "@/components/TimeScrollPicker";
import PhoneInput from "@/components/PhoneInput";
import { formatPhoneDisplay } from "@/lib/sms-phone";

type Contact = { email: string; phone?: string | null; calendlyUrl?: string | null };
type Availability = { id: string; weekday: number; startHour: number; startMinute: number; endHour: number; endMinute: number; slotDurationMin: number };
type Booking = {
  id: string;
  memberEmail: string;
  memberPhone?: string | null;
  adminEmail: string;
  adminPhone?: string | null;
  scheduledAt: string;
  durationMin: number;
  zoomUrl?: string | null;
  zoomHostUrl?: string | null;
  zoomMeetingId?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
  user?: { dailyReminderTime?: string | null; phone?: string | null };
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminBookingsPage() {
  const [contact, setContact] = useState<Contact>({ email: "", phone: "", calendlyUrl: "" });
  const [avails, setAvails] = useState<Availability[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // SMS Broadcast state
  const [recipients, setRecipients] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastCategory, setBroadcastCategory] = useState<"general" | "fasted-cardio" | "sleep" | "exercise">("general"); // eating coming soon
  const [broadcasting, setBroadcasting] = useState(false);
  const [programSummaries, setProgramSummaries] = useState<any[]>([]);

  async function loadAll() {
    setLoading(true);
    const [cRes, aRes, bRes, lRes, rRes, pRes] = await Promise.all([
      fetch("/api/admin/contact"),
      fetch("/api/admin/availability"),
      fetch("/api/bookings"),
      fetch("/api/reminders/logs"),
      fetch("/api/sms/broadcast"),
      fetch("/api/admin/programs-summary"),
    ]);
    if (cRes.ok) setContact(await cRes.json());
    if (aRes.ok) setAvails(await aRes.json());
    if (bRes.ok) setBookings(await bRes.json());
    if (lRes.ok) setSmsLogs(await lRes.json());
    if (rRes.ok) {
      const rdata = await rRes.json();
      setRecipients(rdata.recipients || []);
      // default select all that have phone
      setSelectedIds((rdata.recipients || []).filter((r: any) => r.phone).map((r: any) => r.id));
    }
    if (pRes.ok) {
      const pdata = await pRes.json();
      setProgramSummaries(pdata.programs || []);
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function saveContact() {
    const res = await fetch("/api/admin/contact", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contact),
    });
    if (res.ok) {
      setMsg("Contact saved");
      setTimeout(() => setMsg(null), 2000);
    }
  }

  // Simple UI: checkboxes for days + time ranges. For demo, we'll set 1 range per selected day.
  const [selectedDays, setSelectedDays] = useState<number[]>([1,2,3,4,5]);
  const [startH, setStartH] = useState(9);
  const [endH, setEndH] = useState(17);

  async function saveAvailability() {
    const slots = selectedDays.map((wd) => ({
      weekday: wd,
      startHour: startH,
      startMinute: 0,
      endHour: endH,
      endMinute: 0,
    }));
    const res = await fetch("/api/admin/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slots),
    });
    if (res.ok) {
      setMsg("Availability saved");
      await loadAll();
      setTimeout(() => setMsg(null), 2000);
    }
  }

  async function updateBooking(b: Booking, updates: Partial<Booking> & { reminderTime?: string }) {
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, ...updates }),
    });
    if (res.ok) {
      await loadAll();
    }
  }

  async function sendReminders() {
    const res = await fetch("/api/reminders/send", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setMsg(`Sent ${data.sent} reminders.`);
      if (data.logs) {
        setSmsLogs((prev) => [...data.logs, ...prev].slice(0, 20));
      } else {
        await loadAll();
      }
      setTimeout(() => setMsg(null), 4000);
    }
  }

  async function sendBroadcast() {
    if (!broadcastMsg.trim() || selectedIds.length === 0) return;
    setBroadcasting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sms/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userIds: selectedIds, 
          message: broadcastMsg.trim(),
          category: broadcastCategory,
          taskDetails: broadcastCategory !== "general" ? { category: broadcastCategory, task: broadcastMsg } : undefined
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMsg(`Broadcast sent to ${data.sent} recipient(s).`);
        // refresh logs + clear composer optionally
        await loadAll();
        // keep message for possible resend tweak, or clear:
        // setBroadcastMsg("");
        setTimeout(() => setMsg(null), 5000);
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg("Broadcast failed: " + (err.detail || res.statusText));
      }
    } finally {
      setBroadcasting(false);
    }
  }

  function toggleRecipient(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllRecipients() {
    setSelectedIds(recipients.filter((r) => r.phone).map((r) => r.id));
  }

  function clearRecipients() {
    setSelectedIds([]);
  }

  const charCount = broadcastMsg.length;
  const previewRecipient = recipients.find((r) => selectedIds.includes(r.id));
  const previewText = previewRecipient && broadcastMsg
    ? broadcastMsg.replace(/\{name\}/gi, (previewRecipient.name || previewRecipient.email.split("@")[0]).split(" ")[0])
    : "";

  if (loading) return <p>Loading booking admin...</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Bookings, Onboarding &amp; SMS</h1>
      <p className="text-sm text-[var(--muted)]">
        Coach contact/availability for Zoom onboarding (15 min). Use the new SMS Broadcast tool below to text members (or staff) directly. Daily reminders still available via the simulate button.
      </p>

      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      <AdminCalendlyConnect />

      <section className="card">
        <h2 className="font-semibold mb-3">Coach Contact Info</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Email</span>
            <input
              className="input mt-1 w-full"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Phone</span>
            <PhoneInput
              className="input mt-1 w-full"
              value={contact.phone || ""}
              onChange={(phone) => setContact({ ...contact, phone })}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-[var(--muted)]">Calendly Link (for onboarding &amp; quick booking)</span>
            <input
              className="input mt-1 w-full"
              value={contact.calendlyUrl || ""}
              placeholder="https://calendly.com/jeremy-thetrainstation/new-meeting"
              onChange={(e) => setContact({ ...contact, calendlyUrl: e.target.value })}
            />
          </label>
        </div>
        <button onClick={saveContact} className="btn-primary mt-3">Save Contact</button>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">Availability (recurring weekly)</h2>
        <p className="text-sm text-[var(--muted)] mb-3">Select days and time window. 15-min slots will be generated for members to pick from.</p>

        <div className="flex flex-wrap gap-2 mb-3">
          {WEEKDAYS.map((d, i) => (
            <label key={i} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={selectedDays.includes(i)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedDays([...selectedDays, i]);
                  else setSelectedDays(selectedDays.filter((x) => x !== i));
                }}
              />
              {d}
            </label>
          ))}
        </div>

        <div className="flex gap-3 items-end mb-3">
          <label>
            <span className="text-xs text-[var(--muted)]">Start hour (24h)</span>
            <input type="number" className="input w-20 mt-1" value={startH} min={0} max={23} onChange={(e) => setStartH(parseInt(e.target.value))} />
          </label>
          <label>
            <span className="text-xs text-[var(--muted)]">End hour (24h)</span>
            <input type="number" className="input w-20 mt-1" value={endH} min={0} max={23} onChange={(e) => setEndH(parseInt(e.target.value))} />
          </label>
          <button onClick={saveAvailability} className="btn-primary">Save Availability</button>
        </div>

        <div className="text-xs text-[var(--muted)]">
          Current active: {avails.length} day(s) configured.
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Upcoming / Recent Bookings</h2>
          <button onClick={sendReminders} className="btn-primary text-xs px-3 py-1">Simulate Send Daily SMS Reminders</button>
        </div>
        {bookings.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No bookings yet. Members can book from the member area.</p>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="card text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <div>
                    <strong>Member:</strong> {b.memberEmail}{" "}
                    {b.memberPhone && `• ${formatPhoneDisplay(b.memberPhone)}`}
                  </div>
                  <div><strong>When:</strong> {new Date(b.scheduledAt).toLocaleString()}</div>
                  <div><strong>Status:</strong> {b.status}</div>
                  {b.user?.dailyReminderTime && <div><strong>Daily SMS reminder:</strong> {b.user.dailyReminderTime}</div>}
                </div>
                <div className="mt-2">
                  <AdminBookingZoomActions
                    bookingId={b.id}
                    initialJoinUrl={b.zoomUrl}
                    initialHostUrl={b.zoomHostUrl}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <input
                    className="input text-xs w-80"
                    placeholder="Zoom URL (https://zoom.us/j/...) — or use Create Zoom link"
                    defaultValue={b.zoomUrl || ""}
                    onBlur={(e) => updateBooking(b, { zoomUrl: e.target.value || undefined })}
                  />
                  <select
                    className="input text-xs"
                    defaultValue={b.status}
                    onChange={(e) => updateBooking(b, { status: e.target.value })}
                  >
                    <option value="pending">pending</option>
                    <option value="confirmed">confirmed</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                  <input
                    className="input text-xs flex-1 min-w-[200px]"
                    placeholder="Notes (optional)"
                    defaultValue={b.notes || ""}
                    onBlur={(e) => updateBooking(b, { notes: e.target.value || undefined })}
                  />
                  <div className="w-36 shrink-0" title="Daily reminder time — set during interview call">
                    <TimeScrollPicker
                      placeholder="Remind time"
                      value={b.user?.dailyReminderTime || ""}
                      onChange={(reminderTime) =>
                        updateBooking(b, { reminderTime, memberPhone: b.memberPhone || undefined })
                      }
                    />
                  </div>
                </div>
                <div className="text-[10px] text-[var(--muted)] mt-1">
                  Admin: {b.adminEmail} {b.adminPhone && `• ${b.adminPhone}`} • Booked {new Date(b.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Go to Today — SMS workout builder</h2>
        <p className="text-xs text-[var(--muted)] mb-2">
          Paste SMS text to build a full checkoff workout that overrides the schedule. Best for John, Stephanie, or any member on a specific date/time.
        </p>
        <a href="/admin/today" className="btn-primary text-sm inline-flex px-4 py-1 mb-4">
          Open Go to Today (coach) →
        </a>
        <h3 className="font-semibold mb-2 text-sm">Legacy: per-day schedule override</h3>
        <SmsWorkoutOverridePanel programs={programSummaries} recipients={recipients} />
      </section>

      {/* SMS Broadcast composer - new capability */}
      <section className="card">
        <h2 className="font-semibold mb-2">SMS Broadcast</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Send a one-off text to any users who have a phone on file. Supports simple personalization: {"{name}"} becomes the first name.
          All sends are logged (visible below + in reminders history).
        </p>

        {recipients.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No recipients with phones loaded. Add phones via Users admin or member bookings.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase text-[var(--muted)]">Recipients with phone ({recipients.filter((r) => r.phone).length})</span>
              <button type="button" onClick={selectAllRecipients} className="text-xs underline">Select all</button>
              <button type="button" onClick={clearRecipients} className="text-xs underline">Clear</button>
              <span className="text-xs text-[var(--muted)]">• {selectedIds.length} selected</span>
            </div>

            <div className="max-h-40 overflow-auto border border-[var(--border)] rounded p-2 mb-3 text-sm grid gap-1">
              {recipients.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={() => toggleRecipient(r.id)}
                    disabled={!r.phone}
                  />
                  <span className={!r.phone ? "text-[var(--muted)]" : ""}>
                    {r.name || r.email}{" "}
                    <span className="font-mono text-[var(--muted)]">
                      {r.phone ? formatPhoneDisplay(r.phone) : "(no phone)"}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mb-2">
              <span className="text-xs text-[var(--muted)] block mb-1">Quick presets (sets category + message for eating, cardio, sleep, exercises)</span>
              <div className="flex flex-wrap gap-1 text-[10px]">
                <button type="button" onClick={() => { setBroadcastCategory("fasted-cardio"); setBroadcastMsg("Do 20-30 min fasted cardio this morning. Reply 'cardio done 25min' when complete."); }} className="btn-ghost px-2 py-0.5">Fasted Cardio</button>
                <button type="button" onClick={() => { setBroadcastCategory("sleep"); setBroadcastMsg("How many hours of sleep last night? Reply with the number (e.g. '7.5 hours')."); }} className="btn-ghost px-2 py-0.5">Sleep report</button>
                <button type="button" onClick={() => { setBroadcastCategory("exercise"); setBroadcastMsg("Quick finisher: 20 pushups. Do them and reply 'done' or 'pushups done'."); }} className="btn-ghost px-2 py-0.5">Quick exercise (e.g. pushups)</button>
                <button type="button" onClick={() => { setBroadcastCategory("general"); setBroadcastMsg(""); }} className="text-xs underline">Clear</button>
              </div>
            </div>

            <label className="block mb-1">
              <span className="text-xs text-[var(--muted)]">Message (use {"{name}"} for personalization) — category: {broadcastCategory}</span>
              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                className="input mt-1 h-24 w-full resize-y font-mono text-sm"
                placeholder="Hi {name}, just a quick note from the station — great work this week! Reply if you need anything."
              />
            </label>
            <div className="flex items-center justify-between text-[10px] text-[var(--muted)] mb-2">
              <div>{charCount} chars (aim &lt;160 per segment for SMS)</div>
              {previewRecipient && (
                <div className="italic">Preview for {previewRecipient.name || previewRecipient.email.split("@")[0]}: “{previewText.slice(0, 70)}{previewText.length > 70 ? "..." : ""}”</div>
              )}
            </div>

            <button
              onClick={sendBroadcast}
              disabled={broadcasting || !broadcastMsg.trim() || selectedIds.length === 0}
              className="btn-primary text-sm px-4 py-1 disabled:opacity-50"
            >
              {broadcasting ? "Sending..." : `Send Broadcast to ${selectedIds.length} recipient(s)`}
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">Recent SMS (reminders + broadcasts)</h2>
        {smsLogs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No SMS sent yet. Use the Simulate Daily Reminders button or the Broadcast composer above.</p>
        ) : (
          <ul className="text-xs space-y-1">
            {smsLogs.slice(0, 8).map((log: any, i: number) => (
              <li key={i} className="border-b pb-1 text-[10px]">
                {new Date(log.sentAt).toLocaleString()} 
                {log.source === "broadcast" && <span className="ml-1 rounded bg-violet-500/20 px-1 text-violet-400">BROADCAST{log.category ? ` (${log.category})` : ""}</span>}
                {log.source === "member-reply" && <span className="ml-1 rounded bg-emerald-500/20 px-1 text-emerald-400">MEMBER REPLY</span>}
                to {log.phone ? formatPhoneDisplay(log.phone) : log.user?.email}:{" "}
                {log.message?.substring(0, 90)}...
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reply Dashboard - lightweight admin view for member replies */}
      <section className="card">
        <h2 className="font-semibold mb-2">Reply Dashboard (Member SMS Replies)</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Inbound messages from members (simulated replies to reminders/broadcasts). Use the form below or the main Broadcast tool to reply directly to one person.
        </p>

        <div className="mb-3">
          <h3 className="text-sm font-medium mb-1">Recent Member Replies</h3>
          {smsLogs.filter((l: any) => l.source === "member-reply").length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No member replies yet. Members can send quick messages from their dashboard SMS settings.</p>
          ) : (
            <ul className="text-xs space-y-1 max-h-32 overflow-auto">
              {smsLogs.filter((l: any) => l.source === "member-reply").slice(0, 6).map((log: any, i: number) => (
                <li key={i} className="border-b pb-1 text-[10px] text-emerald-600">
                  {new Date(log.sentAt).toLocaleString()} from{" "}
                  {log.phone ? formatPhoneDisplay(log.phone) : "—"}:{" "}
                  {log.message?.replace("[Member reply] ", "")}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium mb-1">Quick Direct Reply</h3>
          <div className="flex flex-col gap-2 text-xs">
            <input
              className="input text-xs"
              placeholder="Target user email or leave blank for demo user"
              id="reply-target"
            />
            <textarea
              className="input text-xs h-14"
              placeholder="Thanks for the update — let's do a lighter home session today."
              id="reply-msg"
            />
            <button
              className="btn-ghost text-xs self-start"
              onClick={async () => {
                const target = (document.getElementById("reply-target") as HTMLInputElement)?.value.trim();
                const msg = (document.getElementById("reply-msg") as HTMLTextAreaElement)?.value.trim();
                if (!msg) return;
                const userIds = target ? undefined : ["demo-user"]; // default to demo
                // Reuse broadcast for a direct reply (it supports single user)
                const res = await fetch("/api/sms/broadcast", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userIds: target ? undefined : ["demo-user"],
                    message: msg,
                  }),
                });
                if (res.ok) {
                  alert("Reply sent (logged as broadcast to target). Refresh to see in Recent SMS.");
                  (document.getElementById("reply-msg") as HTMLTextAreaElement).value = "";
                } else {
                  alert("Failed to send reply");
                }
              }}
            >
              Send Reply
            </button>
            <div className="text-[10px] text-[var(--muted)]">
              This uses the existing broadcast tool under the hood for a 1:1 reply. Inbound member messages appear above with the green "MEMBER REPLY" tag.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
