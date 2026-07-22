import type Database from "@tauri-apps/plugin-sql";
import { COMPANION_CATALOG } from "./companion-catalog";
import {
  activeWorkoutCount,
  calculateWorkoutGrowth,
  companionMood,
  COMPANION_RULE_VERSION,
  DAILY_GROWTH_CAP,
  elapsedDays,
  nextEligibleStage,
  stageDefinitions,
  stageIndex,
  stageProgress,
  WEEKLY_GROWTH_CAP,
} from "./companion-growth";
import type {
  CloudCompanionGrowthEvent,
  CloudCompanionInstance,
  CloudCompanionMilestone,
  CloudCompanionSettings,
  CloudCompanionState,
  CloudCompanionUnlock,
  CloudWorkoutFeedback,
  CompanionDefinition,
  CompanionGrowthEvent,
  CompanionInstance,
  CompanionMilestone,
  CompanionProgress,
  CompanionRepository,
  CompanionSettings,
  CompanionSettlement,
  CompanionSyncBatch,
  CompanionSyncEntityType,
  CompanionUnlock,
  RecoveryFeeling,
  WorkoutFeedback,
  WorkoutRuntimeState,
  WorkoutSettlementInput,
} from "./companion-types";
import type { WorkoutSession } from "./workout-types";

const DATABASE_URL = "sqlite:deepgym.db";
const BROWSER_STORAGE_PREFIX = "deepgym.companions.v1";

type InstanceRow = {
  id: string;
  owner_user_id: string;
  definition_id: string;
  definition_version: number;
  display_name: string;
  created_at: string;
  activated_at: string | null;
  current_stage: CompanionInstance["currentStage"];
  highest_stage: CompanionInstance["highestStage"];
  growth_xp: number;
  bond_xp: number;
  level: number;
  updated_at: string;
  deleted_at: string | null;
};

type GrowthRow = {
  id: string;
  owner_user_id: string;
  companion_id: string;
  source_type: CompanionGrowthEvent["sourceType"];
  source_id: string;
  rule_version: number;
  xp_delta: number;
  bond_delta: number;
  reason: string;
  breakdown_json: string | null;
  occurred_at: string;
  reversed_at: string | null;
  updated_at: string;
  deleted_at: string | null;
};

type MilestoneRow = {
  id: string;
  owner_user_id: string;
  companion_id: string;
  kind: CompanionMilestone["kind"];
  title: string;
  description: string;
  stage: CompanionMilestone["stage"];
  occurred_at: string;
  metadata_json: string;
  updated_at: string;
  deleted_at: string | null;
};

interface BrowserCompanionStore {
  instances: CompanionInstance[];
  activeId: string | null;
  settings: CompanionSettings;
  feedback: WorkoutFeedback[];
  events: CompanionGrowthEvent[];
  milestones: CompanionMilestone[];
  unlocks: CompanionUnlock[];
  runtimes: WorkoutRuntimeState[];
}

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  const random = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function defaultSettings(updatedAt = now()): CompanionSettings {
  return {
    textPromptsEnabled: true,
    interactionFrequency: "standard",
    animationIntensity: 2,
    reduceMotion: false,
    defaultRestSeconds: 90,
    recoveryMode: false,
    updatedAt,
  };
}

function instanceFromRow(row: InstanceRow): CompanionInstance {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    definitionId: row.definition_id,
    definitionVersion: row.definition_version,
    displayName: row.display_name,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    currentStage: row.current_stage,
    highestStage: row.highest_stage,
    growthXp: row.growth_xp,
    bondXp: row.bond_xp,
    level: row.level,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function growthFromRow(row: GrowthRow): CompanionGrowthEvent {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    companionId: row.companion_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    ruleVersion: row.rule_version,
    xpDelta: row.xp_delta,
    bondDelta: row.bond_delta,
    reason: row.reason,
    breakdown: parseJson(row.breakdown_json, null),
    occurredAt: row.occurred_at,
    reversedAt: row.reversed_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function milestoneFromRow(row: MilestoneRow): CompanionMilestone {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    companionId: row.companion_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    stage: row.stage,
    occurredAt: row.occurred_at,
    metadata: parseJson(row.metadata_json, {}),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function localDay(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localWeek(value: string) {
  const date = new Date(value);
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  return localDay(copy.toISOString());
}

function calculateStreak(sessions: WorkoutSession[], companion: CompanionInstance) {
  const dates = [...new Set(sessions
    .filter((session) => session.status === "completed" && !session.deletedAt && session.endedAt
      && session.companionInstanceId === companion.id && session.endedAt >= companion.createdAt)
    .map((session) => localDay(session.endedAt!)))]
    .sort((a, b) => b.localeCompare(a));
  if (!dates.length) return 0;
  let streak = 1;
  let cursor = new Date(`${dates[0]}T12:00:00`);
  for (const date of dates.slice(1)) {
    cursor.setDate(cursor.getDate() - 1);
    if (localDay(cursor.toISOString()) !== date) break;
    streak += 1;
  }
  return streak;
}

function progressFromData(
  companion: CompanionInstance,
  definition: CompanionDefinition | null,
  sessions: WorkoutSession[],
  events: CompanionGrowthEvent[],
  milestones: CompanionMilestone[],
  settings: CompanionSettings,
): CompanionProgress {
  const stages = stageDefinitions(definition);
  const workouts = activeWorkoutCount(events);
  const currentIndex = stageIndex(companion.currentStage, stages);
  const next = stages[currentIndex + 1] || null;
  const elapsed = elapsedDays(companion.createdAt, now());
  const today = localDay(now());
  const sharedSessions = sessions.filter((session) => session.status === "completed" && !session.deletedAt
    && session.companionInstanceId === companion.id && session.endedAt && session.endedAt >= companion.createdAt);
  return {
    companion,
    definition,
    mood: companionMood(companion, sharedSessions, settings.recoveryMode),
    workoutCount: workouts,
    totalMinutes: Math.round(sharedSessions.reduce((sum, session) => sum + Math.max(0, session.activeDurationSeconds || 0), 0) / 60),
    sharedStreakDays: calculateStreak(sharedSessions, companion),
    todayCompleted: sharedSessions.some((session) => session.endedAt && localDay(session.endedAt) === today),
    currentStageIndex: currentIndex,
    nextStage: next,
    stageProgress: stageProgress(companion, next, workouts),
    remainingDays: next ? Math.max(0, next.minimumDays - elapsed) : 0,
    remainingGrowth: next ? Math.max(0, next.minimumGrowth - companion.growthXp) : 0,
    remainingWorkouts: next ? Math.max(0, next.minimumWorkouts - workouts) : 0,
    recentEvents: events.filter((event) => !event.deletedAt && !event.reversedAt).slice(0, 5),
    recentMilestone: milestones.filter((item) => !item.deletedAt)[0] || null,
  };
}

class SqliteCompanionRepository implements CompanionRepository {
  readonly mode = "sqlite" as const;

  constructor(private readonly db: Database, readonly userId: string) {}

  async listInstances() {
    const rows = await this.db.select<InstanceRow[]>(
      "SELECT * FROM companion_instance WHERE owner_user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
      [this.userId],
    );
    return rows.map(instanceFromRow);
  }

  async getActiveInstance() {
    const rows = await this.db.select<InstanceRow[]>(
      `SELECT ci.* FROM companion_state cs
       JOIN companion_instance ci ON ci.id = cs.active_companion_id AND ci.owner_user_id = cs.owner_user_id
       WHERE cs.owner_user_id = $1 AND cs.deleted_at IS NULL AND ci.deleted_at IS NULL LIMIT 1`,
      [this.userId],
    );
    return rows[0] ? instanceFromRow(rows[0]) : null;
  }

  async createInstance(definition: CompanionDefinition, displayName: string) {
    const name = displayName.trim();
    if (!name || name.length > 24) throw new Error("搭档名称需要填写，且不能超过 24 个字符。");
    const timestamp = now();
    const instance: CompanionInstance = {
      id: createId("companion"),
      ownerUserId: this.userId,
      definitionId: definition.id,
      definitionVersion: definition.version,
      displayName: name,
      createdAt: timestamp,
      activatedAt: timestamp,
      currentStage: "initial",
      highestStage: "initial",
      growthXp: 0,
      bondXp: 0,
      level: 1,
      updatedAt: timestamp,
      deletedAt: null,
    };
    await this.db.execute(
      `INSERT INTO companion_instance
       (id, owner_user_id, definition_id, definition_version, display_name, created_at, activated_at,
        current_stage, highest_stage, growth_xp, bond_xp, level, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6, 'initial', 'initial', 0, 0, 1, $6, NULL)`,
      [instance.id, this.userId, definition.id, definition.version, name, timestamp],
    );
    await this.db.execute(
      `INSERT INTO companion_state (owner_user_id, active_companion_id, updated_at, deleted_at)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT(owner_user_id) DO UPDATE SET active_companion_id = excluded.active_companion_id,
         updated_at = excluded.updated_at, deleted_at = NULL`,
      [this.userId, instance.id, timestamp],
    );
    await this.insertMilestone({
      id: `milestone:${instance.id}:created`, ownerUserId: this.userId, companionId: instance.id,
      kind: "created", title: "我们成为了搭档", description: `${name} 从今天开始和你一起训练。`,
      stage: "initial", occurredAt: timestamp, metadata: {}, updatedAt: timestamp, deletedAt: null,
    });
    return instance;
  }

  async switchActive(companionId: string) {
    const candidates = await this.db.select<Array<{ count: number }>>(
      "SELECT COUNT(*) AS count FROM companion_instance WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL",
      [companionId, this.userId],
    );
    if (!candidates[0]?.count) throw new Error("没有找到要切换的搭档。");
    const timestamp = now();
    await this.db.execute(
      "UPDATE companion_instance SET activated_at = $1, updated_at = $1 WHERE id = $2 AND owner_user_id = $3",
      [timestamp, companionId, this.userId],
    );
    await this.db.execute(
      `INSERT INTO companion_state (owner_user_id, active_companion_id, updated_at, deleted_at)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT(owner_user_id) DO UPDATE SET active_companion_id = excluded.active_companion_id,
         updated_at = excluded.updated_at, deleted_at = NULL`,
      [this.userId, companionId, timestamp],
    );
  }

  async deleteInstance(companionId: string) {
    const timestamp = now();
    await this.db.execute(
      "UPDATE companion_instance SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND owner_user_id = $3",
      [timestamp, companionId, this.userId],
    );
    await this.db.execute(
      "UPDATE companion_state SET active_companion_id = NULL, updated_at = $1 WHERE owner_user_id = $2 AND active_companion_id = $3",
      [timestamp, this.userId, companionId],
    );
  }

  async getSettings() {
    const rows = await this.db.select<Array<{
      text_prompts_enabled: number; interaction_frequency: CompanionSettings["interactionFrequency"];
      animation_intensity: number; reduce_motion: number; default_rest_seconds: number; recovery_mode: number; updated_at: string;
    }>>("SELECT * FROM companion_settings WHERE owner_user_id = $1 AND deleted_at IS NULL", [this.userId]);
    if (!rows[0]) {
      const settings = defaultSettings();
      return this.saveSettings(settings);
    }
    return {
      textPromptsEnabled: rows[0].text_prompts_enabled === 1,
      interactionFrequency: rows[0].interaction_frequency,
      animationIntensity: rows[0].animation_intensity,
      reduceMotion: rows[0].reduce_motion === 1,
      defaultRestSeconds: rows[0].default_rest_seconds,
      recoveryMode: rows[0].recovery_mode === 1,
      updatedAt: rows[0].updated_at,
    };
  }

  async saveSettings(settings: CompanionSettings) {
    const timestamp = now();
    const value = { ...settings, defaultRestSeconds: Math.min(600, Math.max(15, Math.round(settings.defaultRestSeconds))), updatedAt: timestamp };
    await this.db.execute(
      `INSERT INTO companion_settings
       (owner_user_id, text_prompts_enabled, interaction_frequency, animation_intensity, reduce_motion,
        default_rest_seconds, recovery_mode, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
       ON CONFLICT(owner_user_id) DO UPDATE SET text_prompts_enabled = excluded.text_prompts_enabled,
         interaction_frequency = excluded.interaction_frequency, animation_intensity = excluded.animation_intensity,
         reduce_motion = excluded.reduce_motion, default_rest_seconds = excluded.default_rest_seconds,
         recovery_mode = excluded.recovery_mode, updated_at = excluded.updated_at, deleted_at = NULL`,
      [this.userId, value.textPromptsEnabled ? 1 : 0, value.interactionFrequency, value.animationIntensity,
        value.reduceMotion ? 1 : 0, value.defaultRestSeconds, value.recoveryMode ? 1 : 0, timestamp],
    );
    return value;
  }

  async getFeedback(sessionId: string) {
    const rows = await this.db.select<Array<{
      id: string; owner_user_id: string; session_id: string; rpe: number | null; feeling: WorkoutFeedback["feeling"];
      recovery: WorkoutFeedback["recovery"]; recovery_recorded_at: string | null; updated_at: string; deleted_at: string | null;
    }>>("SELECT * FROM workout_feedback WHERE owner_user_id = $1 AND session_id = $2 AND deleted_at IS NULL", [this.userId, sessionId]);
    const row = rows[0];
    return row ? {
      id: row.id, ownerUserId: row.owner_user_id, sessionId: row.session_id, rpe: row.rpe, feeling: row.feeling,
      recovery: row.recovery, recoveryRecordedAt: row.recovery_recorded_at, updatedAt: row.updated_at, deletedAt: row.deleted_at,
    } : null;
  }

  async saveFeedback(sessionId: string, feedback: Pick<WorkoutFeedback, "rpe" | "feeling" | "recovery">) {
    if (feedback.rpe !== null && (feedback.rpe < 1 || feedback.rpe > 10)) throw new Error("训练强度需要在 1–10 之间。");
    const existing = await this.getFeedback(sessionId);
    const timestamp = now();
    const id = existing?.id || `feedback:${sessionId}`;
    await this.db.execute(
      `INSERT INTO workout_feedback
       (id, owner_user_id, session_id, rpe, feeling, recovery, recovery_recorded_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
       ON CONFLICT(id) DO UPDATE SET rpe = excluded.rpe, feeling = excluded.feeling,
         recovery = COALESCE(excluded.recovery, workout_feedback.recovery),
         recovery_recorded_at = COALESCE(excluded.recovery_recorded_at, workout_feedback.recovery_recorded_at),
         updated_at = excluded.updated_at, deleted_at = NULL`,
      [id, this.userId, sessionId, feedback.rpe, feedback.feeling, feedback.recovery,
        feedback.recovery ? timestamp : existing?.recoveryRecordedAt || null, timestamp],
    );
    return (await this.getFeedback(sessionId))!;
  }

  async saveRecovery(sessionId: string, recovery: RecoveryFeeling) {
    const existing = await this.getFeedback(sessionId);
    return this.saveFeedback(sessionId, { rpe: existing?.rpe || null, feeling: existing?.feeling || null, recovery });
  }

  async settleWorkout(companionId: string, definition: CompanionDefinition, input: WorkoutSettlementInput): Promise<CompanionSettlement> {
    const instances = await this.listInstances();
    const companion = instances.find((item) => item.id === companionId);
    if (!companion) throw new Error("没有找到本次训练的搭档。");
    const timestamp = now();
    const calculated = calculateWorkoutGrowth(input);
    const allEvents = await this.listAllGrowthEvents(companionId);
    const eventId = `growth:${companionId}:workout:${input.session.id}:v${COMPANION_RULE_VERSION}`;
    const previous = allEvents.find((event) => event.id === eventId && !event.reversedAt && !event.deletedAt);
    const dayUsed = allEvents.filter((event) => event.id !== eventId && !event.reversedAt && !event.deletedAt
      && localDay(event.occurredAt) === localDay(input.occurredAt)).reduce((sum, event) => sum + Math.max(0, event.xpDelta), 0);
    const weekUsed = allEvents.filter((event) => event.id !== eventId && !event.reversedAt && !event.deletedAt
      && localWeek(event.occurredAt) === localWeek(input.occurredAt)).reduce((sum, event) => sum + Math.max(0, event.xpDelta), 0);
    const awarded = Math.max(0, Math.min(calculated.total, DAILY_GROWTH_CAP - dayUsed, WEEKLY_GROWTH_CAP - weekUsed));
    const growthEvent: CompanionGrowthEvent = {
      id: eventId, ownerUserId: this.userId, companionId, sourceType: "workout", sourceId: input.session.id,
      ruleVersion: COMPANION_RULE_VERSION, xpDelta: awarded, bondDelta: calculated.bond,
      reason: input.endedReason === "completed" ? "完成共同训练" : "完成部分训练",
      breakdown: calculated.breakdown, occurredAt: input.occurredAt, reversedAt: null, updatedAt: timestamp, deletedAt: null,
    };
    await this.db.execute(
      `INSERT INTO companion_growth_event
       (id, owner_user_id, companion_id, source_type, source_id, rule_version, xp_delta, bond_delta,
        reason, breakdown_json, occurred_at, reversed_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, 'workout', $4, $5, $6, $7, $8, $9, $10, NULL, $11, NULL)
       ON CONFLICT(id) DO UPDATE SET xp_delta = excluded.xp_delta, bond_delta = excluded.bond_delta,
         reason = excluded.reason, breakdown_json = excluded.breakdown_json, occurred_at = excluded.occurred_at,
         reversed_at = NULL, updated_at = excluded.updated_at, deleted_at = NULL`,
      [eventId, this.userId, companionId, input.session.id, COMPANION_RULE_VERSION, awarded, calculated.bond,
        growthEvent.reason, JSON.stringify(calculated.breakdown), input.occurredAt, timestamp],
    );
    const events = allEvents.filter((event) => event.id !== eventId).concat(growthEvent);
    const totalGrowth = Math.max(0, events.filter((event) => !event.reversedAt && !event.deletedAt).reduce((sum, event) => sum + event.xpDelta, 0));
    const totalBond = Math.max(0, events.filter((event) => !event.reversedAt && !event.deletedAt).reduce((sum, event) => sum + event.bondDelta, 0));
    const workouts = activeWorkoutCount(events);
    const previousStage = companion.currentStage;
    const projection = { ...companion, growthXp: totalGrowth, bondXp: totalBond };
    const next = nextEligibleStage(projection, stageDefinitions(definition), workouts, input.occurredAt);
    const currentStage = next?.key || companion.highestStage;
    const evolved = stageIndex(currentStage, stageDefinitions(definition)) > stageIndex(companion.highestStage, stageDefinitions(definition));
    await this.db.execute(
      `UPDATE companion_instance SET current_stage = $1, highest_stage = $1, growth_xp = $2,
       bond_xp = $3, level = $4, updated_at = $5 WHERE id = $6 AND owner_user_id = $7 AND deleted_at IS NULL`,
      [currentStage, totalGrowth, totalBond, 1 + Math.floor(totalBond / 100), timestamp, companionId, this.userId],
    );
    let milestone: CompanionMilestone | null = null;
    if (workouts === 1 && !previous) {
      milestone = {
        id: `milestone:${companionId}:first-workout`, ownerUserId: this.userId, companionId,
        kind: "first_workout", title: "第一次共同训练", description: "你们完成了第一段共同成长记录。",
        stage: currentStage, occurredAt: input.occurredAt, metadata: { sessionId: input.session.id }, updatedAt: timestamp, deletedAt: null,
      };
      await this.insertMilestone(milestone);
    }
    if (evolved) {
      milestone = {
        id: `milestone:${companionId}:stage:${currentStage}`, ownerUserId: this.userId, companionId,
        kind: "evolution", title: `进入${next!.name}`, description: next!.description,
        stage: currentStage, occurredAt: input.occurredAt, metadata: { growthXp: totalGrowth, workoutCount: workouts }, updatedAt: timestamp, deletedAt: null,
      };
      await this.insertMilestone(milestone);
    }
    const updated = (await this.listInstances()).find((item) => item.id === companionId)!;
    return { companion: updated, growthEarned: awarded, bondEarned: calculated.bond, breakdown: calculated.breakdown,
      previousStage, currentStage, evolved, milestone };
  }

  async getProgress(companionId: string, definition: CompanionDefinition | null, sessions: WorkoutSession[]) {
    const companion = (await this.listInstances()).find((item) => item.id === companionId);
    if (!companion) throw new Error("没有找到搭档。");
    const [events, milestones, settings] = await Promise.all([
      this.listGrowthEvents(companionId, 1000), this.listMilestones(companionId), this.getSettings(),
    ]);
    return progressFromData(companion, definition, sessions, events, milestones, settings);
  }

  async reverseWorkoutGrowth(sessionId: string) {
    const timestamp = now();
    await this.db.execute(
      `UPDATE companion_growth_event SET reversed_at = $1, updated_at = $1
       WHERE owner_user_id = $2 AND source_type = 'workout' AND source_id = $3 AND reversed_at IS NULL AND deleted_at IS NULL`,
      [timestamp, this.userId, sessionId],
    );
    await this.recalculateInstances();
  }

  async listGrowthEvents(companionId: string, limit = 50) {
    const rows = await this.db.select<GrowthRow[]>(
      `SELECT * FROM companion_growth_event WHERE owner_user_id = $1 AND companion_id = $2 AND deleted_at IS NULL
       ORDER BY occurred_at DESC LIMIT $3`, [this.userId, companionId, limit],
    );
    return rows.map(growthFromRow);
  }

  private async listAllGrowthEvents(companionId: string) {
    return this.listGrowthEvents(companionId, 10000);
  }

  async listMilestones(companionId: string) {
    const rows = await this.db.select<MilestoneRow[]>(
      `SELECT * FROM companion_milestone WHERE owner_user_id = $1 AND companion_id = $2 AND deleted_at IS NULL
       ORDER BY occurred_at DESC`, [this.userId, companionId],
    );
    return rows.map(milestoneFromRow);
  }

  async getRuntimeState(sessionId: string) {
    const rows = await this.db.select<Array<{
      session_id: string; workout_exercise_id: string | null; set_id: string | null;
      motion_family: WorkoutRuntimeState["motionFamily"]; phase: WorkoutRuntimeState["phase"];
      phase_started_at: string | null; rest_ends_at: string | null; accumulated_active_seconds: number;
    }>>("SELECT * FROM workout_runtime_state WHERE owner_user_id = $1 AND session_id = $2", [this.userId, sessionId]);
    const row = rows[0];
    return row ? { sessionId: row.session_id, workoutExerciseId: row.workout_exercise_id, setId: row.set_id,
      motionFamily: row.motion_family, phase: row.phase, phaseStartedAt: row.phase_started_at,
      restEndsAt: row.rest_ends_at, accumulatedActiveSeconds: row.accumulated_active_seconds } : null;
  }

  async saveRuntimeState(state: WorkoutRuntimeState) {
    await this.db.execute(
      `INSERT INTO workout_runtime_state
       (session_id, owner_user_id, workout_exercise_id, set_id, motion_family, phase, phase_started_at,
        rest_ends_at, accumulated_active_seconds, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT(session_id) DO UPDATE SET workout_exercise_id = excluded.workout_exercise_id,
         set_id = excluded.set_id, motion_family = excluded.motion_family, phase = excluded.phase,
         phase_started_at = excluded.phase_started_at, rest_ends_at = excluded.rest_ends_at,
         accumulated_active_seconds = excluded.accumulated_active_seconds, updated_at = excluded.updated_at`,
      [state.sessionId, this.userId, state.workoutExerciseId, state.setId, state.motionFamily, state.phase,
        state.phaseStartedAt, state.restEndsAt, state.accumulatedActiveSeconds, now()],
    );
  }

  async clearRuntimeState(sessionId: string) {
    await this.db.execute("DELETE FROM workout_runtime_state WHERE owner_user_id = $1 AND session_id = $2", [this.userId, sessionId]);
  }

  async getSyncBatch(): Promise<CompanionSyncBatch> {
    const instances = await this.db.select<CloudCompanionInstance[]>(
      `SELECT ci.id, ci.owner_user_id AS user_id, ci.definition_id, ci.definition_version, ci.display_name,
       ci.created_at, ci.activated_at, ci.current_stage, ci.highest_stage, ci.growth_xp, ci.bond_xp, ci.level,
       ci.updated_at AS client_updated_at, ci.deleted_at FROM companion_instance ci JOIN sync_outbox o
       ON o.entity_id = ci.id AND o.entity_type = 'companion' AND o.owner_user_id = ci.owner_user_id
       WHERE ci.owner_user_id = $1 ORDER BY o.queued_at`, [this.userId]);
    const states = await this.db.select<CloudCompanionState[]>(
      `SELECT cs.owner_user_id AS id, cs.owner_user_id AS user_id, cs.active_companion_id,
       cs.updated_at AS client_updated_at, cs.deleted_at FROM companion_state cs JOIN sync_outbox o
       ON o.entity_id = cs.owner_user_id AND o.entity_type = 'companion_state' AND o.owner_user_id = cs.owner_user_id
       WHERE cs.owner_user_id = $1`, [this.userId]);
    const settings = await this.db.select<Array<Omit<CloudCompanionSettings, "text_prompts_enabled" | "reduce_motion" | "recovery_mode"> & {
      text_prompts_enabled: number; reduce_motion: number; recovery_mode: number;
    }>>(`SELECT cs.owner_user_id AS id, cs.owner_user_id AS user_id, cs.text_prompts_enabled, cs.interaction_frequency,
       cs.animation_intensity, cs.reduce_motion, cs.default_rest_seconds, cs.recovery_mode,
       cs.updated_at AS client_updated_at, cs.deleted_at FROM companion_settings cs JOIN sync_outbox o
       ON o.entity_id = cs.owner_user_id AND o.entity_type = 'companion_settings' AND o.owner_user_id = cs.owner_user_id
       WHERE cs.owner_user_id = $1`, [this.userId]);
    const feedback = await this.db.select<CloudWorkoutFeedback[]>(
      `SELECT wf.id, wf.owner_user_id AS user_id, wf.session_id, wf.rpe, wf.feeling, wf.recovery,
       wf.recovery_recorded_at, wf.updated_at AS client_updated_at, wf.deleted_at FROM workout_feedback wf JOIN sync_outbox o
       ON o.entity_id = wf.id AND o.entity_type = 'workout_feedback' AND o.owner_user_id = wf.owner_user_id
       WHERE wf.owner_user_id = $1`, [this.userId]);
    const growthEvents = await this.db.select<Array<Omit<CloudCompanionGrowthEvent, "breakdown"> & { breakdown: string | null }>>(
      `SELECT ge.id, ge.owner_user_id AS user_id, ge.companion_id, ge.source_type, ge.source_id, ge.rule_version,
       ge.xp_delta, ge.bond_delta, ge.reason, ge.breakdown_json AS breakdown, ge.occurred_at, ge.reversed_at,
       ge.updated_at AS client_updated_at, ge.deleted_at FROM companion_growth_event ge JOIN sync_outbox o
       ON o.entity_id = ge.id AND o.entity_type = 'growth_event' AND o.owner_user_id = ge.owner_user_id
       WHERE ge.owner_user_id = $1`, [this.userId]);
    const milestones = await this.db.select<Array<Omit<CloudCompanionMilestone, "metadata"> & { metadata: string }>>(
      `SELECT cm.id, cm.owner_user_id AS user_id, cm.companion_id, cm.kind, cm.title, cm.description, cm.stage,
       cm.occurred_at, cm.metadata_json AS metadata, cm.updated_at AS client_updated_at, cm.deleted_at
       FROM companion_milestone cm JOIN sync_outbox o ON o.entity_id = cm.id AND o.entity_type = 'milestone'
       AND o.owner_user_id = cm.owner_user_id WHERE cm.owner_user_id = $1`, [this.userId]);
    const unlocks = await this.db.select<CloudCompanionUnlock[]>(
      `SELECT cu.id, cu.owner_user_id AS user_id, cu.companion_id, cu.unlock_key, cu.unlocked_at,
       cu.updated_at AS client_updated_at, cu.deleted_at FROM companion_unlock cu JOIN sync_outbox o
       ON o.entity_id = cu.id AND o.entity_type = 'unlock' AND o.owner_user_id = cu.owner_user_id
       WHERE cu.owner_user_id = $1`, [this.userId]);
    return {
      instances, states,
      settings: settings.map((item) => ({ ...item, text_prompts_enabled: item.text_prompts_enabled === 1,
        reduce_motion: item.reduce_motion === 1, recovery_mode: item.recovery_mode === 1 })),
      feedback,
      growthEvents: growthEvents.map((item) => ({ ...item, breakdown: parseJson(item.breakdown, null) })),
      milestones: milestones.map((item) => ({ ...item, metadata: parseJson(item.metadata, {}) })),
      unlocks,
    };
  }

  async markSynced(entityType: CompanionSyncEntityType, records: Array<{ id: string; client_updated_at: string }>) {
    const config: Record<CompanionSyncEntityType, [string, string]> = {
      companion: ["companion_instance", "id"], companion_state: ["companion_state", "owner_user_id"],
      companion_settings: ["companion_settings", "owner_user_id"], workout_feedback: ["workout_feedback", "id"],
      growth_event: ["companion_growth_event", "id"], milestone: ["companion_milestone", "id"], unlock: ["companion_unlock", "id"],
    };
    const [table, idColumn] = config[entityType];
    for (const record of records) {
      await this.db.execute(
        `DELETE FROM sync_outbox WHERE owner_user_id = $1 AND entity_type = $2 AND entity_id = $3
         AND EXISTS (SELECT 1 FROM ${table} WHERE ${idColumn} = $3 AND owner_user_id = $1
           AND ABS(julianday(updated_at) - julianday($4)) < 0.00000001)`,
        [this.userId, entityType, record.id, record.client_updated_at],
      );
    }
  }

  async applyRemote(batch: CompanionSyncBatch) {
    for (const item of batch.instances) {
      await this.db.execute(
        `INSERT INTO companion_instance
         (id, owner_user_id, definition_id, definition_version, display_name, created_at, activated_at, current_stage,
          highest_stage, growth_xp, bond_xp, level, updated_at, deleted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT(id) DO UPDATE SET definition_id=excluded.definition_id, definition_version=excluded.definition_version,
          display_name=excluded.display_name, created_at=excluded.created_at, activated_at=excluded.activated_at,
          current_stage=excluded.current_stage, highest_stage=excluded.highest_stage, growth_xp=excluded.growth_xp,
          bond_xp=excluded.bond_xp, level=excluded.level, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at
         WHERE excluded.owner_user_id=companion_instance.owner_user_id AND excluded.updated_at>=companion_instance.updated_at`,
        [item.id, this.userId, item.definition_id, item.definition_version, item.display_name, item.created_at, item.activated_at,
          item.current_stage, item.highest_stage, item.growth_xp, item.bond_xp, item.level, item.client_updated_at, item.deleted_at],
      );
      await this.finishRemote("companion", item.id, item.client_updated_at, "companion_instance", "id");
    }
    for (const item of batch.states) {
      await this.db.execute(
        `INSERT INTO companion_state (owner_user_id, active_companion_id, updated_at, deleted_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT(owner_user_id) DO UPDATE SET active_companion_id=excluded.active_companion_id,
          updated_at=excluded.updated_at, deleted_at=excluded.deleted_at WHERE excluded.updated_at>=companion_state.updated_at`,
        [this.userId, item.active_companion_id, item.client_updated_at, item.deleted_at],
      );
      await this.finishRemote("companion_state", item.id, item.client_updated_at, "companion_state", "owner_user_id");
    }
    for (const item of batch.settings) {
      await this.db.execute(
        `INSERT INTO companion_settings (owner_user_id,text_prompts_enabled,interaction_frequency,animation_intensity,
          reduce_motion,default_rest_seconds,recovery_mode,updated_at,deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT(owner_user_id) DO UPDATE SET text_prompts_enabled=excluded.text_prompts_enabled,
          interaction_frequency=excluded.interaction_frequency,animation_intensity=excluded.animation_intensity,
          reduce_motion=excluded.reduce_motion,default_rest_seconds=excluded.default_rest_seconds,recovery_mode=excluded.recovery_mode,
          updated_at=excluded.updated_at,deleted_at=excluded.deleted_at WHERE excluded.updated_at>=companion_settings.updated_at`,
        [this.userId, item.text_prompts_enabled ? 1 : 0, item.interaction_frequency, item.animation_intensity,
          item.reduce_motion ? 1 : 0, item.default_rest_seconds, item.recovery_mode ? 1 : 0, item.client_updated_at, item.deleted_at],
      );
      await this.finishRemote("companion_settings", item.id, item.client_updated_at, "companion_settings", "owner_user_id");
    }
    for (const item of batch.feedback) {
      await this.db.execute(
        `INSERT INTO workout_feedback (id,owner_user_id,session_id,rpe,feeling,recovery,recovery_recorded_at,updated_at,deleted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET rpe=excluded.rpe,feeling=excluded.feeling,
          recovery=excluded.recovery,recovery_recorded_at=excluded.recovery_recorded_at,updated_at=excluded.updated_at,
          deleted_at=excluded.deleted_at WHERE excluded.updated_at>=workout_feedback.updated_at`,
        [item.id, this.userId, item.session_id, item.rpe, item.feeling, item.recovery, item.recovery_recorded_at, item.client_updated_at, item.deleted_at],
      );
      await this.finishRemote("workout_feedback", item.id, item.client_updated_at, "workout_feedback", "id");
    }
    for (const item of batch.growthEvents) {
      await this.db.execute(
        `INSERT INTO companion_growth_event (id,owner_user_id,companion_id,source_type,source_id,rule_version,xp_delta,bond_delta,
          reason,breakdown_json,occurred_at,reversed_at,updated_at,deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT(id) DO UPDATE SET xp_delta=excluded.xp_delta,bond_delta=excluded.bond_delta,reason=excluded.reason,
          breakdown_json=excluded.breakdown_json,occurred_at=excluded.occurred_at,reversed_at=excluded.reversed_at,
          updated_at=excluded.updated_at,deleted_at=excluded.deleted_at WHERE excluded.updated_at>=companion_growth_event.updated_at`,
        [item.id, this.userId, item.companion_id, item.source_type, item.source_id, item.rule_version, item.xp_delta,
          item.bond_delta, item.reason, item.breakdown ? JSON.stringify(item.breakdown) : null, item.occurred_at,
          item.reversed_at, item.client_updated_at, item.deleted_at],
      );
      await this.finishRemote("growth_event", item.id, item.client_updated_at, "companion_growth_event", "id");
    }
    for (const item of batch.milestones) {
      await this.db.execute(
        `INSERT INTO companion_milestone (id,owner_user_id,companion_id,kind,title,description,stage,occurred_at,metadata_json,updated_at,deleted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET title=excluded.title,
          description=excluded.description,stage=excluded.stage,occurred_at=excluded.occurred_at,metadata_json=excluded.metadata_json,
          updated_at=excluded.updated_at,deleted_at=excluded.deleted_at WHERE excluded.updated_at>=companion_milestone.updated_at`,
        [item.id, this.userId, item.companion_id, item.kind, item.title, item.description, item.stage, item.occurred_at,
          JSON.stringify(item.metadata || {}), item.client_updated_at, item.deleted_at],
      );
      await this.finishRemote("milestone", item.id, item.client_updated_at, "companion_milestone", "id");
    }
    for (const item of batch.unlocks) {
      await this.db.execute(
        `INSERT INTO companion_unlock (id,owner_user_id,companion_id,unlock_key,unlocked_at,updated_at,deleted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET unlock_key=excluded.unlock_key,
          unlocked_at=excluded.unlocked_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
          WHERE excluded.updated_at>=companion_unlock.updated_at`,
        [item.id, this.userId, item.companion_id, item.unlock_key, item.unlocked_at, item.client_updated_at, item.deleted_at],
      );
      await this.finishRemote("unlock", item.id, item.client_updated_at, "companion_unlock", "id");
    }
    await this.recalculateInstances();
  }

  async clearUserData() {
    await this.db.execute("DELETE FROM workout_runtime_state WHERE owner_user_id = $1", [this.userId]);
    await this.db.execute("DELETE FROM companion_state WHERE owner_user_id = $1", [this.userId]);
    await this.db.execute("DELETE FROM companion_settings WHERE owner_user_id = $1", [this.userId]);
    await this.db.execute("DELETE FROM workout_feedback WHERE owner_user_id = $1", [this.userId]);
    await this.db.execute("DELETE FROM companion_instance WHERE owner_user_id = $1", [this.userId]);
  }

  private async insertMilestone(milestone: CompanionMilestone) {
    await this.db.execute(
      `INSERT INTO companion_milestone
       (id,owner_user_id,companion_id,kind,title,description,stage,occurred_at,metadata_json,updated_at,deleted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,stage=excluded.stage,
        metadata_json=excluded.metadata_json,updated_at=excluded.updated_at,deleted_at=NULL`,
      [milestone.id, this.userId, milestone.companionId, milestone.kind, milestone.title, milestone.description,
        milestone.stage, milestone.occurredAt, JSON.stringify(milestone.metadata), milestone.updatedAt],
    );
  }

  private async finishRemote(entityType: CompanionSyncEntityType, entityId: string, remoteUpdatedAt: string, table: string, idColumn: string) {
    const local = await this.db.select<Array<{ updated_at: string }>>(
      `SELECT updated_at FROM ${table} WHERE ${idColumn} = $1 AND owner_user_id = $2`, [entityId, this.userId]);
    if (local[0]?.updated_at === remoteUpdatedAt) await this.markSynced(entityType, [{ id: entityId, client_updated_at: remoteUpdatedAt }]);
  }

  private async recalculateInstances() {
    for (const companion of await this.listInstances()) {
      const events = await this.listAllGrowthEvents(companion.id);
      const growth = Math.max(0, events.filter((event) => !event.reversedAt && !event.deletedAt).reduce((sum, event) => sum + event.xpDelta, 0));
      const bond = Math.max(0, events.filter((event) => !event.reversedAt && !event.deletedAt).reduce((sum, event) => sum + event.bondDelta, 0));
      await this.db.execute(
        `UPDATE companion_instance SET growth_xp=$1,bond_xp=$2,level=$3,updated_at=$4
         WHERE id=$5 AND owner_user_id=$6 AND (growth_xp<>$1 OR bond_xp<>$2 OR level<>$3)`,
        [growth, bond, 1 + Math.floor(bond / 100), now(), companion.id, this.userId],
      );
    }
  }
}

class BrowserCompanionRepository implements CompanionRepository {
  readonly mode = "browser-preview" as const;
  private readonly storageKey: string;

  constructor(readonly userId: string) {
    this.storageKey = `${BROWSER_STORAGE_PREFIX}.${userId}`;
  }

  private read(): BrowserCompanionStore {
    try {
      const value = JSON.parse(localStorage.getItem(this.storageKey) || "null") as BrowserCompanionStore | null;
      if (value) return { ...value, settings: value.settings || defaultSettings(), feedback: value.feedback || [],
        events: value.events || [], milestones: value.milestones || [], unlocks: value.unlocks || [], runtimes: value.runtimes || [] };
    } catch { /* Start from a safe empty preview store. */ }
    return { instances: [], activeId: null, settings: defaultSettings(), feedback: [], events: [], milestones: [], unlocks: [], runtimes: [] };
  }

  private write(store: BrowserCompanionStore) { localStorage.setItem(this.storageKey, JSON.stringify(store)); }
  async listInstances() { return clone(this.read().instances.filter((item) => !item.deletedAt)); }
  async getActiveInstance() { const store = this.read(); return clone(store.instances.find((item) => item.id === store.activeId && !item.deletedAt) || null); }

  async createInstance(definition: CompanionDefinition, displayName: string) {
    const name = displayName.trim();
    if (!name || name.length > 24) throw new Error("搭档名称需要填写，且不能超过 24 个字符。");
    const store = this.read(); const timestamp = now();
    const instance: CompanionInstance = { id: createId("companion"), ownerUserId: this.userId, definitionId: definition.id,
      definitionVersion: definition.version, displayName: name, createdAt: timestamp, activatedAt: timestamp,
      currentStage: "initial", highestStage: "initial", growthXp: 0, bondXp: 0, level: 1, updatedAt: timestamp, deletedAt: null };
    store.instances.push(instance); store.activeId = instance.id;
    store.milestones.push({ id: `milestone:${instance.id}:created`, ownerUserId: this.userId, companionId: instance.id,
      kind: "created", title: "我们成为了搭档", description: `${name} 从今天开始和你一起训练。`, stage: "initial",
      occurredAt: timestamp, metadata: {}, updatedAt: timestamp, deletedAt: null });
    this.write(store); return clone(instance);
  }

  async switchActive(companionId: string) { const store = this.read(); const item = store.instances.find((value) => value.id === companionId && !value.deletedAt);
    if (!item) throw new Error("没有找到要切换的搭档。"); item.activatedAt = now(); item.updatedAt = item.activatedAt; store.activeId = companionId; this.write(store); }
  async deleteInstance(companionId: string) { const store = this.read(); const item = store.instances.find((value) => value.id === companionId);
    if (item) { item.deletedAt = now(); item.updatedAt = item.deletedAt; } if (store.activeId === companionId) store.activeId = null; this.write(store); }
  async getSettings() { return clone(this.read().settings); }
  async saveSettings(settings: CompanionSettings) { const store = this.read(); store.settings = { ...settings, updatedAt: now() }; this.write(store); return clone(store.settings); }
  async getFeedback(sessionId: string) { return clone(this.read().feedback.find((item) => item.sessionId === sessionId && !item.deletedAt) || null); }
  async saveFeedback(sessionId: string, feedback: Pick<WorkoutFeedback, "rpe" | "feeling" | "recovery">) {
    const store = this.read(); const timestamp = now(); let item = store.feedback.find((value) => value.sessionId === sessionId);
    if (!item) { item = { id: `feedback:${sessionId}`, ownerUserId: this.userId, sessionId, rpe: null, feeling: null,
      recovery: null, recoveryRecordedAt: null, updatedAt: timestamp, deletedAt: null }; store.feedback.push(item); }
    item.rpe = feedback.rpe; item.feeling = feedback.feeling; if (feedback.recovery) { item.recovery = feedback.recovery; item.recoveryRecordedAt = timestamp; }
    item.updatedAt = timestamp; item.deletedAt = null; this.write(store); return clone(item);
  }
  async saveRecovery(sessionId: string, recovery: RecoveryFeeling) { const current = await this.getFeedback(sessionId);
    return this.saveFeedback(sessionId, { rpe: current?.rpe || null, feeling: current?.feeling || null, recovery }); }

  async settleWorkout(companionId: string, definition: CompanionDefinition, input: WorkoutSettlementInput): Promise<CompanionSettlement> {
    const store = this.read(); const companion = store.instances.find((item) => item.id === companionId && !item.deletedAt);
    if (!companion) throw new Error("没有找到本次训练的搭档。");
    const calculated = calculateWorkoutGrowth(input); const timestamp = now(); const id = `growth:${companionId}:workout:${input.session.id}:v${COMPANION_RULE_VERSION}`;
    const dayUsed = store.events.filter((event) => event.id !== id && !event.reversedAt && !event.deletedAt && localDay(event.occurredAt) === localDay(input.occurredAt)).reduce((sum, event) => sum + Math.max(0, event.xpDelta), 0);
    const weekUsed = store.events.filter((event) => event.id !== id && !event.reversedAt && !event.deletedAt && localWeek(event.occurredAt) === localWeek(input.occurredAt)).reduce((sum, event) => sum + Math.max(0, event.xpDelta), 0);
    const awarded = Math.max(0, Math.min(calculated.total, DAILY_GROWTH_CAP - dayUsed, WEEKLY_GROWTH_CAP - weekUsed));
    const existing = store.events.find((event) => event.id === id); const previous = Boolean(existing);
    const event: CompanionGrowthEvent = { id, ownerUserId: this.userId, companionId, sourceType: "workout", sourceId: input.session.id,
      ruleVersion: COMPANION_RULE_VERSION, xpDelta: awarded, bondDelta: calculated.bond, reason: input.endedReason === "completed" ? "完成共同训练" : "完成部分训练",
      breakdown: calculated.breakdown, occurredAt: input.occurredAt, reversedAt: null, updatedAt: timestamp, deletedAt: null };
    if (existing) Object.assign(existing, event); else store.events.push(event);
    companion.growthXp = Math.max(0, store.events.filter((item) => item.companionId === companionId && !item.reversedAt && !item.deletedAt).reduce((sum, item) => sum + item.xpDelta, 0));
    companion.bondXp = Math.max(0, store.events.filter((item) => item.companionId === companionId && !item.reversedAt && !item.deletedAt).reduce((sum, item) => sum + item.bondDelta, 0));
    companion.level = 1 + Math.floor(companion.bondXp / 100); const workouts = activeWorkoutCount(store.events.filter((item) => item.companionId === companionId));
    const previousStage = companion.currentStage; const next = nextEligibleStage(companion, stageDefinitions(definition), workouts, input.occurredAt);
    if (next) companion.currentStage = companion.highestStage = next.key; companion.updatedAt = timestamp;
    let milestone: CompanionMilestone | null = null;
    if (workouts === 1 && !previous) milestone = { id: `milestone:${companionId}:first-workout`, ownerUserId: this.userId, companionId,
      kind: "first_workout", title: "第一次共同训练", description: "你们完成了第一段共同成长记录。", stage: companion.currentStage,
      occurredAt: input.occurredAt, metadata: { sessionId: input.session.id }, updatedAt: timestamp, deletedAt: null };
    if (next) milestone = { id: `milestone:${companionId}:stage:${next.key}`, ownerUserId: this.userId, companionId, kind: "evolution",
      title: `进入${next.name}`, description: next.description, stage: next.key, occurredAt: input.occurredAt,
      metadata: { growthXp: companion.growthXp, workoutCount: workouts }, updatedAt: timestamp, deletedAt: null };
    if (milestone && !store.milestones.some((item) => item.id === milestone!.id)) store.milestones.push(milestone);
    this.write(store); return { companion: clone(companion), growthEarned: awarded, bondEarned: calculated.bond,
      breakdown: calculated.breakdown, previousStage, currentStage: companion.currentStage, evolved: Boolean(next), milestone: clone(milestone) };
  }

  async getProgress(companionId: string, definition: CompanionDefinition | null, sessions: WorkoutSession[]) { const store = this.read();
    const companion = store.instances.find((item) => item.id === companionId && !item.deletedAt); if (!companion) throw new Error("没有找到搭档。");
    return progressFromData(clone(companion), definition, sessions,
      clone(store.events.filter((item) => item.companionId === companionId).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt))),
      clone(store.milestones.filter((item) => item.companionId === companionId).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt))), store.settings); }
  async reverseWorkoutGrowth(sessionId: string) { const store = this.read(); const timestamp = now();
    for (const event of store.events) if (event.sourceType === "workout" && event.sourceId === sessionId && !event.reversedAt) { event.reversedAt = timestamp; event.updatedAt = timestamp; }
    for (const companion of store.instances) { const events = store.events.filter((event) => event.companionId === companion.id && !event.reversedAt && !event.deletedAt);
      companion.growthXp = Math.max(0, events.reduce((sum, event) => sum + event.xpDelta, 0)); companion.bondXp = Math.max(0, events.reduce((sum, event) => sum + event.bondDelta, 0)); companion.level = 1 + Math.floor(companion.bondXp / 100); companion.updatedAt = timestamp; }
    this.write(store); }
  async listGrowthEvents(companionId: string, limit = 50) { return clone(this.read().events.filter((item) => item.companionId === companionId && !item.deletedAt).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit)); }
  async listMilestones(companionId: string) { return clone(this.read().milestones.filter((item) => item.companionId === companionId && !item.deletedAt).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt))); }
  async getRuntimeState(sessionId: string) { return clone(this.read().runtimes.find((item) => item.sessionId === sessionId) || null); }
  async saveRuntimeState(state: WorkoutRuntimeState) { const store = this.read(); const index = store.runtimes.findIndex((item) => item.sessionId === state.sessionId);
    if (index >= 0) store.runtimes[index] = clone(state); else store.runtimes.push(clone(state)); this.write(store); }
  async clearRuntimeState(sessionId: string) { const store = this.read(); store.runtimes = store.runtimes.filter((item) => item.sessionId !== sessionId); this.write(store); }
  async getSyncBatch(): Promise<CompanionSyncBatch> { return { instances: [], states: [], settings: [], feedback: [], growthEvents: [], milestones: [], unlocks: [] }; }
  async markSynced(_entityType: CompanionSyncEntityType, _records: Array<{ id: string; client_updated_at: string }>) {}
  async applyRemote(_batch: CompanionSyncBatch) {}
  async clearUserData() { localStorage.removeItem(this.storageKey); }
}

export async function createCompanionRepository(userId: string): Promise<CompanionRepository> {
  if (!userId) throw new Error("缺少当前账号，无法打开搭档数据。");
  if (!("__TAURI_INTERNALS__" in window)) return new BrowserCompanionRepository(userId);
  const { default: DatabaseClass } = await import("@tauri-apps/plugin-sql");
  const db = await DatabaseClass.load(DATABASE_URL);
  await db.execute("PRAGMA foreign_keys = ON");
  return new SqliteCompanionRepository(db, userId);
}

export function companionDefinitionFor(instance: CompanionInstance | null) {
  return instance ? COMPANION_CATALOG.find((definition) => definition.id === instance.definitionId) || null : null;
}
