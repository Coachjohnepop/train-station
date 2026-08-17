# Programs, workouts, and exercises

Printable ER: [`programs-workouts-exercises-er.pdf`](./programs-workouts-exercises-er.pdf)

Regenerate after a schema change:

```bash
python3 docs/generate-programs-workouts-er.py
```

Source of truth: `prisma/schema.prisma`.

```mermaid
erDiagram
  Program ||--o{ ProgramWeek : weeks
  Program ||--o{ ProgramMacroPhase : phases
  Program ||--o{ ProgramEnrollment : enrolls
  Program ||--o{ WorkoutCycle : "optional 28-day library"

  ProgramWeek ||--o{ ProgramDay : days
  ProgramDay ||--o{ ProgramDaySession : parts
  ProgramDay ||--o{ ProgramDayOption : "denormalized tracks"
  ProgramDay }o--o| Workout : "legacy workoutId"

  ProgramDaySession ||--o{ ProgramDayOption : tracks
  ProgramDayOption }o--|| Workout : "gym or home clone"

  Workout ||--o{ WorkoutExercise : lines
  Workout ||--o| WorkoutTemplate : "library card"
  Workout ||--o{ WorkoutLog : sessions
  Workout ||--o{ WorkoutCycleDaySlot : "cycle slots"

  Exercise ||--o{ WorkoutExercise : "used in"
  Exercise ||--o{ ExercisePerformance : silhouettes
  Exercise ||--o{ ExerciseEquipment : kit

  WorkoutExercise ||--o{ WorkoutSetPhase : "HOLD / REPS / BURNOUT / TIMED"

  WorkoutCycle ||--o{ WorkoutCycleDay : "days 1-28"
  WorkoutCycleDay ||--o{ WorkoutCycleDaySlot : "Gym / Home"

  User ||--o{ ProgramEnrollment : members
  User ||--o{ WorkoutLog : logs
  User ||--o{ ExercisePerformance : records
```
