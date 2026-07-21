export type AppView = "library" | "today" | "history";
export type WorkoutSessionStatus = "active" | "completed" | "archived";
export type SyncStatus = "idle" | "syncing" | "offline" | "error" | "conflict";
export type SyncEntityType = "session" | "exercise" | "set";

export interface WorkoutSet {
  id: string;
  position: number;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  completedAt: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  position: number;
  sets: WorkoutSet[];
  updatedAt: string;
  deletedAt: string | null;
}

export interface WorkoutSession {
  id: string;
  ownerUserId: string;
  startedAt: string;
  endedAt: string | null;
  status: WorkoutSessionStatus;
  deviceId: string | null;
  updatedAt: string;
  deletedAt: string | null;
  exercises: WorkoutExercise[];
}

export interface CloudWorkoutSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  status: WorkoutSessionStatus;
  device_id: string | null;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CloudWorkoutExercise {
  id: string;
  user_id: string;
  session_id: string;
  exercise_id: string;
  position: number;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CloudWorkoutSet {
  id: string;
  user_id: string;
  workout_exercise_id: string;
  position: number;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
  completed_at: string | null;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface SyncBatch {
  sessions: CloudWorkoutSession[];
  exercises: CloudWorkoutExercise[];
  sets: CloudWorkoutSet[];
}

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  error?: string;
  conflicts: WorkoutSession[];
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
  readonly userId: string;
  readonly deviceId: string;
  claimLegacyData(): Promise<void>;
  getActiveSession(): Promise<WorkoutSession | null>;
  listActiveSessions(): Promise<WorkoutSession[]>;
  addExercise(exerciseId: string): Promise<AddExerciseResult>;
  removeExercise(workoutExerciseId: string): Promise<void>;
  addSet(workoutExerciseId: string): Promise<void>;
  deleteSet(setId: string): Promise<void>;
  saveSets(sets: WorkoutSet[]): Promise<void>;
  completeSession(sessionId: string, endedAt: string): Promise<void>;
  listHistory(limit?: number): Promise<WorkoutSession[]>;
  getSyncBatch(): Promise<SyncBatch>;
  markSynced(entityType: SyncEntityType, records: Array<{ id: string; client_updated_at: string }>): Promise<void>;
  getPendingCount(): Promise<number>;
  getLastPulledAt(): Promise<string | null>;
  applyRemote(batch: SyncBatch): Promise<void>;
  setLastSyncedAt(remoteCursor: string | null, syncedAt: string): Promise<void>;
  resolveActiveConflict(keepSessionId: string): Promise<void>;
  clearUserData(): Promise<void>;
}
