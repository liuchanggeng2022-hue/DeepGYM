import { DEFAULT_COMPANION_STAGES } from "./companion-catalog";
import type {
  CompanionDefinition,
  CompanionGrowthEvent,
  CompanionInstance,
  CompanionMood,
  CompanionStageDefinition,
  CompanionStageKey,
  GrowthBreakdown,
  MotionFamily,
  WorkoutSettlementInput,
} from "./companion-types";
import type { IndexedExercise } from "./types";
import type { WorkoutSession } from "./workout-types";

export const COMPANION_RULE_VERSION = 1;
export const DAILY_GROWTH_CAP = 120;
export const WEEKLY_GROWTH_CAP = 420;

export function stageDefinitions(definition: CompanionDefinition | null) {
  return definition?.stages.length ? definition.stages : DEFAULT_COMPANION_STAGES;
}

export function stageIndex(stage: CompanionStageKey, stages: CompanionStageDefinition[] = DEFAULT_COMPANION_STAGES) {
  const index = stages.findIndex((item) => item.key === stage);
  return Math.max(index, 0);
}

export function elapsedDays(createdAt: string, at: string) {
  return Math.max(0, Math.floor((new Date(at).getTime() - new Date(createdAt).getTime()) / 86_400_000));
}

export function calculateWorkoutGrowth(input: WorkoutSettlementInput): { total: number; bond: number; breakdown: GrowthBreakdown } {
  const completedSets = input.summary.setCount;
  const completedWorkout = input.endedReason === "completed" && completedSets > 0;
  const breakdown: GrowthBreakdown = {
    completion: completedWorkout ? 30 : 0,
    sets: Math.min(completedSets * 2, 40),
    duration: Math.min(Math.floor(Math.max(0, input.effectiveDurationMinutes) / 5), 18),
    plan: completedWorkout && input.planCompletionRate >= 0.8 ? 15 : 0,
    newExercises: Math.min(Math.max(0, input.newExerciseCount) * 5, 10),
    personalRecords: Math.min(Math.max(0, input.personalRecordCount) * 10, 20),
    consistency: 0,
    balance: 0,
    recovery: 0,
  };
  const raw = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { total: Math.min(raw, DAILY_GROWTH_CAP), bond: completedSets > 0 ? 8 + Math.min(completedSets, 12) : 0, breakdown };
}

export function nextEligibleStage(
  instance: CompanionInstance,
  stages: CompanionStageDefinition[],
  workoutCount: number,
  at: string,
) {
  const currentIndex = stageIndex(instance.highestStage, stages);
  const candidate = stages[currentIndex + 1] || null;
  if (!candidate) return null;
  const eligible = elapsedDays(instance.createdAt, at) >= candidate.minimumDays
    && instance.growthXp >= candidate.minimumGrowth
    && workoutCount >= candidate.minimumWorkouts;
  return eligible ? candidate : null;
}

export function stageProgress(
  instance: CompanionInstance,
  next: CompanionStageDefinition | null,
  workoutCount: number,
  at = new Date().toISOString(),
) {
  if (!next) return 1;
  const daysRatio = next.minimumDays ? elapsedDays(instance.createdAt, at) / next.minimumDays : 1;
  const growthRatio = next.minimumGrowth ? instance.growthXp / next.minimumGrowth : 1;
  const workoutRatio = next.minimumWorkouts ? workoutCount / next.minimumWorkouts : 1;
  return Math.max(0, Math.min(1, Math.min(daysRatio, growthRatio, workoutRatio)));
}

export function companionMood(instance: CompanionInstance, sessions: WorkoutSession[], recoveryMode: boolean, now = new Date()) : CompanionMood {
  if (recoveryMode) return "recovering";
  const latest = sessions
    .filter((session) => session.status === "completed" && !session.deletedAt && session.endedAt && session.endedAt >= instance.createdAt)
    .sort((a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime())[0];
  if (!latest?.endedAt) return "ready";
  const elapsed = now.getTime() - new Date(latest.endedAt).getTime();
  if (elapsed < 24 * 60 * 60 * 1000) return "proud";
  if (elapsed < 72 * 60 * 60 * 1000) return "resting";
  return "waiting";
}

export function motionFamilyForExercise(exercise: IndexedExercise | undefined): MotionFamily {
  if (!exercise) return "mobility";
  const source = `${exercise.name} ${exercise.category} ${exercise.body_part} ${exercise.target}`.toLowerCase();
  if (/stretch|mobility|roll|rotation|warm/.test(source)) return "mobility";
  if (/cardio|run|walk|jump|burpee|climber|rope/.test(source)) return "cardio";
  if (/plank|hold|bridge/.test(source)) return "static_core";
  if (/crunch|sit-up|twist|raise/.test(source) && exercise.body_part === "waist") return "dynamic_core";
  if (/lunge|split squat|step-up/.test(source)) return "lunge";
  if (/deadlift|romanian|good morning|hip thrust|pull-through/.test(source)) return "hinge";
  if (/squat|leg press/.test(source)) return "squat";
  if (/pull-up|pulldown|chin-up/.test(source)) return "vertical_pull";
  if (/row|rear delt/.test(source)) return "horizontal_pull";
  if (/overhead press|shoulder press|military press|handstand/.test(source)) return "vertical_push";
  if (/bench press|chest press|push-up|fly/.test(source)) return "horizontal_push";
  if (/curl|extension|pushdown|kickback|raise/.test(source)) return "arm_isolation";
  if (exercise.body_part === "back") return "horizontal_pull";
  if (exercise.body_part === "chest") return "horizontal_push";
  if (exercise.body_part === "upper legs" || exercise.body_part === "lower legs") return "squat";
  if (exercise.body_part === "waist") return "dynamic_core";
  return "arm_isolation";
}

export function activeWorkoutCount(events: CompanionGrowthEvent[]) {
  return new Set(events.filter((event) => event.sourceType === "workout" && !event.reversedAt && event.xpDelta > 0).map((event) => event.sourceId)).size;
}

export function stageName(key: CompanionStageKey, definition: CompanionDefinition | null) {
  return stageDefinitions(definition).find((stage) => stage.key === key)?.name || "初始期";
}
