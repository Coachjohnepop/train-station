"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Role = "ADMIN" | "INSTRUCTOR" | "MEMBER" | "PROSPECTIVE_INSTRUCTOR";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: string;
  notes: string | null;
  phone: string | null;
  dailyReminderTime: string | null;
  createdAt: string;
  subscription: { tier: string; status: string } | null;
  counts: { enrollments: number; performances: number; workoutLogs: number };
};

const ROLES: Role[] = ["ADMIN", "INSTRUCTOR", "MEMBER", "PROSPECTIVE_INSTRUCTOR"];
const STATUSES = ["active", "pending", "suspended"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "MEMBER" as Role,
    status: "active",
    notes: "",
    phone: "",
    dailyReminderTime: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadUsers() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (roleFilter) params.set("role", roleFilter);
    const res = await fetch(`/api/users?${params.toString()}`);
    const data = await res.json();
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, [q, roleFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ email: "", name: "", role: "MEMBER", status: "active", notes: "", phone: "", dailyReminderTime: "" });
    setError("");
    setModalOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({
      email: u.email,
      name: u.name || "",
      role: u.role,
      status: u.status,
      notes: u.notes || "",
      phone: u.phone || "",
      dailyReminderTime: u.dailyReminderTime || "",
    });
    setError("");
    setModalOpen(true);
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload: any = {
      name: form.name || undefined,
      role: form.role,
      status: form.status,
      notes: form.notes || null,
      phone: form.phone || null,
      dailyReminderTime: form.dailyReminderTime || null,
    };

    let res: Response;
    if (editing) {
      res = await fetch(`/api/users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      payload.email = form.email;
      res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (res.ok) {
      setModalOpen(false);
      await loadUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.detail || "Failed to save");
    }
    setSaving(false);
  }

  async function deleteUser(id: string, email: string) {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadUsers();
    } else {
      alert("Failed to delete");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage all accounts: admins, instructors, members (free/paid via subscription), and prospective instructors.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          + New User
        </button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search name or email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input w-64"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "")}
          className="input w-52"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setQ("");
            setRoleFilter("");
          }}
          className="btn-ghost text-sm"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <th className="py-2 pr-4">Name / Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Phone / SMS</th>
              <th className="py-2 pr-4">Subscription</th>
              <th className="py-2 pr-4">Activity</th>
              <th className="py-2 pr-4">Created</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--muted)]">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--muted)]">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{u.name || "—"}</div>
                    <div className="text-xs text-[var(--muted)]">{u.email}</div>
                    {u.notes && (
                      <div className="mt-1 line-clamp-1 text-[10px] text-amber-600/80" title={u.notes}>
                        {u.notes}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium">
                      {u.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        u.status === "active"
                          ? "bg-[var(--success)]/15 text-[var(--success)]"
                          : u.status === "pending"
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-[var(--danger)]/15 text-[var(--danger)]"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {u.phone ? (
                      <div>
                        <span className="font-mono">{u.phone}</span>
                        {u.dailyReminderTime && <div className="text-[10px] text-[var(--muted)]">remind {u.dailyReminderTime}</div>}
                      </div>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {u.subscription ? (
                      <>
                        {u.subscription.tier} <span className="text-[var(--muted)]">({u.subscription.status})</span>
                      </>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-[var(--muted)]">
                    {u.counts.workoutLogs} logs · {u.counts.enrollments} programs
                  </td>
                  <td className="py-3 pr-4 text-xs text-[var(--muted)]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => openEdit(u)}
                        className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--surface-2)]"
                      >
                        Edit
                      </button>
                      {u.role === "MEMBER" && (
                        <Link
                          href={`/member/workout?asInstructor=true&forUser=${encodeURIComponent(u.email)}`}
                          className="rounded border border-accent/40 px-2 py-1 text-accent hover:bg-accent/10"
                        >
                          Coach Workout
                        </Link>
                      )} {/* Eating (diet) coming soon - removed from coach drills */}
                      <button
                        onClick={() => deleteUser(u.id, u.email)}
                        className="rounded border border-[var(--danger)]/40 px-2 py-1 text-[var(--danger)] hover:bg-[var(--danger)]/10"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="text-lg font-semibold">{editing ? "Edit User" : "Create User"}</h3>

            <form onSubmit={saveUser} className="mt-4 space-y-4">
              {!editing && (
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Email</span>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input mt-1 w-full"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs text-[var(--muted)]">Name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input mt-1 w-full"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Role</span>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                    className="input mt-1 w-full"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="input mt-1 w-full"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-[var(--muted)]">Admin Notes (visible only here)</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input mt-1 h-20 w-full resize-y"
                  placeholder="e.g. Approved after interview. Background check passed."
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Phone (for SMS)</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input mt-1 w-full"
                    placeholder="(555) 123-4567"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Daily SMS Reminder</span>
                  <input
                    type="text"
                    value={form.dailyReminderTime}
                    onChange={(e) => setForm({ ...form, dailyReminderTime: e.target.value })}
                    className="input mt-1 w-full"
                    placeholder="07:30"
                  />
                </label>
              </div>

              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-ghost"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>

            {editing && (
              <div className="mt-4 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
                ID: {editing.id} • Created: {new Date(editing.createdAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
