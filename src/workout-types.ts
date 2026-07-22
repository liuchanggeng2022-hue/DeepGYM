import type { WorkoutEndReason } from "./companion-types";

export type AppView = "library" | "training" | "partner" | "account";
export type TrainingSection = "plan" | "record" | "data";
export type WorkoutSessionStatus = "active" | "completed" | "archived";
export type SyncStatus = "idle" | "syncing" | "offline" | "error" | "conflict";
export type SyncEntityType = "session" | "exercise" | "set" | "plan" | "plan_day" | "plan_exercise" | "plan_state";

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
  targetRepsMin: number | null;
  targetRepsMax: number | null;
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
  sourcePlanDayId: string | null;
  companionInstanceId: string | null;
  activeDurationSeconds: number;
  endReason: WorkoutEndReason | null;
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
  source_plan_day_id: string | null;
  companion_instance_id: string | null;
  active_duration_seconds: number;
  end_reason: WorkoutEndReason | null;
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
  target_reps_min: number | null;
  target_reps_max: number | null;
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

export interface PlannedExercise {
  id: string;
  exerciseId: string;
  position: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TrainingPlanDay {
  id: string;
  weekday: number;
  title: string;
  position: number;
  exercises: PlannedExercise[];
  updatedAt: string;
  deletedAt: string | null;
}

export interface TrainingPlan {
  id: string;
  ownerUserId: string;
  name: string;
  days: TrainingPlanDay[];
  updatedAt: string;
  deletedAt: string | null;
}

export interface TrainingPlanInput {
  id?: string;
  name: string;
  days: Array<{
    id?: string;
    weekday: number;
    title: string;
    position: number;
    exercises: Array<{
      id?: string;
      exerciseId: string;
      position: number;
      targetSets: number;
      targetRepsMin: number;
      targetRepsMax: number;
    }>;
  }>;
}

export interface TrainingPlanState {
  activePlanId: string | null;
  updatedAt: string;
}

export interface CloudTrainingPlan {
  id: string;
  user_id: string;
  name: string;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CloudTrainingPlanDay {
  id: string;
  user_id: string;
  plan_id: string;
  weekday: number;
  title: string;
  position: number;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CloudPlannedExercise {
  id: string;
  user_id: string;
  plan_day_id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  target_reps_min: number;
  target_reps_max: number;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CloudTrainingPlanState {
  id: string;
  user_id: string;
  active_plan_id: string | null;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface SyncBatch {
  sessions: CloudWorkoutSession[];
  exercises: CloudWorkoutExercise[];
  sets: CloudWorkoutSet[];
  plans: CloudTrainingPlan[];
  planDays: CloudTrainingPlanDay[];
  planExercises: CloudPlannedExercise[];
  planStates: CloudTrainingPlanState[];
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
  attachCompanion(sessionId: string, companionId: string): Promise<WorkoutSession>;
  completeSession(sessionId: string, endedAt: string, options?: {
    endReason?: WorkoutEndReason;
    activeDurationSeconds?: number;
    companionInstanceId?: string | null;
  }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listHistory(limit?: number): Promise<WorkoutSession[]>;
  listCompletedSessionsBetween(startAt: string, endAt: string): Promise<WorkoutSession[]>;
  listTrainingPlans(): Promise<TrainingPlan[]>;
  getTrainingPlanState(): Promise<TrainingPlanState>;
  saveTrainingPlan(input: TrainingPlanInput): Promise<TrainingPlan>;
  duplicateTrainingPlan(planId: string): Promise<TrainingPlan>;
  deleteTrainingPlan(planId: string): Promise<void>;
  setActiveTrainingPlan(planId: string | null): Promise<void>;
  startPlannedWorkout(planDayId: string): Promise<WorkoutSession>;
  getSyncBatch(): Promise<SyncBatch>;
  markSynced(entityType: SyncEntityType, records: Array<{ id: string; client_updated_at: string }>): Promise<void>;
  getPendingCount(): Promise<number>;
  getLastPulledAt(): Promise<string | null>;
  applyRemote(batch: SyncBatch): Promise<void>;
  setLastSyncedAt(remoteCursor: string | null, syncedAt: string): Promise<void>;
  resolveActiveConflict(keepSessionId: string): Promise<void>;
  clearUserData(): Promise<void>;
}
