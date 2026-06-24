import SmsHubWorkspace from "@/components/SmsHubWorkspace";

export const dynamic = "force-dynamic";

export default function AdminSmsHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SMS Hub</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Coach messaging without a Twilio number — email pings + in-app chat. Members never text your personal phone.
        </p>
      </div>
      <SmsHubWorkspace />
    </div>
  );
}