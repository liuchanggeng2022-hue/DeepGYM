export type AppView = "library" | "today" | "history";

export interface WorkoutSet {
  id: string;
  position: number;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  completedAt: string | null;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  position: number;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  exercises: WorkoutExercise[];
}

export interface ExerciseSummary {
  exerciseId: string;
  setCount: number;
  repCount: number;
  volumeKg: number;
}

export interface WorkoutSummary {
  sessionCount: number;
  exerciseCount: number;
  setCount: number;
  repCount: number;
  volumeKg: number;
  durationMinutes: number;
  exercises: ExerciseSummary[];
}

export interface AddExerciseResult {
  session: WorkoutSession;
  alreadyPresent: boolean;
}

export interface WorkoutRepository {
  readonly mode: "sqlite" | "browser-preview";
  getActiveSession(): Promise<WorkoutSession | null>;
  addExercise(exerciseId: string): Promise<AddExerciseResult>;
  removeExercise(workoutExerciseId: string): Promise<void>;
  addSet(workoutExerciseId: string): Promise<void>;
  deleteSet(setId: string): Promise<void>;
  saveSets(sets: WorkoutSet[]): Promise<void>;
  completeSession(sessionId: string, endedAt: string): Promise<void>;
  listHistory(limit?: number): Promise<WorkoutSession[]>;
}
