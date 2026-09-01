import AdminCoachInbox from "@/components/AdminCoachInbox";

export const dynamic = "force-dynamic";

export default function AdminAlertsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Alerts</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          New signups, Calendly intro bookings, and Zoom join requests — so you see them even if
          email is sitting unread. Phone buzz still needs Enable alerts once (Settings).
        </p>
      </div>
      <AdminCoachInbox />
    </div>
  );
}
