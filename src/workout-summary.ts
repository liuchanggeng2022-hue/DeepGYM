import type { ExerciseSummary, WorkoutSession, WorkoutSummary } from "./workout-types";

function sameLocalDay(isoDate: string, date: Date) {
  const value = new Date(isoDate);
  return value.getFullYear() === date.getFullYear()
    && value.getMonth() === date.getMonth()
    && value.getDate() === date.getDate();
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

export function summarizeSessions(sessions: WorkoutSession[]): WorkoutSummary {
  const exercises = new Map<string, ExerciseSummary>();
  let setCount = 0;
  let repCount = 0;
  let volumeKg = 0;
  let durationMinutes = 0;

  for (const session of sessions) {
    if (session.endedAt) {
      const duration = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
      durationMinutes += Math.max(1, Math.round(duration / 60_000));
    }

    for (const workoutExercise of session.exercises) {
      const completedSets = workoutExercise.sets.filter((set) => set.completed && set.reps && set.reps > 0);
      if (completedSets.length === 0) continue;

      const exerciseSummary = exercises.get(workoutExercise.exerciseId) || {
        exerciseId: workoutExercise.exerciseId,
        setCount: 0,
        repCount: 0,
        volumeKg: 0,
      };

      for (const set of completedSets) {
        const reps = set.reps || 0;
        const setVolume = (set.weightKg || 0) * reps;
        setCount += 1;
        repCount += reps;
        volumeKg += setVolume;
        exerciseSummary.setCount += 1;
        exerciseSummary.repCount += reps;
        exerciseSummary.volumeKg += setVolume;
      }

      exerciseSummary.volumeKg = rounded(exerciseSummary.volumeKg);
      exercises.set(workoutExercise.exerciseId, exerciseSummary);
    }
  }

  return {
    sessionCount: sessions.length,
    exerciseCount: exercises.size,
    setCount,
    repCount,
    volumeKg: rounded(volumeKg),
    durationMinutes,
    exercises: [...exercises.values()],
  };
}

export function summarizeDay(sessions: WorkoutSession[], date = new Date()) {
  return summarizeSessions(sessions.filter((session) => session.endedAt && sameLocalDay(session.endedAt, date)));
}
