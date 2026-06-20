"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import TextUploadPanel from "@/components/TextUploadPanel";

type WorkoutRow = {
  id: string;
  name: string;
  description: string | null;
  _count: { exercises: number };
};

export default function WorkoutList() {
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/workouts");
    setWorkouts(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const workout = await res.json();
    setName("");
    window.location.href = `/admin/workouts/${workout.id}`;
  }

  return (
    <div className="space-y-6">
      <TextUploadPanel mode="workout" onBuilt={() => load()} />

      <form onSubmit={handleCreate} className="card flex flex-wrap gap-3">
        <input
          className="input max-w-md flex-1"
          placeholder="New workout name (e.g. Leg Day A)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary">
          Create & edit
        </button>
      </form>

      <ul className="mt-6 space-y-2">
        {workouts.map((w) => (
          <li key={w.id}>
            <Link
              href={`/admin/workouts/${w.id}`}
              className="card flex items-center justify-between transition hover-accent-border"
            >
              <span className="font-medium">{w.name}</span>
              <span className="text-sm text-[var(--muted)]">
                {w._count.exercises} exercises
              </span>
            </Link>
          </li>
        ))}
        {workouts.length === 0 && (
          <p className="text-[var(--muted)]">No workouts yet.</p>
        )}
      </ul>
    </div>
  );
}