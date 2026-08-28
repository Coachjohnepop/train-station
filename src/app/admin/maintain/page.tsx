import AdminMaintainDesk from "@/components/AdminMaintainDesk";

export default function AdminMaintainPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quick maintain</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Business Class extra sessions (Lower, Upper Push, etc.). Review the list, change titles
          and blurbs here, then open <strong>Review &amp; edit exercises</strong> to swap movements,
          sets, and demo videos. Members see this on Today → Quick maintain.
        </p>
      </div>
      <AdminMaintainDesk />
    </div>
  );
}
