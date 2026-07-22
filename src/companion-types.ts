import type { WorkoutSession, WorkoutSummary } from "./workout-types";

export type CompanionStageKey = "initial" | "adaptation" | "growth" | "strength" | "mature" | "final";
export type CompanionMood = "ready" | "proud" | "resting" | "waiting" | "recovering";
export type CompanionInteractionFrequency = "low" | "standard" | "high";
export type WorkoutFeeling = "great" | "steady" | "tired" | "uncomfortable";
export type RecoveryFeeling = "recovered" | "mild_soreness" | "fatigued" | "pain";
export type WorkoutEndReason = "completed" | "early_stop";
export type WorkoutRuntimePhase = "idle" | "preparing" | "working" | "resting" | "paused" | "completed" | "aborted";
export type MotionFamily =
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "arm_isolation"
  | "dynamic_core"
  | "static_core"
  | "cardio"
  | "mobility";

export type CompanionMotionKey = MotionFamily | "idle" | "rest" | "celebrate" | "recover";

export interface CompanionStageDefinition {
  key: CompanionStageKey;
  name: string;
  description: string;
  minimumDays: number;
  minimumGrowth: number;
  minimumWorkouts: number;
  previewAsset: string | null;
  idleAsset: string | null;
  lockedPreviewAsset: string | null;
  motionAssets?: Partial<Record<CompanionMotionKey, string>>;
}

export interface CompanionDefinition {
  id: string;
  version: number;
  name: string;
  introduction: string;
  growthDirection: string;
  growthCycleDays: number;
  specialties: string[];
  personality: string[];
  stages: CompanionStageDefinition[];
  motionAssets: Partial<Record<CompanionMotionKey, string>>;
  interactionAssets: Record<string, string>;
  voiceAvailable: boolean;
}

export interface CompanionInstance {
  id: string;
  ownerUserId: string;
  definitionId: string;
  definitionVersion: number;
  displayName: string;
  createdAt: string;
  activatedAt: string | null;
  currentStage: CompanionStageKey;
  highestStage: CompanionStageKey;
  growthXp: number;
  bondXp: number;
  level: number;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CompanionSettings {
  textPromptsEnabled: boolean;
  interactionFrequency: CompanionInteractionFrequency;
  animationIntensity: number;
  reduceMotion: boolean;
  defaultRestSeconds: number;
  recoveryMode: boolean;
  updatedAt: string;
}

export interface WorkoutFeedback {
  id: string;
  ownerUserId: string;
  sessionId: string;
  rpe: number | null;
  feeling: WorkoutFeeling | null;
  recovery: RecoveryFeeling | null;
  recoveryRecordedAt: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export interface WorkoutRuntimeState {
  sessionId: string;
  workoutExerciseId: string | null;
  setId: string | null;
  motionFamily: MotionFamily | null;
  phase: WorkoutRuntimePhase;
  phaseStartedAt: string | null;
  restEndsAt: string | null;
  accumulatedActiveSeconds: number;
}

export interface GrowthBreakdown {
  completion: number;
  sets: number;
  duration: number;
  plan: number;
  newExercises: number;
  personalRecords: number;
  consistency: number;
  balance: number;
  recovery: number;
}

export interface CompanionGrowthEvent {
  id: string;
  ownerUserId: string;
  companionId: string;
  sourceType: "workout" | "weekly_balance" | "streak" | "recovery" | "adjustment";
  sourceId: string;
  ruleVersion: number;
  xpDelta: number;
  bondDelta: number;
  reason: string;
  breakdown: GrowthBreakdown | null;
  occurredAt: string;
  reversedAt: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CompanionMilestone {
  id: string;
  ownerUserId: string;
  companionId: string;
  kind: "created" | "first_workout" | "streak" | "workout_count" | "record" | "evolution" | "unlock";
  title: string;
  description: string;
  stage: CompanionStageKey;
  occurredAt: string;
  metadata: Record<string, unknown>;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CompanionUnlock {
  id: string;
  ownerUserId: string;
  companionId: string;
  unlockKey: string;
  unlockedAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CompanionProgress {
  companion: CompanionInstance;
  definition: CompanionDefinition | null;
  mood: CompanionMood;
  workoutCount: number;
  totalMinutes: number;
  sharedStreakDays: number;
  todayCompleted: boolean;
  currentStageIndex: number;
  nextStage: CompanionStageDefinition | null;
  stageProgress: number;
  remainingDays: number;
  remainingGrowth: number;
  remainingWorkouts: number;
  recentEvents: CompanionGrowthEvent[];
  recentMilestone: CompanionMilestone | null;
}

export interface WorkoutSettlementInput {
  session: WorkoutSession;
  summary: WorkoutSummary;
  effectiveDurationMinutes: number;
  planCompletionRate: number;
  newExerciseCount: number;
  personalRecordCount: number;
  bodyParts: string[];
  feedback: Pick<WorkoutFeedback, "rpe" | "feeling">;
  endedReason: WorkoutEndReason;
  occurredAt: string;
}

export interface CompanionSettlement {
  companion: CompanionInstance;
  growthEarned: number;
  bondEarned: number;
  breakdown: GrowthBreakdown;
  previousStage: CompanionStageKey;
  currentStage: CompanionStageKey;
  evolved: boolean;
  milestone: CompanionMilestone | null;
}

export interface CloudCompanionInstance {
  id: string;
  user_id: string;
  definition_id: string;
  definition_version: number;
  display_name: string;
  created_at: string;
  activated_at: string | null;
  current_stage: CompanionStageKey;
  highest_stage: CompanionStageKey;
  growth_xp: number;
  bond_xp: number;
  level: number;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CloudCompanionState {
  id: string;
  user_id: string;
  active_companion_id: string | null;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CloudCompanionSettings {
  id: string;
  user_id: string;
  text_prompts_enabled: boolean;
  interaction_frequency: CompanionInteractionFrequency;
  animation_intensity: number;
  reduce_motion: boolean;
  default_rest_seconds: number;
  recovery_mode: boolean;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CloudWorkoutFeedback {
  id: string;
  user_id: string;
  session_id: string;
  rpe: number | null;
  feeling: WorkoutFeeling | null;
  recovery: RecoveryFeeling | null;
  recovery_recorded_at: string | null;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CloudCompanionGrowthEvent {
  id: string;
  user_id: string;
  companion_id: string;
  source_type: CompanionGrowthEvent["sourceType"];
  source_id: string;
  rule_version: number;
  xp_delta: number;
  bond_delta: number;
  reason: string;
  breakdown: GrowthBreakdown | null;
  occurred_at: string;
  reversed_at: string | null;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CloudCompanionMilestone {
  id: string;
  user_id: string;
  companion_id: string;
  kind: CompanionMilestone["kind"];
  title: string;
  description: string;
  stage: CompanionStageKey;
  occurred_at: string;
  metadata: Record<string, unknown>;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CloudCompanionUnlock {
  id: string;
  user_id: string;
  companion_id: string;
  unlock_key: string;
  unlocked_at: string;
  client_updated_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface CompanionSyncBatch {
  instances: CloudCompanionInstance[];
  states: CloudCompanionState[];
  settings: CloudCompanionSettings[];
  feedback: CloudWorkoutFeedback[];
  growthEvents: CloudCompanionGrowthEvent[];
  milestones: CloudCompanionMilestone[];
  unlocks: CloudCompanionUnlock[];
}

export type CompanionSyncEntityType = "companion" | "companion_state" | "companion_settings" | "workout_feedback" | "growth_event" | "milestone" | "unlock";

export interface CompanionRepository {
  readonly mode: "sqlite" | "browser-preview";
  readonly userId: string;
  listInstances(): Promise<CompanionInstance[]>;
  getActiveInstance(): Promise<CompanionInstance | null>;
  createInstance(definition: CompanionDefinition, displayName: string): Promise<CompanionInstance>;
  switchActive(companionId: string): Promise<void>;
  deleteInstance(companionId: string): Promise<void>;
  getSettings(): Promise<CompanionSettings>;
  saveSettings(settings: CompanionSettings): Promise<CompanionSettings>;
  getFeedback(sessionId: string): Promise<WorkoutFeedback | null>;
  saveFeedback(sessionId: string, feedback: Pick<WorkoutFeedback, "rpe" | "feeling" | "recovery">): Promise<WorkoutFeedback>;
  saveRecovery(sessionId: string, recovery: RecoveryFeeling): Promise<WorkoutFeedback>;
  settleWorkout(companionId: string, definition: CompanionDefinition, input: WorkoutSettlementInput): Promise<CompanionSettlement>;
  reverseWorkoutGrowth(sessionId: string): Promise<void>;
  getProgress(companionId: string, definition: CompanionDefinition | null, sessions: WorkoutSession[]): Promise<CompanionProgress>;
  listGrowthEvents(companionId: string, limit?: number): Promise<CompanionGrowthEvent[]>;
  listMilestones(companionId: string): Promise<CompanionMilestone[]>;
  getRuntimeState(sessionId: string): Promise<WorkoutRuntimeState | null>;
  saveRuntimeState(state: WorkoutRuntimeState): Promise<void>;
  clearRuntimeState(sessionId: string): Promise<void>;
  getSyncBatch(): Promise<CompanionSyncBatch>;
  markSynced(entityType: CompanionSyncEntityType, records: Array<{ id: string; client_updated_at: string }>): Promise<void>;
  applyRemote(batch: CompanionSyncBatch): Promise<void>;
  clearUserData(): Promise<void>;
}
